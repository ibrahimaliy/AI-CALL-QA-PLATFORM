// Browser-to-Storage Direct Upload Strategies
// Implements Specification Section 3, 4, 5, 6
import * as tus from "tus-js-client";

export interface UploadDestination {
  storagePath: string;
  uploadUrl: string;
  uploadHeaders?: Record<string, string>;
  resumableEndpoint?: string;
  bucket?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  accessToken?: string;
}

export interface UploadProgressInfo {
  percentage: number;
  bytesUploaded: number;
  bytesTotal: number;
  status: "Uploading" | "Paused" | "Resuming" | "Completed" | "Failed";
}

export interface UploadResult {
  storagePath: string;
  fileSizeBytes: number;
}

export interface AudioUploadStrategy {
  name: string;
  upload(
    file: File,
    destination: UploadDestination,
    onProgress?: (info: UploadProgressInfo) => void
  ): Promise<UploadResult>;
}

/**
 * Standard direct upload strategy for files <= 6 MB.
 * Uses XMLHttpRequest PUT with real-time onprogress tracking directly to storage.
 * Does not proxy through Vercel Functions.
 */
export class StandardSupabaseUploadStrategy implements AudioUploadStrategy {
  readonly name = "StandardSupabaseUpload";

  upload(
    file: File,
    destination: UploadDestination,
    onProgress?: (info: UploadProgressInfo) => void
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", destination.uploadUrl, true);

      // Set headers from upload authorization
      if (destination.uploadHeaders) {
        for (const [key, value] of Object.entries(destination.uploadHeaders)) {
          xhr.setRequestHeader(key, value);
        }
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentage = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress({
            percentage,
            bytesUploaded: event.loaded,
            bytesTotal: event.total,
            status: "Uploading",
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) {
            onProgress({
              percentage: 100,
              bytesUploaded: file.size,
              bytesTotal: file.size,
              status: "Completed",
            });
          }
          resolve({
            storagePath: destination.storagePath,
            fileSizeBytes: file.size,
          });
        } else {
          let errorDetail = "";
          try {
            const parsed = JSON.parse(xhr.responseText);
            errorDetail = parsed.error || parsed.message || xhr.statusText;
          } catch {
            errorDetail = xhr.statusText || `HTTP ${xhr.status}`;
          }
          if (onProgress) {
            onProgress({
              percentage: 0,
              bytesUploaded: 0,
              bytesTotal: file.size,
              status: "Failed",
            });
          }
          reject(new Error(`Direct upload failed (${xhr.status}): ${errorDetail}`));
        }
      };

      xhr.onerror = () => {
        if (onProgress) {
          onProgress({
            percentage: 0,
            bytesUploaded: 0,
            bytesTotal: file.size,
            status: "Failed",
          });
        }
        reject(new Error("Network error during direct storage upload. Please check connectivity and retry."));
      };

      xhr.send(file);
    });
  }
}

/**
 * TUS Resumable upload strategy for files > 6 MB.
 * Connects directly to Supabase Storage resumable endpoint:
 * https://<project-id>.storage.supabase.co/storage/v1/upload/resumable
 * Supports chunking, auto-retry, and resume on connection drop.
 */
export class ResumableSupabaseUploadStrategy implements AudioUploadStrategy {
  readonly name = "ResumableSupabaseUpload";

  upload(
    file: File,
    destination: UploadDestination,
    onProgress?: (info: UploadProgressInfo) => void
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      // Derive resumable endpoint
      const endpoint =
        destination.resumableEndpoint ||
        (destination.supabaseUrl
          ? `${destination.supabaseUrl}/storage/v1/upload/resumable`
          : null);

      if (!endpoint) {
        // Fallback to standard upload if no resumable endpoint is available
        const standard = new StandardSupabaseUploadStrategy();
        return standard.upload(file, destination, onProgress).then(resolve).catch(reject);
      }

      const bucketName = destination.bucket || "call-recordings";
      const anonKey = destination.supabaseAnonKey || destination.uploadHeaders?.apikey || "";
      const authToken = destination.accessToken || anonKey;

      const headers: Record<string, string> = {
        apikey: anonKey,
        Authorization: `Bearer ${authToken}`,
        "x-upsert": "true",
      };

      const upload = new tus.Upload(file, {
        endpoint,
        retryDelays: [0, 2000, 5000, 10000, 20000],
        headers,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName,
          objectName: destination.storagePath,
          contentType: file.type || "audio/wav",
          cacheControl: "3600",
        },
        chunkSize: 6 * 1024 * 1024, // 6MB per chunk recommended by Supabase Storage
        onError: (error) => {
          if (onProgress) {
            onProgress({
              percentage: 0,
              bytesUploaded: 0,
              bytesTotal: file.size,
              status: "Failed",
            });
          }
          reject(new Error(`Resumable storage upload error: ${error.message || error}`));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (onProgress && bytesTotal > 0) {
            const percentage = Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100));
            onProgress({
              percentage,
              bytesUploaded,
              bytesTotal,
              status: "Uploading",
            });
          }
        },
        onSuccess: () => {
          if (onProgress) {
            onProgress({
              percentage: 100,
              bytesUploaded: file.size,
              bytesTotal: file.size,
              status: "Completed",
            });
          }
          resolve({
            storagePath: destination.storagePath,
            fileSizeBytes: file.size,
          });
        },
      });

      // Start the resumable upload
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          if (onProgress) {
            onProgress({
              percentage: 0,
              bytesUploaded: 0,
              bytesTotal: file.size,
              status: "Resuming",
            });
          }
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      }).catch(() => {
        upload.start();
      });
    });
  }
}

/**
 * Strategy Selector:
 * Files > 6 MB use ResumableSupabaseUploadStrategy (TUS)
 * Files <= 6 MB use StandardSupabaseUploadStrategy
 */
export function selectUploadStrategy(fileSizeBytes: number): AudioUploadStrategy {
  const SIX_MEGABYTES = 6 * 1024 * 1024;
  if (fileSizeBytes > SIX_MEGABYTES) {
    return new ResumableSupabaseUploadStrategy();
  }
  return new StandardSupabaseUploadStrategy();
}
