// Centralized Feature Flags Configuration
// Specification Section 9 & 10

export const features = {
  /**
   * When true, ordinary users primarily interact with Call upload, transcription,
   * synchronized transcript review, audio playback, and speaker role correction.
   * AI QA auditing interfaces and triggers are hidden/disabled.
   */
  transcriptionOnly:
    process.env.TRANSCRIPTION_ONLY_MODE === "true" ||
    process.env.NEXT_PUBLIC_TRANSCRIPTION_ONLY_MODE === "true" ||
    process.env.TRANSCRIPTION_ONLY_MODE === undefined, // default true in testing release

  /**
   * Feature flag controlling AI QA audit execution and UI.
   * Strictly false until approved QA rule sets and scorecards are signed off.
   */
  aiQa:
    process.env.ENABLE_AI_QA === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_AI_QA === "true",
};
