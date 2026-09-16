import { getGlobalStores, persistAudioToDisk, loadAudioFromDisk } from "@/lib/store/global-store";

export function setCachedAudio(storagePath: string, buffer: Buffer, contentType: string) {
  const stores = getGlobalStores();
  stores.audioCache.set(storagePath, { buffer, contentType });
  persistAudioToDisk(storagePath, buffer, contentType);
}

export function getCachedAudio(storagePath: string): { buffer: Buffer; contentType: string } | undefined {
  const stores = getGlobalStores();
  const memoryItem = stores.audioCache.get(storagePath);
  if (memoryItem) {
    return memoryItem;
  }

  const diskItem = loadAudioFromDisk(storagePath);
  if (diskItem) {
    stores.audioCache.set(storagePath, diskItem);
    return diskItem;
  }

  return undefined;
}
