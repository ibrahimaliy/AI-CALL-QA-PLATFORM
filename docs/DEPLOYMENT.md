# Production Deployment Guide: Vercel Transcription Release

This document outlines the step-by-step procedure for deploying the **AI Call QA Platform** to **Vercel** for production transcription testing.

---

## 1. Release Architecture & Scope

This release target is the **VERCEL TRANSCRIPTION TESTING RELEASE**:
* **Workflow Focus**: Real audio upload, private storage, AssemblyAI diarized transcription, transcript/audio playback synchronization, and manual speaker role correction.
* **AI QA Engine**: Feature-gated OFF (`ENABLE_AI_QA=false`, `TRANSCRIPTION_ONLY_MODE=true`).
* **Statelessness**: 100% serverless on Vercel. No `.data` filesystem persistence. Production database is Supabase PostgreSQL. Audio persistence is private Supabase Storage.
* **Payload Protection**: Audio recordings (including the 6.99MB benchmark) are uploaded **directly from browser to Supabase Storage** via TUS resumable upload (>6MB) or direct REST. Large audio files **never** pass through Vercel Function bodies (preventing HTTP 413 Function Payload Too Large).

---

## 2. Prerequisites

1. **GitHub Account & Repository**: A Git repository containing the codebase.
2. **Vercel Account**: Team or Personal account connected to GitHub.
3. **Supabase Project**: A live Supabase project (PostgreSQL + Auth + Storage).
4. **AssemblyAI Account**: An active AssemblyAI account with a valid production API key.

---

## 3. Supabase Setup & Migrations

### 3.1 Apply Database Migrations
All 7 database migrations located in `supabase/migrations/` must be applied to your remote Supabase project in order:

```bash
# Link local CLI to remote Supabase project
npx supabase link --project-ref <your-project-ref>

# Check migration status
npx supabase migration list

# Push migrations to remote database
npx supabase db push
```

*Note: Never run destructive migration reset commands (`db reset`) against a production database.*

### 3.2 Private Audio Storage Bucket
1. Go to **Supabase Dashboard > Storage > Buckets**.
2. Verify or create a bucket named: `call-recordings`.
3. Set **Bucket Privacy**: **Private** (Public access disabled).
4. Storage limits: Ensure allowed MIME types include `audio/wav`, `audio/mpeg`, `audio/mp4`, `audio/x-m4a`, `audio/aac`, and maximum file size is set to at least **50 MB**.

### 3.3 Storage Row Level Security (RLS)
The bucket policies ensure organization-scoped isolation:
* Path convention: `{organizationId}/{campaignId}/{callId}/{safeFilename}`
* Authenticated users can only read and write within their organization's prefix.
* AssemblyAI accesses audio via short-lived (30-60 min) signed URLs generated server-side.

### 3.4 Supabase Auth Configuration
1. Go to **Supabase Dashboard > Authentication > URL Configuration**.
2. Set **Site URL**: `https://<your-project>.vercel.app`
3. Add to **Redirect URLs**:
   * `https://<your-project>.vercel.app/**`
   * `http://localhost:3000/**` (for local development)

---

## 4. Vercel Deployment

### 4.1 Import Project
1. In the Vercel Dashboard, click **Add New > Project**.
2. Import the Git repository.
3. Framework Preset: **Next.js** (detected automatically).
4. Root Directory: `./`

### 4.2 Configure Environment Variables
In Vercel **Settings > Environment Variables**, add the following for **Production** (and optionally Preview):

| Variable Name | Value / Description | Required For |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` | App links & webhooks |
| `TRANSCRIPTION_ONLY_MODE` | `true` | UI feature-gate |
| `ENABLE_AI_QA` | `false` | Server-side QA gate |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Browser & Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon / Publishable Key | Browser Direct Upload |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key | Server-only DB/Storage |
| `STORAGE_PROVIDER` | `supabase` | Storage Strategy |
| `SUPABASE_AUDIO_BUCKET` | `call-recordings` | Bucket Name |
| `TRANSCRIPTION_PROVIDER` | `assemblyai` | Strict Production Provider |
| `ENABLE_MOCK_TRANSCRIPTION` | `false` | Disable mock in production |
| `ASSEMBLYAI_API_KEY` | AssemblyAI production API key | AssemblyAI jobs |
| `ASSEMBLYAI_WEBHOOK_SECRET` | Strong random secret (e.g. 32-char hex) | Webhook verification |
| `ASSEMBLYAI_WEBHOOK_URL` | `https://<your-project>.vercel.app/api/webhooks/assemblyai` | Provider callback |
| `MAX_AUDIO_FILE_MB` | `50` | Maximum upload size |

*Security Note: Never prefix `SUPABASE_SERVICE_ROLE_KEY`, `ASSEMBLYAI_API_KEY`, `ASSEMBLYAI_WEBHOOK_SECRET`, or `OPENAI_API_KEY` with `NEXT_PUBLIC_`.*

### 4.3 Trigger Production Build
Click **Deploy**. Next.js will build and deploy without Docker.

---

## 5. Post-Deployment Configuration

### 5.1 Update Webhook & App URL
Once Vercel assigns your production domain (e.g. `ai-call-qa.vercel.app`):
1. Update `NEXT_PUBLIC_APP_URL` to `https://ai-call-qa.vercel.app`.
2. Update `ASSEMBLYAI_WEBHOOK_URL` to `https://ai-call-qa.vercel.app/api/webhooks/assemblyai`.
3. Trigger a redeployment in Vercel so the server runtime uses the updated values.

---

## 6. End-to-End Verification Test (7:17 Benchmark Audio)

Run the standard regression test with the genuine 7:17 contact-center WAV recording:

| Metric | Expected Value |
|---|---|
| Size | 6,993,324 bytes (~6.99 MB) |
| Duration | ~437,080 ms (07:17) |
| SHA-256 Checksum | `d688d7d8f752a7002fc4dfb400480a3d19db0a9bb7dfb8a0ab1dfefbdf310303` |

### Step-by-Step Test Procedure:
1. **Health Verification**:
   * Visit `https://<your-project>.vercel.app/api/health`
   * Expected: HTTP 200 `{"status":"ok","timestamp":"..."}`
2. **Direct Browser Upload**:
   * Navigate to `/calls/new`.
   * Fill call details (Smile Telecom, Inbound Support, Olabiyi Boluwatife).
   * Select the 6.99MB WAV file.
   * Observe progress bar transitioning from `0%` through `100%` with status `Uploading via TUS resumable endpoint...`.
   * Observe completion without triggering `413 FUNCTION_PAYLOAD_TOO_LARGE`.
3. **Start Transcription**:
   * Click **Start Transcription**.
   * Status transitions from `UPLOADED` to `TRANSCRIBING`.
   * Server sends temporary signed URL to AssemblyAI and registers webhook callback.
4. **Webhook Reception & Processing**:
   * AssemblyAI processes the call and hits `/api/webhooks/assemblyai`.
   * Webhook validates secret, downloads transcript result, normalizes utterances (including word-level speaker attribution), validates duration (~437s), and saves to Supabase.
   * Call status becomes `TRANSCRIBED`.
5. **Synchronized Playback & Seeking**:
   * Open the call detail page.
   * Click any utterance in the transcript. Audio player seeks to the utterance's `startMs / 1000`.
   * Play audio; active utterance highlights smoothly.
6. **Manual Speaker Role Attribution**:
   * Verify Speaker A and Speaker B labels.
   * Correct any role assignment (e.g. A → AGENT, B → CUSTOMER).
   * Confirm role persists upon page refresh.
7. **AI QA Gating Verification**:
   * Verify the "Start AI Audit" button is hidden/disabled.
   * Test direct API call: `POST /api/calls/<id>/audit`.
   * Expected: HTTP 403 `{"success":false,"code":"AI_QA_DISABLED","error":"AI QA auditing is currently disabled pending approved QA rules."}`.
8. **Statelessness / Redeploy Test**:
   * Redeploy the project on Vercel.
   * Refresh the call page.
   * Verify all calls, transcripts, audio playback, and speaker corrections persist intact.

---

## 7. Troubleshooting

| Issue / Error | Root Cause | Solution |
|---|---|---|
| `413 FUNCTION_PAYLOAD_TOO_LARGE` | Audio was proxied through Vercel Function | Verify `upload-strategy.ts` is active. File must upload directly to Supabase via TUS resumable upload. |
| `Storage verification failed: Object not found` | Upload failed or wrong bucket name | Verify `SUPABASE_AUDIO_BUCKET=call-recordings` and Supabase Storage bucket permissions. |
| `TRANSCRIPT_DURATION_MISMATCH` | Provider returned duration outside tolerance | Check if correct audio file was uploaded. Verify AssemblyAI transcribed the full file. |
| `KNOWN_MOCK_FIXTURE_DETECTED` | A fixture or mock provider was used | Verify `ENABLE_MOCK_TRANSCRIPTION=false` and `TRANSCRIPTION_PROVIDER=assemblyai`. |
| `AI_QA_DISABLED (403)` | Expected behavior | AI QA is deliberately disabled for this release. |
| Webhook not firing / Call stuck in `TRANSCRIBING` | Webhook URL misconfigured or unreachable | Ensure `ASSEMBLYAI_WEBHOOK_URL` points to production domain, not `localhost`. In dev, use the client polling fallback. |
| `Unauthorized: Invalid webhook secret` | Secret mismatch | Ensure `ASSEMBLYAI_WEBHOOK_SECRET` matches between Vercel and provider. |
