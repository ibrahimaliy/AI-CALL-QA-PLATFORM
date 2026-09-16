"use client";

import React from "react";
import { Settings, ShieldAlert, Key, Database, Cpu, HardDrive } from "lucide-react";
import { INITIAL_SCORECARD } from "@/lib/seed-data";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Platform Configuration & Environment</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Backend services, database connections, and AI pipeline orchestration settings.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200 flex items-start space-x-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong>Section 59 Compliance Reminder:</strong> Never expose <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>OPENAI_API_KEY</code>, or <code>ASSEMBLYAI_API_KEY</code> to the browser or Client Components. Keep all provider credentials strictly server-side.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Database & RLS (Supabase)</span>
          </div>
          <p className="text-xs text-slate-400">
            PostgreSQL instance with Row Level Security enforcing tenant and supervisor permissions.
          </p>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="text-slate-500">Migrations Path: <span className="text-slate-300">supabase/migrations/</span></div>
            <div className="text-slate-500">Seed Script: <span className="text-slate-300">supabase/seed.sql</span></div>
            <div className="text-slate-500">Status: <span className="text-emerald-400">Schema Configured</span></div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            <span>Audio Storage Layer</span>
          </div>
          <p className="text-xs text-slate-400">
            Encrypted private bucket storage. Audio files accessed strictly through time-limited authorized signed URLs.
          </p>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="text-slate-500">Provider: <span className="text-slate-300">Supabase Storage / S3 Abstracted</span></div>
            <div className="text-slate-500">Access: <span className="text-indigo-300">Private Bucket (Signed URLs)</span></div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Deterministic Scoring Engine</span>
          </div>
          <p className="text-xs text-slate-400">
            Backend calculator strictly computes totals, auditable weights, and provisional performance.
          </p>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="text-slate-500">Total Scorable: <span className="text-slate-300">100.00 pts</span></div>
            <div className="text-slate-500">Passing Score: <span className="text-cyan-300">{INITIAL_SCORECARD.passing_score}%</span></div>
            <div className="text-slate-500">LLM Override Protection: <span className="text-emerald-400">Enforced</span></div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <Key className="w-4 h-4 text-amber-400" />
            <span>External Providers (Next Phases)</span>
          </div>
          <p className="text-xs text-slate-400">
            AssemblyAI (transcription & diarization), OpenAI (structured parameter audit), and n8n (orchestration).
          </p>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="text-slate-500">AssemblyAI: <span className="text-slate-400">Phase 3</span></div>
            <div className="text-slate-500">OpenAI Auditor: <span className="text-slate-400">Phase 4</span></div>
            <div className="text-slate-500">n8n Orchestration: <span className="text-slate-400">Phase 7</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
