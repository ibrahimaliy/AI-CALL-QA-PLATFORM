import { ScorecardWithDetails } from "@/types/scorecard";

export const INITIAL_ORGANIZATION = {
  id: "a0000000-0000-0000-0000-000000000001",
  name: "Smile Telecom International",
  slug: "smile-telecom",
  active: true,
};

export const INITIAL_CAMPAIGN = {
  id: "b0000000-0000-0000-0000-000000000001",
  organization_id: "a0000000-0000-0000-0000-000000000001",
  name: "Inbound Customer Support",
  description: "English voice customer service and technical query support",
  active: true,
};

export const INITIAL_AGENT = {
  id: "c0000000-0000-0000-0000-000000000001",
  organization_id: "a0000000-0000-0000-0000-000000000001",
  campaign_id: "b0000000-0000-0000-0000-000000000001",
  employee_code: "AGT-1049",
  name: "Olabiyi Boluwatife Precious",
  email: "b.olabiyi@smiletelecom.com",
  active: true,
};

export const SAMPLE_CAMPAIGNS = [
  INITIAL_CAMPAIGN,
  {
    id: "b0000000-0000-0000-0000-000000000002",
    organization_id: "a0000000-0000-0000-0000-000000000001",
    name: "Technical Support & Broadband",
    description: "4G LTE router troubleshooting, broadband fiber support, and speed diagnostics",
    active: true,
  },
  {
    id: "b0000000-0000-0000-0000-000000000003",
    organization_id: "a0000000-0000-0000-0000-000000000001",
    name: "Billing, Recharge & KYC",
    description: "Payment disputes, SIM registration compliance, data bundle subscriptions",
    active: true,
  },
  {
    id: "b0000000-0000-0000-0000-000000000004",
    organization_id: "a0000000-0000-0000-0000-000000000001",
    name: "VIP & Enterprise Accounts",
    description: "Dedicated account management and SLA escalation for corporate clients",
    active: true,
  },
];

export const SAMPLE_AGENTS = [
  INITIAL_AGENT,
  {
    id: "c0000000-0000-0000-0000-000000000002",
    organization_id: "a0000000-0000-0000-0000-000000000001",
    campaign_id: "b0000000-0000-0000-0000-000000000001",
    employee_code: "AGT-1082",
    name: "Aisha Mohammed",
    email: "a.mohammed@smiletelecom.com",
    active: true,
  },
  {
    id: "c0000000-0000-0000-0000-000000000003",
    organization_id: "a0000000-0000-0000-0000-000000000001",
    campaign_id: "b0000000-0000-0000-0000-000000000002",
    employee_code: "AGT-1130",
    name: "Chinedu Eze",
    email: "c.eze@smiletelecom.com",
    active: true,
  },
  {
    id: "c0000000-0000-0000-0000-000000000004",
    organization_id: "a0000000-0000-0000-0000-000000000001",
    campaign_id: "b0000000-0000-0000-0000-000000000001",
    employee_code: "AGT-1194",
    name: "Fatima Bello",
    email: "f.bello@smiletelecom.com",
    active: true,
  },
  {
    id: "c0000000-0000-0000-0000-000000000005",
    organization_id: "a0000000-0000-0000-0000-000000000001",
    campaign_id: "b0000000-0000-0000-0000-000000000003",
    employee_code: "AGT-1215",
    name: "David Adeleke",
    email: "d.adeleke@smiletelecom.com",
    active: true,
  },
];

export const INITIAL_SCORECARD: ScorecardWithDetails = {
  id: "d0000000-0000-0000-0000-000000000001",
  organization_id: "a0000000-0000-0000-0000-000000000001",
  campaign_id: "b0000000-0000-0000-0000-000000000001",
  name: "Inbound Customer Support QA Scorecard",
  description: "Official Quality Assurance Evaluation Framework for Inbound Calls",
  version: "1.0",
  passing_score: 71.0,
  status: "published",
  effective_from: "2026-09-01T00:00:00.000Z",
  parameters: [
    // 1. Greeting and Procedures: Adherence to greeting/welcome verbiage (4)
    {
      id: "e0000000-0000-0000-0000-000000000001",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      section_name: "Greeting and Procedures",
      parameter_name: "Adherence to greeting/welcome verbiage",
      description:
        "Evaluate whether the agent follows the approved opening/greeting procedure and adheres to hold protocol.",
      max_weight: 4.0,
      audit_source: "TRANSCRIPT",
      sort_order: 1,
      is_critical: false,
      active: true,
      rules: [
        {
          id: "f0000000-0000-0000-0000-000000000001",
          parameter_id: "e0000000-0000-0000-0000-000000000001",
          title: "Adhere to standard greeting verbiage",
          description:
            "Opening greeting includes company name, agent identity, warm welcoming phrase, and time-of-day greeting.",
          rule_type: "STANDARD",
          audit_source: "TRANSCRIPT",
          allocated_points: 2.0,
          sort_order: 1,
          active: true,
        },
        {
          id: "f0000000-0000-0000-0000-000000000002",
          parameter_id: "e0000000-0000-0000-0000-000000000001",
          title: "Effectively adhere to hold protocol or procedure",
          description:
            "Seek permission before hold, state hold duration, refresh within 30s (first) / 45s (subsequent), thank on return.",
          rule_type: "STANDARD",
          audit_source: "TRANSCRIPT",
          allocated_points: 2.0,
          sort_order: 2,
          active: true,
        },
      ],
      failure_reasons: [
        {
          id: "11000000-0000-0000-0000-000000000001",
          parameter_id: "e0000000-0000-0000-0000-000000000001",
          code: "GREETING_NOT_ADHERED",
          label: "Did not adhere to standard greeting verbiage",
          description:
            "Agent omitted greeting, failed to introduce name or brand, or used informal welcome.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000002",
          parameter_id: "e0000000-0000-0000-0000-000000000001",
          code: "UNNECESSARY_HOLD",
          label: "Placed customer on unnecessary hold",
          description: "Customer placed on hold without valid reason or without permission.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000003",
          parameter_id: "e0000000-0000-0000-0000-000000000001",
          code: "HOLD_REFRESH_NOT_DONE",
          label: "Hold refresh timing was not respected",
          description:
            "First refresh exceeded 30 seconds or subsequent refreshes exceeded 45 seconds.",
          active: true,
        },
      ],
    },

    // 2. Greeting and Procedures: Security Checks (10)
    {
      id: "e0000000-0000-0000-0000-000000000002",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      section_name: "Greeting and Procedures",
      parameter_name: "Security Checks",
      description:
        "Evaluate whether required customer verification and security checks were adequately performed before accessing records.",
      max_weight: 10.0,
      audit_source: "HYBRID",
      sort_order: 2,
      is_critical: true,
      critical_failure_effect: "ZERO_TOTAL_OR_REVIEW",
      active: true,
      rules: [
        {
          id: "f0000000-0000-0000-0000-000000000003",
          parameter_id: "e0000000-0000-0000-0000-000000000002",
          title: "Adequately follow security check guidelines",
          description:
            "Ask required customer verification questions (name, phone, account number) before sharing account data.",
          rule_type: "COMPLIANCE",
          audit_source: "HYBRID",
          allocated_points: 10.0,
          sort_order: 1,
          active: true,
        },
      ],
      failure_reasons: [
        {
          id: "11000000-0000-0000-0000-000000000004",
          parameter_id: "e0000000-0000-0000-0000-000000000002",
          code: "SECURITY_NOT_DONE",
          label: "Security checks not performed",
          description:
            "Agent accessed or disclosed account details without any verification questions.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000005",
          parameter_id: "e0000000-0000-0000-0000-000000000002",
          code: "PARTIAL_SECURITY_CHECKS",
          label: "Partial security checks",
          description: "Agent failed to ask all required security verification parameters.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000006",
          parameter_id: "e0000000-0000-0000-0000-000000000002",
          code: "WRONG_ACCOUNT_VERIFIED",
          label: "Verification performed on the wrong account",
          description:
            "Agent verified credentials against mismatched account ID or phone number.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000007",
          parameter_id: "e0000000-0000-0000-0000-000000000002",
          code: "UNNECESSARY_SECURITY_CHECKS",
          label: "Unnecessary security checks",
          description: "Requested security verification for non-account general inquiries.",
          active: true,
        },
      ],
    },

    // 3. Call Courtesy: Politeness and Courtesy (10)
    {
      id: "e0000000-0000-0000-0000-000000000003",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      section_name: "Call Courtesy",
      parameter_name: "Politeness and Courtesy",
      description:
        "Evaluate customer treatment, positive language, appropriate use of please and thank you, and patient behavior.",
      max_weight: 10.0,
      audit_source: "AUDIO",
      sort_order: 3,
      is_critical: false,
      active: true,
      rules: [
        {
          id: "f0000000-0000-0000-0000-000000000004",
          parameter_id: "e0000000-0000-0000-0000-000000000003",
          title: "Uses customer name/title correctly on the call",
          description: "Address customer by correct name/title with respect throughout interaction.",
          rule_type: "STANDARD",
          audit_source: "TRANSCRIPT",
          allocated_points: 5.0,
          sort_order: 1,
          active: true,
        },
        {
          id: "f0000000-0000-0000-0000-000000000005",
          parameter_id: "e0000000-0000-0000-0000-000000000003",
          title:
            "Remain polite, patient and positive regardless of customer type, use pleasantries such as PLEASE and THANK YOU",
          description:
            "Maintain patient behavior, positive language, appropriate use of please and thank you.",
          rule_type: "STANDARD",
          audit_source: "AUDIO",
          allocated_points: 5.0,
          sort_order: 2,
          active: true,
        },
      ],
      failure_reasons: [
        {
          id: "11000000-0000-0000-0000-000000000008",
          parameter_id: "e0000000-0000-0000-0000-000000000003",
          code: "WRONG_NAME_OR_TITLE",
          label: "Failed to use customer name or title correctly",
          description: "Did not address customer by name or used improper title.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000009",
          parameter_id: "e0000000-0000-0000-0000-000000000003",
          code: "LACKS_PLEASANTRIES",
          label: "Lack of basic pleasantries (please, thank you)",
          description: "Omitted courtesies and standard polite phrases.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000010",
          parameter_id: "e0000000-0000-0000-0000-000000000003",
          code: "IMPATIENT_BEHAVIOR",
          label: "Exhibited impatient or abrupt behavior",
          description: "Rushed the customer or sounded exasperated.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000011",
          parameter_id: "e0000000-0000-0000-0000-000000000003",
          code: "COMMANDING_TONE",
          label: "Commanding, sarcastic, or offensive language",
          description: "Spoke down to customer, used sarcasm, or issued demands.",
          active: true,
        },
      ],
    },

    // 4. Call Courtesy: Enthusiasm (8)
    {
      id: "e0000000-0000-0000-0000-000000000004",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      section_name: "Call Courtesy",
      parameter_name: "Enthusiasm",
      description:
        "Evaluate vocal energy, willingness to help, ownership of the issue, and avoid indifferent/dull tone.",
      max_weight: 8.0,
      audit_source: "AUDIO",
      sort_order: 4,
      is_critical: false,
      active: true,
      rules: [
        {
          id: "f0000000-0000-0000-0000-000000000006",
          parameter_id: "e0000000-0000-0000-0000-000000000004",
          title: "Exhibit high energy levels throughout the call",
          description:
            "Maintain enthusiastic, engaged vocal energy throughout the entire duration of the call.",
          rule_type: "STANDARD",
          audit_source: "AUDIO",
          allocated_points: 4.0,
          sort_order: 1,
          active: true,
        },
        {
          id: "f0000000-0000-0000-0000-000000000007",
          parameter_id: "e0000000-0000-0000-0000-000000000004",
          title: "Takes ownership / willingness to help",
          description:
            "Demonstrate proactive willingness to resolve customer concern without transferring unnecessarily.",
          rule_type: "STANDARD",
          audit_source: "AUDIO",
          allocated_points: 4.0,
          sort_order: 2,
          active: true,
        },
      ],
      failure_reasons: [
        {
          id: "11000000-0000-0000-0000-000000000012",
          parameter_id: "e0000000-0000-0000-0000-000000000004",
          code: "LOW_ENERGY_DULL",
          label: "Low energy level and dull delivery",
          description:
            "Sounded disinterested, sleepy, monotone, or uninterested in the call.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000013",
          parameter_id: "e0000000-0000-0000-0000-000000000004",
          code: "LACKS_OWNERSHIP",
          label: "Lack of ownership or willingness to help",
          description: "Did not show initiative to resolve customer problem.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000014",
          parameter_id: "e0000000-0000-0000-0000-000000000004",
          code: "INAPPROPRIATE_SING_SONG",
          label: "Inappropriate sing-song greeting or unprofessional pitch",
          description: "Used exaggerated sing-song tone.",
          active: true,
        },
      ],
    },

    // 5. Call Courtesy: Communication Skills (10)
    {
      id: "e0000000-0000-0000-0000-000000000005",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      section_name: "Call Courtesy",
      parameter_name: "Communication Skills",
      description:
        "Evaluate clear articulation, correct word choice, avoiding jargon and filler words, and professional tone.",
      max_weight: 10.0,
      audit_source: "AUDIO",
      sort_order: 5,
      is_critical: false,
      active: true,
      rules: [
        {
          id: "f0000000-0000-0000-0000-000000000008",
          parameter_id: "e0000000-0000-0000-0000-000000000005",
          title:
            "Use right words and phrases to articulate thoughts and avoid filler words and jargon",
          description:
            "Avoid filler words (um, uh, erm, like), intercalary expressions, and excessive jargon. Clear articulation.",
          rule_type: "STANDARD",
          audit_source: "AUDIO",
          allocated_points: 7.0,
          sort_order: 1,
          active: true,
        },
        {
          id: "f0000000-0000-0000-0000-000000000009",
          parameter_id: "e0000000-0000-0000-0000-000000000005",
          title: "Seeks information in a professional manner and not questioning tone",
          description: "Ask questions respectfully without aggressive or interrogative tone.",
          rule_type: "STANDARD",
          audit_source: "AUDIO",
          allocated_points: 3.0,
          sort_order: 2,
          active: true,
        },
      ],
      failure_reasons: [
        {
          id: "11000000-0000-0000-0000-000000000015",
          parameter_id: "e0000000-0000-0000-0000-000000000005",
          code: "USES_FILLER_WORDS",
          label: "Repeated use of filler words (um, uh, erm, like)",
          description:
            "Agent repeatedly vocalized hesitation fillers causing disfluent speech.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000016",
          parameter_id: "e0000000-0000-0000-0000-000000000005",
          code: "EXCESSIVE_JARGON",
          label: "Used excessive internal jargon or intercalary expressions",
          description: "Used abbreviations or technical terms unfamiliar to customer.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000017",
          parameter_id: "e0000000-0000-0000-0000-000000000005",
          code: "UNCLEAR_ARTICULATION",
          label: "Unclear articulation or spoke too quickly",
          description:
            "Mumbled, spoke too fast, or formed unnecessarily complicated sentences.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000018",
          parameter_id: "e0000000-0000-0000-0000-000000000005",
          code: "UNPROFESSIONAL_QUESTIONING",
          label: "Unprofessional questioning tone",
          description:
            "Sounded confrontational or interrogative when gathering information.",
          active: true,
        },
      ],
    },

    // 6. Issue Identification: Listening Skills (8)
    {
      id: "e0000000-0000-0000-0000-000000000006",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      section_name: "Issue Identification",
      parameter_name: "Listening Skills",
      description:
        "Evaluate active listening without interrupting customer, avoiding dead air, and acknowledging customer remarks.",
      max_weight: 8.0,
      audit_source: "AUDIO",
      sort_order: 6,
      is_critical: false,
      active: true,
      rules: [
        {
          id: "f0000000-0000-0000-0000-000000000010",
          parameter_id: "e0000000-0000-0000-0000-000000000006",
          title:
            "Active Listening without interrupting the customer and maintaining high level of professionalism",
          description:
            "Do not talk over or interrupt customer; avoid dead air and repeated requests for provided info.",
          rule_type: "STANDARD",
          audit_source: "AUDIO",
          allocated_points: 8.0,
          sort_order: 1,
          active: true,
        },
      ],
      failure_reasons: [
        {
          id: "11000000-0000-0000-0000-000000000019",
          parameter_id: "e0000000-0000-0000-0000-000000000006",
          code: "INTERRUPTS_CUSTOMER",
          label: "Interrupted or spoke over the customer",
          description:
            "Cross-talk occurred or agent failed to yield immediately when customer spoke.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000020",
          parameter_id: "e0000000-0000-0000-0000-000000000006",
          code: "REPEATED_INFORMATION",
          label: "Asked again for information already supplied",
          description:
            "Agent was not actively listening and re-asked already provided details.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000021",
          parameter_id: "e0000000-0000-0000-0000-000000000006",
          code: "DEAD_AIR",
          label: "Excessive dead air without keeping customer informed",
          description: "Unexplained silences lasting beyond acceptable thresholds.",
          active: true,
        },
      ],
    },

    // 7. Issue Identification: Effective Probing (15)
    {
      id: "e0000000-0000-0000-0000-000000000007",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      section_name: "Issue Identification",
      parameter_name: "Effective Probing",
      description:
        "Evaluate whether agent asked relevant questions, avoided assumptions, and effectively summarized customer concern.",
      max_weight: 15.0,
      audit_source: "TRANSCRIPT",
      sort_order: 7,
      is_critical: false,
      active: true,
      rules: [
        {
          id: "f0000000-0000-0000-0000-000000000011",
          parameter_id: "e0000000-0000-0000-0000-000000000007",
          title: "Ask relevant questions to identify issue or situation",
          description: "Ask targeted, diagnostic probing questions to uncover the root cause.",
          rule_type: "STANDARD",
          audit_source: "TRANSCRIPT",
          allocated_points: 5.0,
          sort_order: 1,
          active: true,
        },
        {
          id: "f0000000-0000-0000-0000-000000000012",
          parameter_id: "e0000000-0000-0000-0000-000000000007",
          title: "Maintain control over the conversation and rephrase to understand customer concern",
          description: "Keep the discussion on track professionally while acknowledging nuances.",
          rule_type: "STANDARD",
          audit_source: "TRANSCRIPT",
          allocated_points: 5.0,
          sort_order: 2,
          active: true,
        },
        {
          id: "f0000000-0000-0000-0000-000000000013",
          parameter_id: "e0000000-0000-0000-0000-000000000007",
          title:
            "Does not jump to assumption or give auto pilot response, summarize to validate customer understanding",
          description:
            "Avoid jumping to conclusions or robot-like replies; summarize customer issue before proposing solutions.",
          rule_type: "STANDARD",
          audit_source: "TRANSCRIPT",
          allocated_points: 5.0,
          sort_order: 3,
          active: true,
        },
      ],
      failure_reasons: [
        {
          id: "11000000-0000-0000-0000-000000000022",
          parameter_id: "e0000000-0000-0000-0000-000000000007",
          code: "POOR_PROBING",
          label: "Failed to ask relevant probing questions",
          description: "Did not ask diagnostic questions to uncover issue root cause.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000023",
          parameter_id: "e0000000-0000-0000-0000-000000000007",
          code: "JUMPED_TO_CONCLUSIONS",
          label: "Jumped to conclusions or gave autopilot responses",
          description:
            "Assumed problem without validation or gave generic scripted answers.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000024",
          parameter_id: "e0000000-0000-0000-0000-000000000007",
          code: "FAILED_TO_SUMMARIZE",
          label: "Failed to summarize or confirm understanding",
          description:
            "Did not validate understanding of complex inquiry before actioning.",
          active: true,
        },
      ],
    },

    // 8. Issue Resolution: Accurate Resolution (15)
    {
      id: "e0000000-0000-0000-0000-000000000008",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      section_name: "Issue Resolution",
      parameter_name: "Accurate Resolution",
      description:
        "Evaluate accuracy of information supplied against knowledge base, correct product/process information, and proper escalation.",
      max_weight: 15.0,
      audit_source: "HYBRID",
      sort_order: 8,
      is_critical: false,
      active: true,
      rules: [
        {
          id: "f0000000-0000-0000-0000-000000000014",
          parameter_id: "e0000000-0000-0000-0000-000000000008",
          title: "Provide accurate information on product/process as it relates to customer situation",
          description: "Ensure technical and policy information matches approved knowledge base SOPs.",
          rule_type: "ACCURACY",
          audit_source: "HYBRID",
          allocated_points: 10.0,
          sort_order: 1,
          active: true,
        },
        {
          id: "f0000000-0000-0000-0000-000000000015",
          parameter_id: "e0000000-0000-0000-0000-000000000008",
          title: "Offer appropriate alternatives to issue",
          description:
            "Provide viable alternatives and follow proper escalation sequence if online resolution is impossible.",
          rule_type: "ACCURACY",
          audit_source: "HYBRID",
          allocated_points: 5.0,
          sort_order: 2,
          active: true,
        },
      ],
      failure_reasons: [
        {
          id: "11000000-0000-0000-0000-000000000025",
          parameter_id: "e0000000-0000-0000-0000-000000000008",
          code: "INCORRECT_PRODUCT_INFO",
          label: "Provided incorrect product or process information",
          description: "Shared inaccurate pricing, specifications, or company policy.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000026",
          parameter_id: "e0000000-0000-0000-0000-000000000008",
          code: "INCORRECT_TAT",
          label: "Incorrect turnaround-time (TAT) communicated",
          description:
            "Promised resolution timeline conflicting with standard operating procedure.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000027",
          parameter_id: "e0000000-0000-0000-0000-000000000008",
          code: "FAILED_TO_OFFER_ALTERNATIVES",
          label: "Failed to provide appropriate alternatives",
          description: "Did not offer viable backup solutions when primary request was unfeasible.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000028",
          parameter_id: "e0000000-0000-0000-0000-000000000008",
          code: "IMPROPER_ESCALATION",
          label: "Unnecessary or improper escalation sequence",
          description:
            "Escalated ticket that could have been resolved on first contact or sent to wrong queue.",
          active: true,
        },
      ],
    },

    // 9. Issue Resolution: Completeness of Resolution (11)
    {
      id: "e0000000-0000-0000-0000-000000000009",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      section_name: "Issue Resolution",
      parameter_name: "Completeness of Resolution",
      description:
        "Evaluate pitching MySmile App, offering additional assistance, and delivering approved closing statement.",
      max_weight: 11.0,
      audit_source: "TRANSCRIPT",
      sort_order: 9,
      is_critical: false,
      active: true,
      rules: [
        {
          id: "f0000000-0000-0000-0000-000000000016",
          parameter_id: "e0000000-0000-0000-0000-000000000009",
          title: "Adequately pitch the MySmile App to customer for download",
          description:
            "Introduce customer to MySmile self-service mobile application and highlight its benefits.",
          rule_type: "STANDARD",
          audit_source: "TRANSCRIPT",
          allocated_points: 7.0,
          sort_order: 1,
          active: true,
        },
        {
          id: "f0000000-0000-0000-0000-000000000017",
          parameter_id: "e0000000-0000-0000-0000-000000000009",
          title: "Ask if there is anything else you could do for the customer",
          description: "Ask the standard additional assistance question before moving to call close.",
          rule_type: "STANDARD",
          audit_source: "TRANSCRIPT",
          allocated_points: 2.0,
          sort_order: 2,
          active: true,
        },
        {
          id: "f0000000-0000-0000-0000-000000000018",
          parameter_id: "e0000000-0000-0000-0000-000000000009",
          title: "Uses appropriate closing verbiage",
          description: "Deliver complete approved closing script with brand name and pleasant sign-off.",
          rule_type: "STANDARD",
          audit_source: "TRANSCRIPT",
          allocated_points: 2.0,
          sort_order: 3,
          active: true,
        },
      ],
      failure_reasons: [
        {
          id: "11000000-0000-0000-0000-000000000029",
          parameter_id: "e0000000-0000-0000-0000-000000000009",
          code: "MISSED_MYSMILE_PITCH",
          label: "Did not adequately pitch the MySmile App",
          description:
            "Omitted pitch for customer to download and utilize the self-service app.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000030",
          parameter_id: "e0000000-0000-0000-0000-000000000009",
          code: "MISSED_FURTHER_ASSISTANCE",
          label: "Failed to ask if customer needs anything else",
          description: "Did not offer further assistance before concluding the call.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000031",
          parameter_id: "e0000000-0000-0000-0000-000000000009",
          code: "INCORRECT_CLOSING",
          label: "Did not use approved closing statement",
          description: "Abrupt hang-up or informal closing verbiage.",
          active: true,
        },
      ],
    },

    // 10. Call Ticketing and Escalation: CRM Accuracy & Completeness (9)
    {
      id: "e0000000-0000-0000-0000-000000000010",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      section_name: "Call Ticketing and Escalation",
      parameter_name: "CRM Accuracy & Completeness",
      description:
        "Evaluate CRM ticket documentation, tagging accuracy, and proper tool utilization.",
      max_weight: 9.0,
      audit_source: "CRM",
      sort_order: 10,
      is_critical: false,
      active: true,
      rules: [
        {
          id: "f0000000-0000-0000-0000-000000000019",
          parameter_id: "e0000000-0000-0000-0000-000000000010",
          title: "Follows escalation process, uses tools/applications effectively",
          description: "Follow official ticket escalation path and use CRM workflows as specified.",
          rule_type: "OPERATIONAL",
          audit_source: "CRM",
          allocated_points: 5.0,
          sort_order: 1,
          active: true,
        },
        {
          id: "f0000000-0000-0000-0000-000000000020",
          parameter_id: "e0000000-0000-0000-0000-000000000010",
          title: "Accurate ticket documentation/tagging on system",
          description:
            "Complete comprehensive ticket notes, tag correct query category, and verify customer ID.",
          rule_type: "OPERATIONAL",
          audit_source: "CRM",
          allocated_points: 4.0,
          sort_order: 2,
          active: true,
        },
      ],
      failure_reasons: [
        {
          id: "11000000-0000-0000-0000-000000000032",
          parameter_id: "e0000000-0000-0000-0000-000000000010",
          code: "INCOMPLETE_NOTES",
          label: "CRM notes incomplete or missing vital details",
          description:
            "Failed to document interaction steps, customer complaints, or actions taken.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000033",
          parameter_id: "e0000000-0000-0000-0000-000000000010",
          code: "INCORRECT_TAGGING",
          label: "Ticket incorrectly tagged or query category misclassified",
          description: "Misclassified ticket type or failed to tag all sub-queries.",
          active: true,
        },
        {
          id: "11000000-0000-0000-0000-000000000034",
          parameter_id: "e0000000-0000-0000-0000-000000000010",
          code: "TOOL_MISUSE",
          label: "Ineffective use of support tools or failure to raise required ticket",
          description:
            "Failed to trigger required back-office workflow or misconfigured JIRA entry.",
          active: true,
        },
      ],
    },
  ],
  verbiage_guidelines: [
    {
      id: "12000000-0000-0000-0000-000000000001",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      parameter: "Opening",
      language: "English",
      suggested_verbiage:
        "Good [morning/afternoon/evening], thank you for calling Smile Telecom. My name is [Agent Name]. How may I assist you today?",
      reference_guideline:
        "Must include time-of-day greeting, company name, agent name, and polite assistance offer. Clear articulation and warm vocal tone.",
      active: true,
    },
    {
      id: "12000000-0000-0000-0000-000000000002",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      parameter: "Security Checks",
      language: "English",
      suggested_verbiage:
        "For security and account verification purposes, may I please have your full name, registered phone number, and account or SIM number?",
      reference_guideline:
        "Verify mandatory identity parameters before accessing or revealing sensitive customer data. Check against system CRM records.",
      active: true,
    },
    {
      id: "12000000-0000-0000-0000-000000000003",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      parameter: "Hold",
      language: "English",
      suggested_verbiage:
        "May I place you on a brief hold for about 1 to 2 minutes while I look into your account details? ... Thank you for holding, I appreciate your patience.",
      reference_guideline:
        "Always request permission and specify expected duration. Refresh within 30 seconds on initial hold and every 45 seconds thereafter. Thank the customer upon return.",
      active: true,
    },
    {
      id: "12000000-0000-0000-0000-000000000004",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      parameter: "Empathy",
      language: "English",
      suggested_verbiage:
        "I truly understand how inconvenient this situation is for you, and I apologize for the trouble. Please be assured that I will do everything possible to resolve this today.",
      reference_guideline:
        "Acknowledge customer frustration with genuine empathy. Do not give robotic apologies or apologize excessively without actionable ownership.",
      active: true,
    },
    {
      id: "12000000-0000-0000-0000-000000000005",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      parameter: "Escalation",
      language: "English",
      suggested_verbiage:
        "I am escalating your ticket to our technical investigations team under reference [Ticket Number]. You will receive an update via SMS within 24 to 48 hours.",
      reference_guideline:
        "Ensure all front-line troubleshooting steps were exhausted first. Clearly communicate ticket reference number and exact turnaround time (TAT).",
      active: true,
    },
    {
      id: "12000000-0000-0000-0000-000000000006",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      parameter: "Closing",
      language: "English",
      suggested_verbiage:
        "You can also download our MySmile App from Google Play or Apple App Store for 24/7 instant account management and data recharge. Is there anything else I can assist you with today? ... Thank you for calling Smile Telecom. Have a wonderful day!",
      reference_guideline:
        "Pitch the mobile application, ask for additional queries, and deliver the approved corporate sign-off.",
      active: true,
    },
    {
      id: "12000000-0000-0000-0000-000000000007",
      scorecard_id: "d0000000-0000-0000-0000-000000000001",
      parameter: "System Downtime",
      language: "English",
      suggested_verbiage:
        "Our account management portal is temporarily undergoing maintenance. I have documented your request details and will manually update your account as soon as service is restored.",
      reference_guideline:
        "Remain calm and professional. Never blame internal IT negatively; reassure the customer of offline follow-up and create manual documentation.",
      active: true,
    },
  ],
};
