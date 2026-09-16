# AI Call Quality Assurance Platform - Project Specification

## 1. Overview
The AI Call Quality Assurance Platform is an enterprise-grade automated auditing platform that evaluates recorded English customer-service calls against an official QA scorecard. The platform produces transparent evaluations, exact transcript evidence references, auditable weight computations, and supervisor override capabilities.

## 2. Core Principles
1. **Auditor Assistant**: The AI assists supervisors and compliance teams; it is not an unquestionable authority.
2. **Evidence-Driven Deductions**: Every deduction is linked to specific utterance IDs with verifiable audio timestamps.
3. **Deterministic Scoring**: All scores, percentages, and pass/fail thresholds are calculated by backend business logic, never trusted to raw LLM outputs.
4. **Auditable Weight Integrity**: Evaluated parameters are tracked separately from parameters requiring external verification (e.g., knowledge base or CRM systems). If only 76 points are evaluated, the system reports provisional percentage out of 76 rather than falsifying an evaluation over 100 points.
5. **Human Review Preservation**: Supervisor overrides never overwrite the raw AI audit. Both records remain immutable in the audit history.

## 3. Technology Stack
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4.
- **Database**: PostgreSQL with Supabase (Row Level Security enabled).
- **Audio Processing**: AssemblyAI (Speech-to-Text with dual-speaker diarization).
- **AI Audit Engine**: OpenAI API with Structured JSON Schema outputs and Zod runtime validation.
- **Workflow Orchestration**: n8n for asynchronous pipeline coordination.
