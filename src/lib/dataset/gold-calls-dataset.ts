import { CallRecord, AuditResultType } from "@/types/scorecard";
import { StoredTranscript } from "@/services/transcription/transcription.service";
import { NormalizedUtterance } from "@/lib/providers/transcription/types";
import { StoredAudit } from "@/services/auditing/audit.service";
import {
  StoredAuditReview,
  StoredAuditResultOverride,
  QAGoldLabel,
  CalibrationDataset,
  OverrideReasonCategory,
  HumanEvaluationSource,
} from "@/types/review";
import { StoredAuditParameterResult } from "@/lib/store/global-store";
import { INITIAL_ORGANIZATION, INITIAL_CAMPAIGN, INITIAL_AGENT, INITIAL_SCORECARD } from "@/lib/seed-data";

export const SYNTHETIC_TELECOM_BENCHMARK_DATASET_ID = "ds-synth-0000-0000-0000-000000000001";

export const SYNTHETIC_TELECOM_BENCHMARK_V1: CalibrationDataset = {
  id: SYNTHETIC_TELECOM_BENCHMARK_DATASET_ID,
  organization_id: INITIAL_ORGANIZATION.id,
  name: "Synthetic Telecom Benchmark V1",
  version: "1.0.0",
  description: "Initial synthetic telecom customer support benchmark dataset (10 simulated calls covering greetings, probing, resolution, and edge cases)",
  dataset_source_type: "SYNTHETIC",
  status: "FROZEN",
  min_sample_size: 50,
  created_at: "2026-09-10T12:00:00Z",
  frozen_at: "2026-09-10T12:00:00Z",
};

export interface GoldBenchmarkCallItem {
  call: CallRecord;
  transcript: StoredTranscript;
  utterances: NormalizedUtterance[];
  audit: StoredAudit;
  review: StoredAuditReview;
  goldLabels: QAGoldLabel[];
}

export const GOLD_BENCHMARK_DATASET: GoldBenchmarkCallItem[] = [
  // 1. Excellent Performance (Clean Pass Across All Criteria)
  createBenchmarkCall({
    index: 1,
    callId: "c1000000-0000-0000-0000-000000000011",
    scenario: "Excellent Customer Experience & First Contact Resolution",
    agentName: "Olabiyi Boluwatife Precious",
    customerPhone: "*9121",
    issueType: "Data Bundle Activation",
    durationSeconds: 198,
    utterancesData: [
      { role: "AGENT", text: "Good morning! Thank you for calling Smile Telecom. My name is Boluwatife. How may I assist you today?" },
      { role: "CUSTOMER", text: "Good morning Boluwatife. I recharged 50GB on my router yesterday but the data balance hasn't reflected." },
      { role: "AGENT", text: "I understand how frustrating that can be when you need connection. May I have your registered phone number and account ID to investigate?" },
      { role: "CUSTOMER", text: "Sure, my number is 07020201122 and account ID is SMILE-48201." },
      { role: "AGENT", text: "Thank you Andrea. Please allow me one minute while I check your payment and account status." },
      { role: "AGENT", text: "Thank you for holding. I can confirm the payment went through and I have manually provisioned the 50GB bundle. Could you restart your router now?" },
      { role: "CUSTOMER", text: "Let me check... Wow, yes! The LTE light just turned green and I see the 50GB active. Thank you!" },
      { role: "AGENT", text: "You are very welcome Andrea. Is there any other query I can assist you with today? Thank you for choosing Smile Telecom, have a wonderful day!" },
    ],
    aiFindings: [
      { paramName: "Adherence to greeting/welcome verbiage", result: "PASS", points: 4, conf: 0.98, code: undefined, reason: "Opening adhered fully to branded greeting and hold etiquette.", ev: ["U0001", "U0005"] },
      { paramName: "Effective Probing", result: "PASS", points: 15, conf: 0.95, code: undefined, reason: "Agent verified account identifiers and payment status effectively.", ev: ["U0003"] },
      { paramName: "Completeness of Resolution", result: "PASS", points: 11, conf: 0.96, code: undefined, reason: "Bundle was provisioned and customer confirmed real-time connectivity.", ev: ["U0006", "U0007"] },
    ],
    humanDecisions: [
      { paramName: "Adherence to greeting/welcome verbiage", action: "AGREED", result: "PASS", points: 4, evAccuracy: "CORRECT" },
      { paramName: "Effective Probing", action: "AGREED", result: "PASS", points: 15, evAccuracy: "CORRECT" },
      { paramName: "Completeness of Resolution", action: "AGREED", result: "PASS", points: 11, evAccuracy: "CORRECT" },
      { paramName: "Security Checks", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_HYBRID" },
      { paramName: "Politeness and Courtesy", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Enthusiasm", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Communication Skills", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Listening Skills", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Accurate Resolution", action: "AGREED", result: "PASS", points: 15, source: "HUMAN_HYBRID" },
      { paramName: "CRM Accuracy & Completeness", action: "AGREED", result: "PASS", points: 9, source: "HUMAN_CRM", crm: true, jira: true },
    ],
  }),

  // 2. Failed Greeting (Skipped company name and agent name)
  createBenchmarkCall({
    index: 2,
    callId: "c1000000-0000-0000-0000-000000000012",
    scenario: "Failed Opening Greeting & Identity Procedure",
    agentName: "Olabiyi Boluwatife Precious",
    customerPhone: "*4421",
    issueType: "Billing Dispute",
    durationSeconds: 154,
    utterancesData: [
      { role: "AGENT", text: "Hello, yeah, what's your issue?" },
      { role: "CUSTOMER", text: "Hello, I was charged twice for my monthly renewal." },
      { role: "AGENT", text: "Okay, what is your phone number and transaction reference?" },
      { role: "CUSTOMER", text: "My number is 08033221100, reference TX-99201." },
      { role: "AGENT", text: "Hold on let me look it up. Yes, duplicate charge detected. I have initiated a refund of 10,000 Naira to your card." },
      { role: "CUSTOMER", text: "Great, how long will it take?" },
      { role: "AGENT", text: "24 to 48 hours. Bye." },
    ],
    aiFindings: [
      { paramName: "Adherence to greeting/welcome verbiage", result: "FAIL", points: 0, conf: 0.96, code: "DID_NOT_ADHERE_TO_VERBIAGE", reason: "Agent omitted company name, agent name, and standard greeting verbiage.", ev: ["U0001"] },
      { paramName: "Effective Probing", result: "PASS", points: 15, conf: 0.92, code: undefined, reason: "Agent obtained transaction reference and phone number.", ev: ["U0003"] },
      { paramName: "Completeness of Resolution", result: "PASS", points: 11, conf: 0.94, code: undefined, reason: "Duplicate charge identified and refund initiated with SLA.", ev: ["U0005", "U0007"] },
    ],
    humanDecisions: [
      { paramName: "Adherence to greeting/welcome verbiage", action: "AGREED", result: "FAIL", points: 0, failReason: "DID_NOT_ADHERE_TO_VERBIAGE", evAccuracy: "CORRECT" },
      { paramName: "Effective Probing", action: "AGREED", result: "PASS", points: 15, evAccuracy: "CORRECT" },
      { paramName: "Completeness of Resolution", action: "AGREED", result: "PASS", points: 11, evAccuracy: "CORRECT" },
      { paramName: "Security Checks", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_HYBRID" },
      { paramName: "Politeness and Courtesy", action: "OVERRIDDEN", result: "FAIL", points: 0, failReason: "IMPATIENT_BEHAVIOR", cat: "QA_RULE_INTERPRETATION", notes: "Abrupt opening and closing with no courtesy phrases.", source: "HUMAN_AUDIO" },
      { paramName: "Enthusiasm", action: "OVERRIDDEN", result: "FAIL", points: 0, failReason: "DULL_VOICE", cat: "QA_RULE_INTERPRETATION", notes: "Flat, indifferent vocal delivery.", source: "HUMAN_AUDIO" },
      { paramName: "Communication Skills", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Listening Skills", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Accurate Resolution", action: "AGREED", result: "PASS", points: 15, source: "HUMAN_HYBRID" },
      { paramName: "CRM Accuracy & Completeness", action: "AGREED", result: "PASS", points: 9, source: "HUMAN_CRM", crm: true, jira: true },
    ],
  }),

  // 3. Poor Probing (Jumped to router reboot without asking symptoms)
  createBenchmarkCall({
    index: 3,
    callId: "c1000000-0000-0000-0000-000000000013",
    scenario: "Poor Probing & Premature Hold",
    agentName: "Olabiyi Boluwatife Precious",
    customerPhone: "*7710",
    issueType: "Internet Connectivity",
    durationSeconds: 140,
    utterancesData: [
      { role: "AGENT", text: "Good afternoon, thank you for calling Smile Telecom. My name is Boluwatife. How may I help you?" },
      { role: "CUSTOMER", text: "My internet is completely down since morning." },
      { role: "AGENT", text: "Okay, just turn off your router and turn it on again." },
      { role: "CUSTOMER", text: "I already did that three times before calling you. It didn't work." },
      { role: "AGENT", text: "Hold on let me reboot your port from here." },
      { role: "AGENT", text: "Okay I rebooted it. Check now." },
      { role: "CUSTOMER", text: "Still nothing. The red power light is blinking." },
      { role: "AGENT", text: "Oh, blinking red power means adapter failure. You need a replacement adapter." },
    ],
    aiFindings: [
      { paramName: "Adherence to greeting/welcome verbiage", result: "PASS", points: 4, conf: 0.97, code: undefined, reason: "Proper greeting delivered.", ev: ["U0001"] },
      { paramName: "Effective Probing", result: "FAIL", points: 0, conf: 0.94, code: "POOR_PROBING", reason: "Agent jumped to conclusions without probing router light indicators or connection symptoms.", ev: ["U0003"] },
      { paramName: "Completeness of Resolution", result: "PASS", points: 11, conf: 0.88, code: undefined, reason: "Root cause identified after customer reported hardware light.", ev: ["U0008"] },
    ],
    humanDecisions: [
      { paramName: "Adherence to greeting/welcome verbiage", action: "AGREED", result: "PASS", points: 4, evAccuracy: "CORRECT" },
      { paramName: "Effective Probing", action: "AGREED", result: "FAIL", points: 0, failReason: "POOR_PROBING", evAccuracy: "CORRECT" },
      { paramName: "Completeness of Resolution", action: "AGREED", result: "PASS", points: 11, evAccuracy: "CORRECT" },
      { paramName: "Security Checks", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_HYBRID" },
      { paramName: "Politeness and Courtesy", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Enthusiasm", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Communication Skills", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Listening Skills", action: "OVERRIDDEN", result: "FAIL", points: 0, failReason: "INTERRUPTING_CUSTOMER", cat: "QA_RULE_INTERPRETATION", notes: "Did not listen to customer statement that reboot was already tried.", source: "HUMAN_AUDIO" },
      { paramName: "Accurate Resolution", action: "AGREED", result: "PASS", points: 15, source: "HUMAN_HYBRID" },
      { paramName: "CRM Accuracy & Completeness", action: "AGREED", result: "PASS", points: 9, source: "HUMAN_CRM", crm: true, jira: true },
    ],
  }),

  // 4. Incomplete Resolution (Hold expired, issue left unaddressed)
  createBenchmarkCall({
    index: 4,
    callId: "c1000000-0000-0000-0000-000000000014",
    scenario: "Incomplete Resolution & Unresolved Query",
    agentName: "Olabiyi Boluwatife Precious",
    customerPhone: "*3345",
    issueType: "SIM Replacement",
    durationSeconds: 165,
    utterancesData: [
      { role: "AGENT", text: "Welcome to Smile Telecom, my name is Boluwatife. How can I help you today?" },
      { role: "CUSTOMER", text: "I lost my SIM card and need to get a replacement SIM today." },
      { role: "AGENT", text: "May I have your National Identity Number and the lost SIM number?" },
      { role: "CUSTOMER", text: "Yes, NIN is 99887766554, SIM is 07020203344." },
      { role: "AGENT", text: "Thank you. Let me check the SIM swap requirements. Please hold for one minute." },
      { role: "AGENT", text: "Thank you for waiting. Our portal is currently undergoing scheduled maintenance so I cannot generate the swap ticket right now. Please call back tomorrow." },
      { role: "CUSTOMER", text: "Tomorrow? But I need this line for work today. Can't I visit an outlet?" },
      { role: "AGENT", text: "No, portal is down everywhere. Thank you for calling Smile." },
    ],
    aiFindings: [
      { paramName: "Adherence to greeting/welcome verbiage", result: "PASS", points: 4, conf: 0.96, code: undefined, reason: "Standard greeting and hold protocol followed.", ev: ["U0001", "U0005"] },
      { paramName: "Effective Probing", result: "PASS", points: 15, conf: 0.94, code: undefined, reason: "Agent probed for NIN and SIM number.", ev: ["U0003"] },
      { paramName: "Completeness of Resolution", result: "FAIL", points: 0, conf: 0.97, code: "INCOMPLETE_RESOLUTION", reason: "Customer query was deferred without temporary workaround or outlet assistance.", ev: ["U0006", "U0008"] },
    ],
    humanDecisions: [
      { paramName: "Adherence to greeting/welcome verbiage", action: "AGREED", result: "PASS", points: 4, evAccuracy: "CORRECT" },
      { paramName: "Effective Probing", action: "AGREED", result: "PASS", points: 15, evAccuracy: "CORRECT" },
      { paramName: "Completeness of Resolution", action: "AGREED", result: "FAIL", points: 0, failReason: "INCOMPLETE_RESOLUTION", evAccuracy: "CORRECT" },
      { paramName: "Security Checks", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_HYBRID" },
      { paramName: "Politeness and Courtesy", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Enthusiasm", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Communication Skills", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Listening Skills", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Accurate Resolution", action: "OVERRIDDEN", result: "FAIL", points: 0, failReason: "INCORRECT_INFORMATION", cat: "QA_RULE_INTERPRETATION", notes: "Outlets have offline swap forms; advice to wait for tomorrow was inaccurate.", source: "HUMAN_HYBRID" },
      { paramName: "CRM Accuracy & Completeness", action: "AGREED", result: "PASS", points: 9, source: "HUMAN_CRM", crm: true, jira: true },
    ],
  }),

  // 5. Rude / Lack of Courtesy (Audio Criteria Failure)
  createBenchmarkCall({
    index: 5,
    callId: "c1000000-0000-0000-0000-000000000015",
    scenario: "Unprofessional Tone & Courtesy Breakdown",
    agentName: "Olabiyi Boluwatife Precious",
    customerPhone: "*5561",
    issueType: "Slow Speed Inquiry",
    durationSeconds: 145,
    utterancesData: [
      { role: "AGENT", text: "Good morning, thank you for calling Smile Telecom. My name is Boluwatife. How may I assist you?" },
      { role: "CUSTOMER", text: "Look, my 4G speed has been terribly slow all morning. What is going on?" },
      { role: "AGENT", text: "If speed is slow it is because you exhausted your high-speed quota, obviously." },
      { role: "CUSTOMER", text: "I bought unlimited data two days ago! Don't tell me it's obvious." },
      { role: "AGENT", text: "Give me your account number let me see." },
      { role: "CUSTOMER", text: "Account 099201." },
      { role: "AGENT", text: "Fair usage policy applies after 100GB. You used 105GB. So it throttled. That is the policy." },
    ],
    aiFindings: [
      { paramName: "Adherence to greeting/welcome verbiage", result: "PASS", points: 4, conf: 0.95, code: undefined, reason: "Transcript text contained standard opening greeting.", ev: ["U0001"] },
      { paramName: "Effective Probing", result: "PASS", points: 15, conf: 0.90, code: undefined, reason: "Agent verified account number and usage breakdown.", ev: ["U0005", "U0007"] },
      { paramName: "Completeness of Resolution", result: "PASS", points: 11, conf: 0.92, code: undefined, reason: "Policy throttling explained to customer.", ev: ["U0007"] },
    ],
    humanDecisions: [
      { paramName: "Adherence to greeting/welcome verbiage", action: "AGREED", result: "PASS", points: 4, evAccuracy: "CORRECT" },
      { paramName: "Effective Probing", action: "AGREED", result: "PASS", points: 15, evAccuracy: "CORRECT" },
      { paramName: "Completeness of Resolution", action: "AGREED", result: "PASS", points: 11, evAccuracy: "CORRECT" },
      { paramName: "Security Checks", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_HYBRID" },
      { paramName: "Politeness and Courtesy", action: "OVERRIDDEN", result: "FAIL", points: 0, failReason: "ARGUMENTATIVE_ATTITUDE", cat: "QA_RULE_INTERPRETATION", notes: "Condescending tone: 'obviously'. Failed empathy on customer frustration.", source: "HUMAN_AUDIO" },
      { paramName: "Enthusiasm", action: "OVERRIDDEN", result: "FAIL", points: 0, failReason: "DULL_VOICE", cat: "QA_RULE_INTERPRETATION", notes: "Hostile acoustic tone.", source: "HUMAN_AUDIO" },
      { paramName: "Communication Skills", action: "OVERRIDDEN", result: "FAIL", points: 0, failReason: "POOR_ENUNCIATION", cat: "QA_RULE_INTERPRETATION", notes: "Aggressive inflection and lack of professional composure.", source: "HUMAN_AUDIO" },
      { paramName: "Listening Skills", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Accurate Resolution", action: "AGREED", result: "PASS", points: 15, source: "HUMAN_HYBRID" },
      { paramName: "CRM Accuracy & Completeness", action: "AGREED", result: "PASS", points: 9, source: "HUMAN_CRM", crm: true, jira: true },
    ],
  }),

  // 6. Security Verification Failure (Hybrid Criteria Failure)
  createBenchmarkCall({
    index: 6,
    callId: "c1000000-0000-0000-0000-000000000016",
    scenario: "Security Protocol Breach on Call",
    agentName: "Olabiyi Boluwatife Precious",
    customerPhone: "*2288",
    issueType: "Password Reset",
    durationSeconds: 120,
    utterancesData: [
      { role: "AGENT", text: "Good morning, thank you for calling Smile Telecom. My name is Boluwatife. How can I help you?" },
      { role: "CUSTOMER", text: "Hello, I am locked out of my portal account and need a password reset." },
      { role: "AGENT", text: "What is your email address?" },
      { role: "CUSTOMER", text: "It's ceo@apexcorporation.com." },
      { role: "AGENT", text: "Okay, I have reset your portal password to Smile1234. You can log in now." },
      { role: "CUSTOMER", text: "Thank you so much!" },
    ],
    aiFindings: [
      { paramName: "Adherence to greeting/welcome verbiage", result: "PASS", points: 4, conf: 0.98, code: undefined, reason: "Proper greeting verbiage adhered to.", ev: ["U0001"] },
      { paramName: "Effective Probing", result: "PASS", points: 15, conf: 0.91, code: undefined, reason: "Agent obtained target email address.", ev: ["U0003"] },
      { paramName: "Completeness of Resolution", result: "PASS", points: 11, conf: 0.93, code: undefined, reason: "Password was reset as requested.", ev: ["U0005"] },
    ],
    humanDecisions: [
      { paramName: "Adherence to greeting/welcome verbiage", action: "AGREED", result: "PASS", points: 4, evAccuracy: "CORRECT" },
      { paramName: "Effective Probing", action: "AGREED", result: "PASS", points: 15, evAccuracy: "CORRECT" },
      { paramName: "Completeness of Resolution", action: "AGREED", result: "PASS", points: 11, evAccuracy: "CORRECT" },
      { paramName: "Security Checks", action: "OVERRIDDEN", result: "FAIL", points: 0, failReason: "SKIPPED_AUTHENTICATION", cat: "QA_RULE_INTERPRETATION", notes: "Severe security breach: Password reset performed without OTP, NIN, or security question verification.", source: "HUMAN_HYBRID" },
      { paramName: "Politeness and Courtesy", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Enthusiasm", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Communication Skills", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Listening Skills", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Accurate Resolution", action: "OVERRIDDEN", result: "FAIL", points: 0, failReason: "PROCESS_VIOLATION", cat: "QA_RULE_INTERPRETATION", notes: "Violation of mandatory corporate security SOP.", source: "HUMAN_HYBRID" },
      { paramName: "CRM Accuracy & Completeness", action: "AGREED", result: "PASS", points: 9, source: "HUMAN_CRM", crm: true, jira: true },
    ],
  }),

  // 7. CRM Discrepancy & Missing Ticket (CRM Failure)
  createBenchmarkCall({
    index: 7,
    callId: "c1000000-0000-0000-0000-000000000017",
    scenario: "Customer Escalation Without CRM Logging",
    agentName: "Olabiyi Boluwatife Precious",
    customerPhone: "*7733",
    issueType: "Coverage & Mast Downtime",
    durationSeconds: 180,
    utterancesData: [
      { role: "AGENT", text: "Good day, thank you for calling Smile Telecom. My name is Boluwatife. How may I help you?" },
      { role: "CUSTOMER", text: "Our entire street in Lekki Phase 1 has lost network signal for the past 6 hours." },
      { role: "AGENT", text: "May I have your exact street address and router serial number?" },
      { role: "CUSTOMER", text: "Admiralty Way, Lekki Phase 1. Router serial is SML-88392." },
      { role: "AGENT", text: "Thank you. I have confirmed there is a base transceiver station outage on Admiralty Way. Our field engineers are on site." },
      { role: "CUSTOMER", text: "Okay, please escalate my account so I get SMS updates." },
      { role: "AGENT", text: "Yes, I have noted that. You will receive updates once power is restored. Thank you for calling Smile." },
    ],
    aiFindings: [
      { paramName: "Adherence to greeting/welcome verbiage", result: "PASS", points: 4, conf: 0.97, code: undefined, reason: "Branded greeting used.", ev: ["U0001"] },
      { paramName: "Effective Probing", result: "PASS", points: 15, conf: 0.94, code: undefined, reason: "Address and hardware serial probed.", ev: ["U0003"] },
      { paramName: "Completeness of Resolution", result: "PASS", points: 11, conf: 0.92, code: undefined, reason: "Outage confirmed and customer notified of field restoration.", ev: ["U0005", "U0007"] },
    ],
    humanDecisions: [
      { paramName: "Adherence to greeting/welcome verbiage", action: "AGREED", result: "PASS", points: 4, evAccuracy: "CORRECT" },
      { paramName: "Effective Probing", action: "AGREED", result: "PASS", points: 15, evAccuracy: "CORRECT" },
      { paramName: "Completeness of Resolution", action: "AGREED", result: "PASS", points: 11, evAccuracy: "CORRECT" },
      { paramName: "Security Checks", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_HYBRID" },
      { paramName: "Politeness and Courtesy", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Enthusiasm", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Communication Skills", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Listening Skills", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Accurate Resolution", action: "AGREED", result: "PASS", points: 15, source: "HUMAN_HYBRID" },
      { paramName: "CRM Accuracy & Completeness", action: "OVERRIDDEN", result: "FAIL", points: 0, failReason: "FAILED_TO_LOG_TICKET", cat: "QA_RULE_INTERPRETATION", notes: "No CRM incident ticket was logged in JIRA/Salesforce despite promise of SMS updates.", source: "HUMAN_CRM", crm: false, jira: false },
    ],
  }),

  // 8. AI Overridden on Probing (AI Missed Evidence)
  createBenchmarkCall({
    index: 8,
    callId: "c1000000-0000-0000-0000-000000000018",
    scenario: "Effective Probing Overridden (AI False Negative)",
    agentName: "Olabiyi Boluwatife Precious",
    customerPhone: "*8812",
    issueType: "Slow Speeds",
    durationSeconds: 175,
    utterancesData: [
      { role: "AGENT", text: "Good morning, welcome to Smile Telecom customer service. My name is Boluwatife. How can I assist you today?" },
      { role: "CUSTOMER", text: "My internet has become super sluggish this afternoon." },
      { role: "AGENT", text: "What color is the signal bar light on the front panel of your modem right now?" },
      { role: "CUSTOMER", text: "It's showing yellow, usually it's blue." },
      { role: "AGENT", text: "Yellow indicates weak signal strength. Are you near a window or inside a thick room?" },
      { role: "CUSTOMER", text: "I moved it to the basement pantry this morning." },
      { role: "AGENT", text: "That explains it Andrea. Relocating the router to an elevated spot near the window will restore blue signal." },
    ],
    aiFindings: [
      { paramName: "Adherence to greeting/welcome verbiage", result: "PASS", points: 4, conf: 0.98, code: undefined, reason: "Complete opening greeting.", ev: ["U0001"] },
      { paramName: "Effective Probing", result: "FAIL", points: 0, conf: 0.72, code: "POOR_PROBING", reason: "AI falsely judged that agent failed to probe network quota or frequency band.", ev: ["U0003"] },
      { paramName: "Completeness of Resolution", result: "PASS", points: 11, conf: 0.95, code: undefined, reason: "Physical barrier diagnosis resolved the issue.", ev: ["U0007"] },
    ],
    humanDecisions: [
      { paramName: "Adherence to greeting/welcome verbiage", action: "AGREED", result: "PASS", points: 4, evAccuracy: "CORRECT" },
      { paramName: "Effective Probing", action: "OVERRIDDEN", result: "PASS", points: 15, cat: "AI_MISSED_EVIDENCE", notes: "AI missed that asking about modem LED color (U0003) and indoor placement (U0005) was exemplary physical layer probing.", evAccuracy: "INCORRECT" },
      { paramName: "Completeness of Resolution", action: "AGREED", result: "PASS", points: 11, evAccuracy: "CORRECT" },
      { paramName: "Security Checks", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_HYBRID" },
      { paramName: "Politeness and Courtesy", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Enthusiasm", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Communication Skills", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Listening Skills", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Accurate Resolution", action: "AGREED", result: "PASS", points: 15, source: "HUMAN_HYBRID" },
      { paramName: "CRM Accuracy & Completeness", action: "AGREED", result: "PASS", points: 9, source: "HUMAN_CRM", crm: true, jira: true },
    ],
  }),

  // 9. Ambiguous Interaction Handled Professionally
  createBenchmarkCall({
    index: 9,
    callId: "c1000000-0000-0000-0000-000000000019",
    scenario: "Ambiguous Customer Request Handled with Patience",
    agentName: "Olabiyi Boluwatife Precious",
    customerPhone: "*6609",
    issueType: "Multi-service Inquiry",
    durationSeconds: 210,
    utterancesData: [
      { role: "AGENT", text: "Good day, thank you for calling Smile Telecom. My name is Boluwatife. How may I be of help today?" },
      { role: "CUSTOMER", text: "I don't know what's wrong, my phone and my home box are both behaving strange." },
      { role: "AGENT", text: "No worries, let us take them one step at a time. Is the phone issue regarding voice calls or mobile data?" },
      { role: "CUSTOMER", text: "Mobile data. And the home box can't connect my TV." },
      { role: "AGENT", text: "Understood. For the mobile data, let us check your APN settings first. And for the home box, we will check the HDMI cable." },
      { role: "CUSTOMER", text: "Okay, the APN was set to internet, let me change to smile." },
      { role: "AGENT", text: "Perfect, mobile data is now working. Now for the TV box, please ensure the HDMI source is set to HDMI 1." },
      { role: "CUSTOMER", text: "Yes! The TV is streaming now. Thank you so much for your patience." },
    ],
    aiFindings: [
      { paramName: "Adherence to greeting/welcome verbiage", result: "PASS", points: 4, conf: 0.97, code: undefined, reason: "Branded welcome phrase delivered.", ev: ["U0001"] },
      { paramName: "Effective Probing", result: "PASS", points: 15, conf: 0.96, code: undefined, reason: "Disentangled multi-faceted problem into distinct technical probing branches.", ev: ["U0003", "U0005"] },
      { paramName: "Completeness of Resolution", result: "PASS", points: 11, conf: 0.97, code: undefined, reason: "Both mobile APN and home box HDMI issues were verified and confirmed working.", ev: ["U0007", "U0008"] },
    ],
    humanDecisions: [
      { paramName: "Adherence to greeting/welcome verbiage", action: "AGREED", result: "PASS", points: 4, evAccuracy: "CORRECT" },
      { paramName: "Effective Probing", action: "AGREED", result: "PASS", points: 15, evAccuracy: "CORRECT" },
      { paramName: "Completeness of Resolution", action: "AGREED", result: "PASS", points: 11, evAccuracy: "CORRECT" },
      { paramName: "Security Checks", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_HYBRID" },
      { paramName: "Politeness and Courtesy", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Enthusiasm", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Communication Skills", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Listening Skills", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Accurate Resolution", action: "AGREED", result: "PASS", points: 15, source: "HUMAN_HYBRID" },
      { paramName: "CRM Accuracy & Completeness", action: "AGREED", result: "PASS", points: 9, source: "HUMAN_CRM", crm: true, jira: true },
    ],
  }),

  // 10. AI Overridden on Greeting (Semantic Equivalence Accepted)
  createBenchmarkCall({
    index: 10,
    callId: "c1000000-0000-0000-0000-000000000020",
    scenario: "Greeting Semantic Equivalence Override",
    agentName: "Olabiyi Boluwatife Precious",
    customerPhone: "*1029",
    issueType: "Data Rollover Inquiry",
    durationSeconds: 135,
    utterancesData: [
      { role: "AGENT", text: "Hello and a very warm welcome to Smile Telecom! Boluwatife on the line, how can I make your day better?" },
      { role: "CUSTOMER", text: "Hi Boluwatife, does my remaining 12GB roll over if I renew my 30-day plan before midnight?" },
      { role: "AGENT", text: "Yes indeed! As long as you renew before 11:59 PM, all remaining gigabytes roll over into the new 30-day cycle." },
      { role: "CUSTOMER", text: "Awesome, I will do that right now on the app. Thanks!" },
      { role: "AGENT", text: "Glad to help Andrea! Have a fantastic evening." },
    ],
    aiFindings: [
      { paramName: "Adherence to greeting/welcome verbiage", result: "FAIL", points: 0, conf: 0.74, code: "DID_NOT_ADHERE_TO_VERBIAGE", reason: "Model flagged that 'Boluwatife on the line' deviated from strict suggested template 'My name is Boluwatife'.", ev: ["U0001"] },
      { paramName: "Effective Probing", result: "PASS", points: 15, conf: 0.91, code: undefined, reason: "Agent verified rollover conditions accurately.", ev: ["U0003"] },
      { paramName: "Completeness of Resolution", result: "PASS", points: 11, conf: 0.96, code: undefined, reason: "Rollover mechanism clearly confirmed.", ev: ["U0003", "U0005"] },
    ],
    humanDecisions: [
      { paramName: "Adherence to greeting/welcome verbiage", action: "OVERRIDDEN", result: "PASS", points: 4, cat: "QA_RULE_INTERPRETATION", notes: "The phrase 'Boluwatife on the line' and warm welcome is an approved semantic equivalent under guidelines Section 17.", evAccuracy: "INCORRECT" },
      { paramName: "Effective Probing", action: "AGREED", result: "PASS", points: 15, evAccuracy: "CORRECT" },
      { paramName: "Completeness of Resolution", action: "AGREED", result: "PASS", points: 11, evAccuracy: "CORRECT" },
      { paramName: "Security Checks", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_HYBRID" },
      { paramName: "Politeness and Courtesy", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Enthusiasm", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Communication Skills", action: "AGREED", result: "PASS", points: 10, source: "HUMAN_AUDIO" },
      { paramName: "Listening Skills", action: "AGREED", result: "PASS", points: 8, source: "HUMAN_AUDIO" },
      { paramName: "Accurate Resolution", action: "AGREED", result: "PASS", points: 15, source: "HUMAN_HYBRID" },
      { paramName: "CRM Accuracy & Completeness", action: "AGREED", result: "PASS", points: 9, source: "HUMAN_CRM", crm: true, jira: true },
    ],
  }),
];

// Helper to construct structured benchmark call
function createBenchmarkCall(config: {
  index: number;
  callId: string;
  scenario: string;
  agentName: string;
  customerPhone: string;
  issueType: string;
  durationSeconds: number;
  utterancesData: Array<{ role: "AGENT" | "CUSTOMER"; text: string }>;
  aiFindings: Array<{
    paramName: string;
    result: "PASS" | "FAIL" | "PARTIAL";
    points: number;
    conf: number;
    code?: string;
    reason: string;
    ev: string[];
  }>;
  humanDecisions: Array<{
    paramName: string;
    action: "AGREED" | "OVERRIDDEN";
    result: "PASS" | "FAIL" | "PARTIAL";
    points: number;
    failReason?: string;
    cat?: OverrideReasonCategory;
    notes?: string;
    evAccuracy?: "CORRECT" | "PARTIALLY_CORRECT" | "INCORRECT";
    source?: HumanEvaluationSource;
    crm?: boolean;
    jira?: boolean;
  }>;
}): GoldBenchmarkCallItem {
  const scorecard = INITIAL_SCORECARD;
  const now = "2026-09-10T12:00:00.000Z";

  const call: CallRecord = {
    id: config.callId,
    organization_id: INITIAL_ORGANIZATION.id,
    campaign_id: INITIAL_CAMPAIGN.id,
    agent_id: INITIAL_AGENT.id,
    scorecard_id: scorecard.id,
    external_call_id: `EXT-GOLD-${String(config.index).padStart(3, "0")}`,
    client_request_id: `req_gold_${config.index}`,
    jira_transaction_number: `SML-QA-${1000 + config.index}`,
    customer_phone_masked: config.customerPhone,
    interaction_date: "2026-09-10",
    interaction_time: `1${config.index}:30:00`,
    issue_type: config.issueType,
    query_count: 1,
    audio_storage_path: `${INITIAL_ORGANIZATION.id}/${INITIAL_CAMPAIGN.id}/${config.callId}/recording.mp3`,
    original_filename: `gold_call_${config.index}.mp3`,
    audio_content_type: "audio/mpeg",
    audio_size_bytes: config.durationSeconds * 16000,
    duration_seconds: config.durationSeconds,
    language: "en",
    processing_status: "COMPLETED",
    uploaded_at: now,
    created_at: now,
    updated_at: now,
    agent_name: config.agentName,
    campaign_name: INITIAL_CAMPAIGN.name,
    scorecard_name: scorecard.name,
  };

  const transcriptId = `tr-synth-${config.callId}`;
  const utterances: NormalizedUtterance[] = config.utterancesData.map((u, i) => {
    const startMs = i * 4000 + 800;
    const endMs = startMs + 3200;
    return {
      id: crypto.randomUUID(),
      utteranceIndex: i,
      speakerLabel: u.role === "AGENT" ? "A" : "B",
      speakerRole: u.role,
      speakerRoleConfidence: 0.98,
      startMs,
      endMs,
      text: u.text,
      confidence: 0.97,
    };
  });

  const transcript: StoredTranscript = {
    id: transcriptId,
    call_id: config.callId,
    version: 1,
    is_active: true,
    provider: "AssemblyAI",
    provider_transcript_id: `aai_gold_${config.index}`,
    full_text: utterances.map((u) => `${u.speakerRole}: ${u.text}`).join("\n"),
    language: "en",
    confidence: 0.97,
    audio_duration_ms: config.durationSeconds * 1000,
    requires_speaker_review: false,
    requires_transcript_review: false,
    created_at: now,
  };

  const auditId = crypto.randomUUID();
  const auditParameters: StoredAuditParameterResult[] = scorecard.parameters.map((param): StoredAuditParameterResult => {
    const aiF = config.aiFindings.find((f) => f.paramName === param.parameter_name);
    if (aiF) {
      return {
        id: crypto.randomUUID(),
        audit_id: auditId,
        parameter_id: param.id,
        parameter_name: param.parameter_name,
        section_name: param.section_name,
        max_weight: param.max_weight,
        awarded_points: aiF.result === "PASS" ? param.max_weight : 0,
        result: aiF.result,
        audit_source: param.audit_source,
        confidence: aiF.conf,
        reason: aiF.reason,
        failure_reason_code: aiF.code,
        requires_human_review: false,
        evidence: aiF.ev.map((pid) => ({
          id: crypto.randomUUID(),
          utterance_id: utterances[0].id!,
          prompt_id: pid,
          start_ms: 800,
          end_ms: 4000,
          speaker_role: "AGENT",
          quote_text: utterances[0].text,
        })),
      };
    } else {
      return {
        id: crypto.randomUUID(),
        audit_id: auditId,
        parameter_id: param.id,
        parameter_name: param.parameter_name,
        section_name: param.section_name,
        max_weight: param.max_weight,
        awarded_points: 0,
        result: "REVIEW_REQUIRED" as AuditResultType,
        audit_source: param.audit_source,
        reason: `Requires [${param.audit_source}] source.`,
        requires_human_review: true,
        evidence: [],
      };
    }
  });

  const aiAuditedWeight = 30.0;
  const aiAwardedPoints = auditParameters
    .filter((p) => p.audit_source === "TRANSCRIPT")
    .reduce((sum, p) => sum + p.awarded_points, 0);

  const audit: StoredAudit = {
    id: auditId,
    call_id: config.callId,
    scorecard_id: scorecard.id,
    scorecard_version: scorecard.version,
    ai_provider: "OPENAI",
    ai_model: "gpt-5.6-terra",
    prompt_version: "qa-audit-v1",
    auditable_weight: aiAuditedWeight,
    ai_awarded_points: aiAwardedPoints,
    ai_normalized_percentage: Number(((aiAwardedPoints / aiAuditedWeight) * 100).toFixed(2)),
    final_score: null,
    passing_score: scorecard.passing_score,
    is_passed: false,
    un_audited_weight: 70.0,
    status: "REVIEW_REQUIRED",
    summary: config.scenario,
    strengths: ["Standard identity check", "Active listening"],
    improvement_areas: ["Probing depth"],
    created_at: now,
    parameters: auditParameters,
  };

  const reviewId = crypto.randomUUID();
  const decisions: StoredAuditResultOverride[] = scorecard.parameters.map((param): StoredAuditResultOverride => {
    const aiF = auditParameters.find((p) => p.parameter_id === param.id);
    const hD = config.humanDecisions.find((d) => d.paramName === param.parameter_name)!;

    return {
      id: crypto.randomUUID(),
      review_id: reviewId,
      parameter_id: param.id,
      parameter_name: param.parameter_name,
      section_name: param.section_name,
      max_weight: param.max_weight,
      review_action: hD.action,
      ai_result: aiF?.result !== "REVIEW_REQUIRED" ? (aiF?.result as AuditResultType) : undefined,
      human_result: hD.result as AuditResultType,
      ai_awarded_points: aiF?.awarded_points || 0,
      human_awarded_points: hD.points,
      ai_failure_reason: aiF?.failure_reason_code,
      human_failure_reason: hD.failReason,
      override_reason_category: hD.cat,
      override_notes: hD.notes,
      ai_evidence_accuracy: hD.evAccuracy || "CORRECT",
      human_evidence_utterance_ids: [utterances[0].id!],
      evaluation_source: hD.source || "AI_TRANSCRIPT",
      crm_checked: hD.crm,
      jira_checked: hD.jira,
      created_at: now,
      updated_at: now,
    };
  });

  const finalScore = decisions.reduce((sum, d) => sum + d.human_awarded_points, 0);
  const isPassed = finalScore >= scorecard.passing_score;

  const review: StoredAuditReview = {
    id: reviewId,
    audit_id: auditId,
    call_id: config.callId,
    organization_id: INITIAL_ORGANIZATION.id,
    version: 2,
    reviewer_id: "u0000000-0000-0000-0000-000000000001",
    reviewer_name: "Ayinde Andrea",
    assigned_by: "u0000000-0000-0000-0000-000000000001",
    assigned_at: now,
    priority: "NORMAL",
    status: "FINALIZED",
    original_ai_score: aiAwardedPoints,
    reviewed_score: finalScore,
    final_score: finalScore,
    is_passed: isPassed,
    created_at: now,
    updated_at: now,
    decisions,
  };

  const goldLabels: QAGoldLabel[] = decisions.map((d) => {
    const isAiEvaluated = d.ai_result !== undefined;
    const isAgreement = isAiEvaluated ? d.ai_result === d.human_result : false;
    const failureReasonAgreement =
      isAiEvaluated && d.ai_result === "FAIL" && d.human_result === "FAIL"
        ? d.ai_failure_reason === d.human_failure_reason
        : undefined;

    // Double review simulation on first 2 calls (Section 11 & 12)
    const hasDoubleReview = config.index <= 2;

    return {
      id: crypto.randomUUID(),
      dataset_id: SYNTHETIC_TELECOM_BENCHMARK_DATASET_ID,
      dataset_version: "1.0.0",
      call_id: config.callId,
      review_id: reviewId,
      transcript_id: transcriptId,
      scorecard_id: scorecard.id,
      scorecard_version: scorecard.version,
      parameter_id: d.parameter_id,
      parameter_name: d.parameter_name,
      ai_result: d.ai_result,
      human_result: d.human_result,
      is_agreement: isAgreement,
      ai_failure_reason: d.ai_failure_reason,
      human_failure_reason: d.human_failure_reason,
      failure_reason_agreement: failureReasonAgreement,
      ai_confidence: 0.95,
      ai_evidence_accuracy: d.ai_evidence_accuracy,
      evidence_relevance:
        d.ai_evidence_accuracy === "CORRECT"
          ? "RELEVANT"
          : d.ai_evidence_accuracy === "PARTIALLY_CORRECT"
          ? "PARTIALLY_RELEVANT"
          : "IRRELEVANT",
      evidence_sufficiency:
        d.ai_evidence_accuracy === "CORRECT"
          ? "SUFFICIENT"
          : d.ai_evidence_accuracy === "PARTIALLY_CORRECT"
          ? "PARTIALLY_SUFFICIENT"
          : "INSUFFICIENT",
      ai_evidence: [],
      human_evidence: d.human_evidence_utterance_ids,
      reviewer_id: review.reviewer_id,
      secondary_reviewer_id: hasDoubleReview ? "u0000000-0000-0000-0000-000000000002" : undefined,
      secondary_human_result: hasDoubleReview ? d.human_result : undefined,
      secondary_failure_reason: hasDoubleReview ? d.human_failure_reason : undefined,
      organization_id: INITIAL_ORGANIZATION.id,
      created_at: now,
    };
  });

  return { call, transcript, utterances, audit, review, goldLabels };
}

export const SYNTHETIC_TELECOM_BENCHMARK_ITEMS = GOLD_BENCHMARK_DATASET;

