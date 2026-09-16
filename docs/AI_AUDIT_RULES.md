# AI Audit Rules & Prompt Constraints

## System Prompt Contract (Section 29)
The AI system prompt strictly instructs:
1. You are a customer-service QA auditor.
2. Evaluate ONLY according to the supplied scorecard.
3. Do not create additional QA rules.
4. Do not deduct marks for behaviour that the supplied scorecard does not prohibit.
5. Do not assume facts that are not present.
6. If required information is unavailable, return `REVIEW_REQUIRED`.
7. Every deduction must include evidence referencing supplied utterance IDs.
8. Never create or hallucinate an utterance ID.
9. Do not calculate the final overall score. Evaluate individual parameters only.
10. The backend will calculate all final scores deterministically.

## Audit Source Routing (Section 15)
- `TRANSCRIPT`: Pure semantic text checks (Greetings, Probing, Closing, App Pitch).
- `AUDIO`: Vocal energy, filler words, speech rate, interruptions, dead air, tone.
- `KNOWLEDGE_BASE`: Product rules, turnaround times, SOPs.
- `CRM`: Ticket creation, tag accuracy, escalation notes.
- `HYBRID`: Combined call transcript + external process map verification.
- `MANUAL`: Supervisor exclusive review.
