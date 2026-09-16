import { NormalizedUtterance, SpeakerRole } from "@/lib/providers/transcription/types";

export interface SpeakerRoleMappingResult {
  mappedUtterances: NormalizedUtterance[];
  speakerRoles: Record<string, { role: SpeakerRole; confidence: number; rationale: string }>;
  requiresSpeakerReview: boolean;
  reviewReason?: string;
}

/**
 * Heuristic multi-signal speaker role mapper.
 * Specification Sections 24, 25, 26, 27, 28
 */
export class SpeakerRoleMapper {
  /**
   * Evaluates dialogue utterances and maps generic speaker labels (e.g. 'A', 'B')
   * to semantic roles ('AGENT', 'CUSTOMER', 'UNKNOWN').
   */
  static mapRoles(
    utterances: NormalizedUtterance[],
    agentName?: string
  ): SpeakerRoleMappingResult {
    if (utterances.length === 0) {
      return {
        mappedUtterances: [],
        speakerRoles: {},
        requiresSpeakerReview: true,
        reviewReason: "EMPTY_TRANSCRIPT",
      };
    }

    // Tally signals for each generic speaker label
    const speakerScores: Record<
      string,
      { agentSignals: number; customerSignals: number; rationales: string[] }
    > = {};

    const uniqueSpeakers = Array.from(new Set(utterances.map((u) => u.speakerLabel)));
    uniqueSpeakers.forEach((spk) => {
      speakerScores[spk] = { agentSignals: 0, customerSignals: 0, rationales: [] };
    });

    const agentFirstWords = agentName ? agentName.toLowerCase().split(" ") : [];

    // Analyze early utterances (first 6 utterances contain greetings & identification)
    const earlyUtterances = utterances.slice(0, 6);

    for (const u of earlyUtterances) {
      const lower = u.text.toLowerCase();
      const spk = u.speakerLabel;

      // 1. Support Greeting & Company introduction
      if (
        lower.includes("thank you for calling") ||
        lower.includes("how may i help") ||
        lower.includes("how may i assist") ||
        lower.includes("welcome to smile") ||
        lower.includes("my name is")
      ) {
        speakerScores[spk].agentSignals += 4;
        speakerScores[spk].rationales.push("Delivered company greeting / self-introduction.");
      }

      // 2. Specific agent name match
      if (agentFirstWords.some((w) => w.length > 2 && lower.includes(w))) {
        speakerScores[spk].agentSignals += 5;
        speakerScores[spk].rationales.push(`Mentioned agent name '${agentName}'.`);
      }

      // 3. Verification & Hold language (classic agent behavior)
      if (
        lower.includes("for security and verification") ||
        lower.includes("place you on a brief hold") ||
        lower.includes("may i have your account") ||
        lower.includes("may i please have your")
      ) {
        speakerScores[spk].agentSignals += 3;
        speakerScores[spk].rationales.push("Requested security verification / hold permission.");
      }

      // 4. Customer problem language
      if (
        lower.includes("my internet") ||
        lower.includes("not working") ||
        lower.includes("stopped working") ||
        lower.includes("my router") ||
        lower.includes("i have an issue") ||
        lower.includes("i want to recharge") ||
        lower.includes("data isn't working") ||
        lower.includes("i am calling about")
      ) {
        speakerScores[spk].customerSignals += 4;
        speakerScores[spk].rationales.push("Stated customer inquiry or service issue.");
      }
    }

    const speakerRoles: Record<string, { role: SpeakerRole; confidence: number; rationale: string }> = {};
    let requiresSpeakerReview = false;
    let reviewReason: string | undefined = undefined;

    // Check for standard two-speaker dialog
    if (uniqueSpeakers.length === 2) {
      const [spk1, spk2] = uniqueSpeakers;
      const s1 = speakerScores[spk1];
      const s2 = speakerScores[spk2];

      const spk1AgentScore = s1.agentSignals - s1.customerSignals;
      const spk2AgentScore = s2.agentSignals - s2.customerSignals;

      if (spk1AgentScore > spk2AgentScore && spk1AgentScore >= 3) {
        speakerRoles[spk1] = {
          role: "AGENT",
          confidence: 0.95,
          rationale: s1.rationales.join(" ") || "Opening greeting identified as agent.",
        };
        speakerRoles[spk2] = {
          role: "CUSTOMER",
          confidence: 0.92,
          rationale: s2.rationales.join(" ") || "Inquiry context identified as customer.",
        };
      } else if (spk2AgentScore > spk1AgentScore && spk2AgentScore >= 3) {
        speakerRoles[spk2] = {
          role: "AGENT",
          confidence: 0.95,
          rationale: s2.rationales.join(" ") || "Opening greeting identified as agent.",
        };
        speakerRoles[spk1] = {
          role: "CUSTOMER",
          confidence: 0.92,
          rationale: s1.rationales.join(" ") || "Inquiry context identified as customer.",
        };
      } else {
        // Ambiguous conversation: flag for supervisor review!
        requiresSpeakerReview = true;
        reviewReason = "SPEAKER_MAPPING_UNCERTAIN";
        speakerRoles[spk1] = {
          role: "UNKNOWN",
          confidence: 0.5,
          rationale: "Ambiguous dialogue signals. Supervisor confirmation required.",
        };
        speakerRoles[spk2] = {
          role: "UNKNOWN",
          confidence: 0.5,
          rationale: "Ambiguous dialogue signals. Supervisor confirmation required.",
        };
      }
    } else if (uniqueSpeakers.length > 2) {
      // More than 2 speakers (IVR, transfer agent, or supervisor join)
      requiresSpeakerReview = true;
      reviewReason = "TOO_MANY_SPEAKERS";
      uniqueSpeakers.forEach((spk) => {
        speakerRoles[spk] = {
          role: "UNKNOWN",
          confidence: 0.4,
          rationale: "Multi-party call detected. Supervisor verification required.",
        };
      });
    } else {
      // Single speaker only
      requiresSpeakerReview = true;
      reviewReason = "SINGLE_SPEAKER_RECORDING";
      speakerRoles[uniqueSpeakers[0]] = {
        role: "UNKNOWN",
        confidence: 0.3,
        rationale: "Only one speaker detected on call recording.",
      };
    }

    // Apply mappings to all utterances without touching original speakerLabel
    const mappedUtterances = utterances.map((u) => {
      const mapping = speakerRoles[u.speakerLabel];
      return {
        ...u,
        speakerRole: mapping?.role || "UNKNOWN",
        speakerRoleConfidence: mapping?.confidence || 0.5,
      };
    });

    return {
      mappedUtterances,
      speakerRoles,
      requiresSpeakerReview,
      reviewReason,
    };
  }
}
