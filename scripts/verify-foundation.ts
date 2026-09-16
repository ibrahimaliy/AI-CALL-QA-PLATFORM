import { INITIAL_SCORECARD } from "../src/lib/seed-data";
import { ScorecardDefinitionSchema } from "../src/schemas/scorecard.schema";
import { calculateScorecardResult } from "../src/services/scoring/calculator";

console.log("==================================================");
console.log("AI CALL QA PLATFORM - FOUNDATION VERIFICATION TEST");
console.log("==================================================");

// 1. Verify 10 Parameters and weights
const params = INITIAL_SCORECARD.parameters;
console.log(`\n1. Checking parameters count: ${params.length} parameters found.`);
if (params.length !== 10) {
  throw new Error(`Expected exactly 10 parameters, found ${params.length}`);
}

const totalWeight = params.reduce((sum, p) => sum + p.max_weight, 0);
console.log(`2. Checking total weight: ${totalWeight.toFixed(2)}`);
if (Math.abs(totalWeight - 100) > 0.0001) {
  throw new Error(`Total weight does not equal 100! Found ${totalWeight}`);
}
console.log("   -> PASS: Weights total exactly 100.00!");

// Section totals breakdown
const sectionTotals: Record<string, number> = {};
params.forEach((p) => {
  sectionTotals[p.section_name] = (sectionTotals[p.section_name] || 0) + p.max_weight;
});
console.log("\n3. Section Totals Verification:");
Object.entries(sectionTotals).forEach(([sec, w]) => {
  console.log(`   - ${sec}: ${w} points`);
});

// Check expected section sums from Section 4:
// Greeting and Procedures = 14
// Call Courtesy = 28
// Issue Identification = 23
// Issue Resolution = 26
// Call Ticketing and Escalation = 9
const expectedSections: Record<string, number> = {
  "Greeting and Procedures": 14,
  "Call Courtesy": 28,
  "Issue Identification": 23,
  "Issue Resolution": 26,
  "Call Ticketing and Escalation": 9,
};

for (const [sec, expected] of Object.entries(expectedSections)) {
  if (sectionTotals[sec] !== expected) {
    throw new Error(`Section ${sec} expected ${expected} points, got ${sectionTotals[sec]}`);
  }
}
console.log("   -> PASS: All 5 sections match exact specification weights!");

// 4. Verify Failure Reasons and Verbiage
const totalFailureReasons = params.reduce((sum, p) => sum + (p.failure_reasons?.length || 0), 0);
console.log(`\n4. Failure Reasons: ${totalFailureReasons} failure reasons defined across 10 parameters.`);
if (totalFailureReasons < 30) {
  throw new Error(`Expected at least 30 failure reasons, found ${totalFailureReasons}`);
}
console.log("   -> PASS: Complete failure reason legend imported.");

console.log(`\n5. Verbiage Guidelines: ${INITIAL_SCORECARD.verbiage_guidelines.length} categories defined.`);
if (INITIAL_SCORECARD.verbiage_guidelines.length !== 7) {
  throw new Error(`Expected 7 verbiage guidelines, found ${INITIAL_SCORECARD.verbiage_guidelines.length}`);
}
console.log("   -> PASS: All 7 required verbiage guidelines imported.");

// 6. Test Zod Schema
console.log("\n6. Validating scorecard against Zod ScorecardDefinitionSchema...");
const parseResult = ScorecardDefinitionSchema.safeParse(INITIAL_SCORECARD);
if (!parseResult.success) {
  console.error(parseResult.error.format());
  throw new Error("Zod validation failed for initial scorecard!");
}
console.log("   -> PASS: Zod validation succeeded.");

// 7. Test Deterministic Scoring Calculator (Section 24 Example: 76 points auditable, 65 points awarded -> 85.5% provisional)
console.log("\n7. Testing deterministic score calculation engine (Section 24 specification scenario)...");
const sampleInputs = [
  // Greeting and Procedures (14 auditable)
  {
    parameterId: params[0].id,
    maxWeight: 4,
    awardedPoints: 4,
    result: "PASS" as const,
    auditSource: "TRANSCRIPT" as const,
    requiresHumanReview: false,
  },
  {
    parameterId: params[1].id,
    maxWeight: 10,
    awardedPoints: 10,
    result: "PASS" as const,
    auditSource: "HYBRID" as const,
    requiresHumanReview: false,
  },
  // Call Courtesy (28 auditable)
  {
    parameterId: params[2].id,
    maxWeight: 10,
    awardedPoints: 8,
    result: "PARTIAL" as const,
    auditSource: "AUDIO" as const,
    requiresHumanReview: false,
  },
  {
    parameterId: params[3].id,
    maxWeight: 8,
    awardedPoints: 7,
    result: "PARTIAL" as const,
    auditSource: "AUDIO" as const,
    requiresHumanReview: false,
  },
  {
    parameterId: params[4].id,
    maxWeight: 10,
    awardedPoints: 7,
    result: "PARTIAL" as const,
    auditSource: "AUDIO" as const,
    requiresHumanReview: false,
  },
  // Issue Identification: Listening (8) + Probing (15) = 23 (Audited points = 7 + 12 = 19)
  {
    parameterId: params[5].id,
    maxWeight: 8,
    awardedPoints: 7,
    result: "PARTIAL" as const,
    auditSource: "AUDIO" as const,
    requiresHumanReview: false,
  },
  {
    parameterId: params[6].id,
    maxWeight: 15,
    awardedPoints: 12,
    result: "PARTIAL" as const,
    auditSource: "TRANSCRIPT" as const,
    requiresHumanReview: false,
  },
  // Issue Resolution: Completeness (11) - Audited = 10
  // Total auditable = 14 + 28 + 23 + 11 = 76 points!
  // Total awarded = 4 + 10 + 8 + 7 + 7 + 7 + 12 + 10 = 65 points!
  {
    parameterId: params[8].id,
    maxWeight: 11,
    awardedPoints: 10,
    result: "PARTIAL" as const,
    auditSource: "TRANSCRIPT" as const,
    requiresHumanReview: false,
  },
  // Remaining 24 points: Accurate Resolution (15) and CRM (9) require external review
  {
    parameterId: params[7].id,
    maxWeight: 15,
    awardedPoints: 0,
    result: "REVIEW_REQUIRED" as const,
    auditSource: "HYBRID" as const,
    requiresHumanReview: true,
  },
  {
    parameterId: params[9].id,
    maxWeight: 9,
    awardedPoints: 0,
    result: "REVIEW_REQUIRED" as const,
    auditSource: "CRM" as const,
    requiresHumanReview: true,
  },
];

const scoring = calculateScorecardResult(sampleInputs, 71.0, 100.0);
console.log(`   Audited Score: ${scoring.auditedScore}`);
console.log(`   Auditable Weight: ${scoring.auditableWeight}`);
console.log(`   Provisional Percentage: ${scoring.provisionalPercentage}%`);
console.log(`   Requires Human Review: ${scoring.requiresHumanReview}`);
console.log(`   Final Score: ${scoring.finalScore} (null when pending review)`);
console.log(`   Summary: "${scoring.summaryText}"`);

if (scoring.auditableWeight !== 76 || scoring.auditedScore !== 65 || scoring.provisionalPercentage !== 85.53) {
  throw new Error(`Scoring calculation did not match expected Section 24 scenario! Got: ${JSON.stringify(scoring)}`);
}
console.log("   -> PASS: Deterministic score calculation exactly matches Section 24 specification!");

console.log("\n==================================================");
console.log("ALL 7 FOUNDATION VERIFICATION CHECKS PASSED!");
console.log("==================================================");
