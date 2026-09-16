import {
  TranscriptionProvider,
  TranscriptionRequest,
  TranscriptionSubmission,
  NormalizedTranscriptResult,
  NormalizedUtterance,
} from "./types";

export class MockTranscriptionProvider implements TranscriptionProvider {
  readonly name = "MOCK_PROVIDER";

  async submit(request: TranscriptionRequest): Promise<TranscriptionSubmission> {
    const providerTranscriptId = `mock_tr_${Date.now()}`;
    return {
      provider: this.name,
      providerTranscriptId,
      status: "PROCESSING",
      submittedAt: new Date().toISOString(),
    };
  }

  async getResult(providerTranscriptId: string): Promise<NormalizedTranscriptResult> {
    // Realistic customer-agent sample dialogue matching Smile Telecom context
    const utterances: NormalizedUtterance[] = [
      {
        utteranceIndex: 0,
        speakerLabel: "A",
        startMs: 820,
        endMs: 4320,
        text: "Good morning, thank you for calling Smile Telecom. My name is Boluwatife. How may I assist you today?",
        confidence: 0.98,
        words: [
          { text: "Good", startMs: 820, endMs: 1100, confidence: 0.98, speakerLabel: "A" },
          { text: "morning,", startMs: 1120, endMs: 1540, confidence: 0.98, speakerLabel: "A" },
          { text: "thank", startMs: 1560, endMs: 1800, confidence: 0.99, speakerLabel: "A" },
          { text: "you", startMs: 1810, endMs: 1950, confidence: 0.99, speakerLabel: "A" },
          { text: "for", startMs: 1960, endMs: 2100, confidence: 0.99, speakerLabel: "A" },
          { text: "calling", startMs: 2110, endMs: 2450, confidence: 0.98, speakerLabel: "A" },
          { text: "Smile", startMs: 2460, endMs: 2750, confidence: 0.97, speakerLabel: "A" },
          { text: "Telecom.", startMs: 2760, endMs: 3150, confidence: 0.98, speakerLabel: "A" },
          { text: "My", startMs: 3200, endMs: 3350, confidence: 0.99, speakerLabel: "A" },
          { text: "name", startMs: 3360, endMs: 3580, confidence: 0.99, speakerLabel: "A" },
          { text: "is", startMs: 3590, endMs: 3720, confidence: 0.99, speakerLabel: "A" },
          { text: "Boluwatife.", startMs: 3730, endMs: 4320, confidence: 0.95, speakerLabel: "A" },
        ],
      },
      {
        utteranceIndex: 1,
        speakerLabel: "B",
        startMs: 4900,
        endMs: 8800,
        text: "Hello Boluwatife. My internet connection has stopped working since this morning and I have an urgent meeting.",
        confidence: 0.96,
        words: [
          { text: "Hello", startMs: 4900, endMs: 5200, confidence: 0.97, speakerLabel: "B" },
          { text: "Boluwatife.", startMs: 5210, endMs: 5800, confidence: 0.94, speakerLabel: "B" },
          { text: "My", startMs: 5820, endMs: 6000, confidence: 0.98, speakerLabel: "B" },
          { text: "internet", startMs: 6010, endMs: 6420, confidence: 0.98, speakerLabel: "B" },
          { text: "connection", startMs: 6430, endMs: 6950, confidence: 0.96, speakerLabel: "B" },
          { text: "has", startMs: 6960, endMs: 7120, confidence: 0.98, speakerLabel: "B" },
          { text: "stopped", startMs: 7130, endMs: 7500, confidence: 0.97, speakerLabel: "B" },
          { text: "working", startMs: 7510, endMs: 7900, confidence: 0.97, speakerLabel: "B" },
          { text: "since", startMs: 7910, endMs: 8200, confidence: 0.98, speakerLabel: "B" },
          { text: "this", startMs: 8210, endMs: 8390, confidence: 0.99, speakerLabel: "B" },
          { text: "morning.", startMs: 8400, endMs: 8800, confidence: 0.98, speakerLabel: "B" },
        ],
      },
      {
        utteranceIndex: 2,
        speakerLabel: "A",
        startMs: 9100,
        endMs: 14200,
        text: "I am truly sorry to hear that. For security and verification, may I please have your registered phone number and account name?",
        confidence: 0.97,
        words: [
          { text: "I", startMs: 9100, endMs: 9220, confidence: 0.99, speakerLabel: "A" },
          { text: "am", startMs: 9230, endMs: 9350, confidence: 0.99, speakerLabel: "A" },
          { text: "truly", startMs: 9360, endMs: 9650, confidence: 0.98, speakerLabel: "A" },
          { text: "sorry", startMs: 9660, endMs: 9980, confidence: 0.99, speakerLabel: "A" },
          { text: "to", startMs: 9990, endMs: 10100, confidence: 0.99, speakerLabel: "A" },
          { text: "hear", startMs: 10110, endMs: 10320, confidence: 0.99, speakerLabel: "A" },
          { text: "that.", startMs: 10330, endMs: 10600, confidence: 0.98, speakerLabel: "A" },
        ],
      },
      {
        utteranceIndex: 3,
        speakerLabel: "B",
        startMs: 14600,
        endMs: 18500,
        text: "Yes, the phone number is 07020209088 and the name on the account is Andrea Ayinde.",
        confidence: 0.96,
        words: [
          { text: "Yes,", startMs: 14600, endMs: 15000, confidence: 0.98, speakerLabel: "B" },
          { text: "the", startMs: 15050, endMs: 15200, confidence: 0.99, speakerLabel: "B" },
          { text: "phone", startMs: 15210, endMs: 15550, confidence: 0.99, speakerLabel: "B" },
          { text: "number", startMs: 15560, endMs: 15900, confidence: 0.98, speakerLabel: "B" },
        ],
      },
      {
        utteranceIndex: 4,
        speakerLabel: "A",
        startMs: 19000,
        endMs: 25300,
        text: "Thank you for confirming. May I place you on a brief hold for about one minute while I check the router configuration?",
        confidence: 0.97,
        words: [
          { text: "Thank", startMs: 19000, endMs: 19300, confidence: 0.99, speakerLabel: "A" },
          { text: "you", startMs: 19310, endMs: 19450, confidence: 0.99, speakerLabel: "A" },
        ],
      },
    ];

    const fullText = utterances.map((u) => u.text).join(" ");
    return {
      provider: this.name,
      providerTranscriptId,
      language: "en",
      confidence: 0.97,
      audioDurationMs: 27200,
      fullText,
      utterances,
      requiresTranscriptReview: false,
    };
  }
}
