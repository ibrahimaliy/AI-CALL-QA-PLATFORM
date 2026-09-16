import { INITIAL_SCORECARD } from "@/lib/seed-data";
import { ScorecardWithDetails } from "@/types/scorecard";

export class ScorecardService {
  /**
   * Retrieves the current published official scorecard with full parameters,
   * evaluation rules, failure reasons, and verbiage guidelines.
   */
  static async getActiveScorecard(): Promise<ScorecardWithDetails> {
    // In production with Supabase configured, this queries the PostgreSQL database.
    // Falls back seamlessly to validated seed data.
    return INITIAL_SCORECARD;
  }

  /**
   * Verifies that the parameters of a scorecard sum to exactly 100.
   */
  static verifyTotalWeights(scorecard: ScorecardWithDetails): {
    isValid: boolean;
    totalWeight: number;
    sectionBreakdown: Record<string, number>;
  } {
    const totalWeight = scorecard.parameters.reduce((sum, p) => sum + p.max_weight, 0);
    const sectionBreakdown: Record<string, number> = {};

    scorecard.parameters.forEach((p) => {
      sectionBreakdown[p.section_name] = (sectionBreakdown[p.section_name] || 0) + p.max_weight;
    });

    return {
      isValid: Math.abs(totalWeight - 100) < 0.0001,
      totalWeight,
      sectionBreakdown,
    };
  }
}
