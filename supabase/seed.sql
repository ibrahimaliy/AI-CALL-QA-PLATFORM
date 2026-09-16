-- AI Call Quality Assurance Platform - Seed Data
-- Imported directly from the official Excel QA Scorecard & Specification Section 64
-- Parameter weights verified: 4 + 10 + 10 + 8 + 10 + 8 + 15 + 15 + 11 + 9 = 100.00

-- 1. Organization
INSERT INTO organizations (id, name, slug, active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Smile Telecom International',
    'smile-telecom',
    true
) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- 2. Campaign
INSERT INTO campaigns (id, organization_id, name, description, active)
VALUES 
(
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Inbound Customer Support',
    'English voice customer service and technical query support',
    true
),
(
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Technical Support & Broadband',
    '4G LTE router troubleshooting, broadband fiber support, and speed diagnostics',
    true
),
(
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'Billing, Recharge & KYC',
    'Payment disputes, SIM registration compliance, data bundle subscriptions',
    true
),
(
    'b0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'VIP & Enterprise Accounts',
    'Dedicated account management and SLA escalation for corporate clients',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 3. Sample Agents
INSERT INTO agents (id, organization_id, campaign_id, employee_code, name, email, active)
VALUES 
(
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'AGT-1049',
    'Olabiyi Boluwatife Precious',
    'b.olabiyi@smiletelecom.com',
    true
),
(
    'c0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'AGT-1082',
    'Aisha Mohammed',
    'a.mohammed@smiletelecom.com',
    true
),
(
    'c0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'AGT-1130',
    'Chinedu Eze',
    'c.eze@smiletelecom.com',
    true
),
(
    'c0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'AGT-1194',
    'Fatima Bello',
    'f.bello@smiletelecom.com',
    true
),
(
    'c0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000003',
    'AGT-1215',
    'David Adeleke',
    'd.adeleke@smiletelecom.com',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 4. Scorecard Version 1.0 (Passing score: 71.00)
INSERT INTO scorecards (id, organization_id, campaign_id, name, description, version, passing_score, status, effective_from)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Inbound Customer Support QA Scorecard',
    'Official Quality Assurance Evaluation Framework for Inbound Calls',
    '1.0',
    71.00,
    'published',
    now()
) ON CONFLICT (id) DO NOTHING;

-- 5. The 10 Parameters (Sum of max_weight = 100.00)
INSERT INTO scorecard_parameters (id, scorecard_id, section_name, parameter_name, description, max_weight, audit_source, sort_order, is_critical)
VALUES 
-- Section 1: Greeting and Procedures (14 total)
(
    'e0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'Greeting and Procedures',
    'Adherence to greeting/welcome verbiage',
    'Evaluate whether the agent follows the approved opening/greeting procedure and adheres to hold protocol.',
    4.00,
    'TRANSCRIPT',
    1,
    false
),
(
    'e0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    'Greeting and Procedures',
    'Security Checks',
    'Evaluate whether required customer verification and security checks were adequately performed before accessing records.',
    10.00,
    'HYBRID',
    2,
    true
),

-- Section 2: Call Courtesy (28 total)
(
    'e0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'Call Courtesy',
    'Politeness and Courtesy',
    'Evaluate customer treatment, positive language, appropriate use of please and thank you, and patient behavior.',
    10.00,
    'AUDIO',
    3,
    false
),
(
    'e0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000001',
    'Call Courtesy',
    'Enthusiasm',
    'Evaluate vocal energy, willingness to help, ownership of the issue, and avoid indifferent/dull tone.',
    8.00,
    'AUDIO',
    4,
    false
),
(
    'e0000000-0000-0000-0000-000000000005',
    'd0000000-0000-0000-0000-000000000001',
    'Call Courtesy',
    'Communication Skills',
    'Evaluate clear articulation, correct word choice, avoiding jargon and filler words, and professional tone.',
    10.00,
    'AUDIO',
    5,
    false
),

-- Section 3: Issue Identification (23 total)
(
    'e0000000-0000-0000-0000-000000000006',
    'd0000000-0000-0000-0000-000000000001',
    'Issue Identification',
    'Listening Skills',
    'Evaluate active listening without interrupting customer, avoiding dead air, and acknowledging customer remarks.',
    8.00,
    'AUDIO',
    6,
    false
),
(
    'e0000000-0000-0000-0000-000000000007',
    'd0000000-0000-0000-0000-000000000001',
    'Issue Identification',
    'Effective Probing',
    'Evaluate whether agent asked relevant questions, avoided assumptions, and effectively summarized customer concern.',
    15.00,
    'TRANSCRIPT',
    7,
    false
),

-- Section 4: Issue Resolution (26 total)
(
    'e0000000-0000-0000-0000-000000000008',
    'd0000000-0000-0000-0000-000000000001',
    'Issue Resolution',
    'Accurate Resolution',
    'Evaluate accuracy of information supplied against knowledge base, correct product/process information, and proper escalation.',
    15.00,
    'HYBRID',
    8,
    false
),
(
    'e0000000-0000-0000-0000-000000000009',
    'd0000000-0000-0000-0000-000000000001',
    'Issue Resolution',
    'Completeness of Resolution',
    'Evaluate pitching MySmile App, offering additional assistance, and delivering approved closing statement.',
    11.00,
    'TRANSCRIPT',
    9,
    false
),

-- Section 5: Call Ticketing and Escalation (9 total)
(
    'e0000000-0000-0000-0000-000000000010',
    'd0000000-0000-0000-0000-000000000001',
    'Call Ticketing and Escalation',
    'CRM Accuracy & Completeness',
    'Evaluate accurate CRM documentation, correct ticket tagging, and following escalation procedures.',
    9.00,
    'CRM',
    10,
    false
)
ON CONFLICT (id) DO NOTHING;

-- 6. Scorecard Rules (Preserving exact workbook requirements)
INSERT INTO scorecard_rules (id, parameter_id, title, description, rule_type, audit_source, allocated_points, sort_order)
VALUES
-- Rules for Parameter 1: Adherence to greeting/welcome verbiage (4 max)
('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Adhere to standard greeting verbiage', 'Opening greeting includes company name, agent identity, warm welcoming phrase, and time-of-day greeting.', 'STANDARD', 'TRANSCRIPT', 2.00, 1),
('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Effectively adhere to hold protocol or procedure', 'Seek permission before hold, state hold duration, refresh within 30s (first) / 45s (subsequent), thank on return.', 'STANDARD', 'TRANSCRIPT', 2.00, 2),

-- Rules for Parameter 2: Security Checks (10 max)
('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'Adequately follow security check guidelines', 'Ask required customer verification questions (name, phone, account number) before sharing account data.', 'COMPLIANCE', 'HYBRID', 10.00, 1),

-- Rules for Parameter 3: Politeness and Courtesy (10 max)
('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000003', 'Uses customer name/title correctly on the call', 'Address customer by correct name/title with respect throughout interaction.', 'STANDARD', 'TRANSCRIPT', 5.00, 1),
('f0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000003', 'Remain polite, patient and positive regardless of customer type, use pleasantries such as PLEASE and THANK YOU', 'Maintain patient behavior, positive language, appropriate use of please and thank you.', 'STANDARD', 'AUDIO', 5.00, 2),

-- Rules for Parameter 4: Enthusiasm (8 max)
('f0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000004', 'Exhibit high energy levels throughout the call', 'Maintain enthusiastic, engaged vocal energy throughout the entire duration of the call.', 'STANDARD', 'AUDIO', 4.00, 1),
('f0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000004', 'Takes ownership / willingness to help', 'Demonstrate proactive willingness to resolve customer concern without transferring unnecessarily.', 'STANDARD', 'AUDIO', 4.00, 2),

-- Rules for Parameter 5: Communication Skills (10 max)
('f0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000005', 'Use right words and phrases to articulate thoughts and avoid filler words and jargon', 'Avoid filler words (um, uh, erm, like), intercalary expressions, and excessive jargon. Clear articulation.', 'STANDARD', 'AUDIO', 7.00, 1),
('f0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000005', 'Seeks information in a professional manner and not questioning tone', 'Ask questions respectfully without aggressive or interrogative tone.', 'STANDARD', 'AUDIO', 3.00, 2),

-- Rules for Parameter 6: Listening Skills (8 max)
('f0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000006', 'Active Listening without interrupting the customer and maintaining high level of professionalism', 'Do not talk over or interrupt customer; avoid dead air and repeated requests for provided info.', 'STANDARD', 'AUDIO', 8.00, 1),

-- Rules for Parameter 7: Effective Probing (15 max)
('f0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000007', 'Ask relevant questions to identify issue or situation', 'Ask targeted, diagnostic probing questions to uncover the root cause.', 'STANDARD', 'TRANSCRIPT', 5.00, 1),
('f0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000007', 'Maintain control over the conversation and rephrase to understand customer concern', 'Keep the discussion on track professionally while acknowledging nuances.', 'STANDARD', 'TRANSCRIPT', 5.00, 2),
('f0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000007', 'Does not jump to assumption or give auto pilot response, summarize to validate customer understanding', 'Avoid jumping to conclusions or robot-like replies; summarize customer issue before proposing solutions.', 'STANDARD', 'TRANSCRIPT', 5.00, 3),

-- Rules for Parameter 8: Accurate Resolution (15 max)
('f0000000-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000008', 'Provide accurate information on product/process as it relates to customer situation', 'Ensure technical and policy information matches approved knowledge base SOPs.', 'ACCURACY', 'HYBRID', 10.00, 1),
('f0000000-0000-0000-0000-000000000015', 'e0000000-0000-0000-0000-000000000008', 'Offer appropriate alternatives to issue', 'Provide viable alternatives and follow proper escalation sequence if online resolution is impossible.', 'ACCURACY', 'HYBRID', 5.00, 2),

-- Rules for Parameter 9: Completeness of Resolution (11 max)
('f0000000-0000-0000-0000-000000000016', 'e0000000-0000-0000-0000-000000000009', 'Adequately pitch the MySmile App to customer for download', 'Introduce customer to MySmile self-service mobile application and highlight its benefits.', 'STANDARD', 'TRANSCRIPT', 7.00, 1),
('f0000000-0000-0000-0000-000000000017', 'e0000000-0000-0000-0000-000000000009', 'Ask if there is anything else you could do for the customer', 'Ask the standard additional assistance question before moving to call close.', 'STANDARD', 'TRANSCRIPT', 2.00, 2),
('f0000000-0000-0000-0000-000000000018', 'e0000000-0000-0000-0000-000000000009', 'Uses appropriate closing verbiage', 'Deliver complete approved closing script with brand name and pleasant sign-off.', 'STANDARD', 'TRANSCRIPT', 2.00, 3),

-- Rules for Parameter 10: CRM Accuracy & Completeness (9 max)
('f0000000-0000-0000-0000-000000000019', 'e0000000-0000-0000-0000-000000000010', 'Follows escalation process, uses tools/applications effectively', 'Follow official ticket escalation path and use CRM workflows as specified.', 'OPERATIONAL', 'CRM', 5.00, 1),
('f0000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000010', 'Accurate ticket documentation/tagging on system', 'Complete comprehensive ticket notes, tag correct query category, and verify customer ID.', 'OPERATIONAL', 'CRM', 4.00, 2)
ON CONFLICT (id) DO NOTHING;

-- 7. Failure Reasons (Workbook Legend Summary)
INSERT INTO failure_reasons (id, parameter_id, code, label, description)
VALUES
-- Greeting
('11000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'GREETING_NOT_ADHERED', 'Did not adhere to standard greeting verbiage', 'Agent omitted greeting, failed to introduce name or brand, or used informal welcome.'),
('11000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'UNNECESSARY_HOLD', 'Placed customer on unnecessary hold', 'Customer placed on hold without valid reason or without permission.'),
('11000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'HOLD_REFRESH_NOT_DONE', 'Hold refresh timing was not respected', 'First refresh exceeded 30 seconds or subsequent refreshes exceeded 45 seconds.'),

-- Security Checks
('11000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'SECURITY_NOT_DONE', 'Security checks not performed', 'Agent accessed or disclosed account details without any verification questions.'),
('11000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'PARTIAL_SECURITY_CHECKS', 'Partial security checks', 'Agent failed to ask all required security verification parameters.'),
('11000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000002', 'WRONG_ACCOUNT_VERIFIED', 'Verification performed on the wrong account', 'Agent verified credentials against mismatched account ID or phone number.'),
('11000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000002', 'UNNECESSARY_SECURITY_CHECKS', 'Unnecessary security checks', 'Requested security verification for non-account general inquiries.'),

-- Politeness & Courtesy
('11000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000003', 'WRONG_NAME_OR_TITLE', 'Failed to use customer name or title correctly', 'Did not address customer by name or used improper title.'),
('11000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000003', 'LACKS_PLEASANTRIES', 'Lack of basic pleasantries (please, thank you)', 'Omitted courtesies and standard polite phrases.'),
('11000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000003', 'IMPATIENT_BEHAVIOR', 'Exhibited impatient or abrupt behavior', 'Rushed the customer or sounded exasperated.'),
('11000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000003', 'COMMANDING_TONE', 'Commanding, sarcastic, or offensive language', 'Spoke down to customer, used sarcasm, or issued demands.'),

-- Enthusiasm
('11000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000004', 'LOW_ENERGY_DULL', 'Low energy level and dull delivery', 'Sounded disinterested, sleepy, monotone, or uninterested in the call.'),
('11000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000004', 'LACKS_OWNERSHIP', 'Lack of ownership or willingness to help', 'Did not show initiative to resolve customer problem.'),
('11000000-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000004', 'INAPPROPRIATE_SING_SONG', 'Inappropriate sing-song greeting or unprofessional pitch', 'Used exaggerated sing-song tone.'),

-- Communication Skills
('11000000-0000-0000-0000-000000000015', 'e0000000-0000-0000-0000-000000000005', 'USES_FILLER_WORDS', 'Repeated use of filler words (um, uh, erm, like)', 'Agent repeatedly vocalized hesitation fillers causing disfluent speech.'),
('11000000-0000-0000-0000-000000000016', 'e0000000-0000-0000-0000-000000000005', 'EXCESSIVE_JARGON', 'Used excessive internal jargon or intercalary expressions', 'Used abbreviations or technical terms unfamiliar to customer.'),
('11000000-0000-0000-0000-000000000017', 'e0000000-0000-0000-0000-000000000005', 'UNCLEAR_ARTICULATION', 'Unclear articulation or spoke too quickly', 'Mumbled, spoke too fast, or formed unnecessarily complicated sentences.'),
('11000000-0000-0000-0000-000000000018', 'e0000000-0000-0000-0000-000000000005', 'UNPROFESSIONAL_QUESTIONING', 'Unprofessional questioning tone', 'Sounded confrontational or interrogative when gathering information.'),

-- Listening Skills
('11000000-0000-0000-0000-000000000019', 'e0000000-0000-0000-0000-000000000006', 'INTERRUPTS_CUSTOMER', 'Interrupted or spoke over the customer', 'Cross-talk occurred or agent failed to yield immediately when customer spoke.'),
('11000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000006', 'REPEATED_INFORMATION', 'Asked again for information already supplied', 'Agent was not actively listening and re-asked already provided details.'),
('11000000-0000-0000-0000-000000000021', 'e0000000-0000-0000-0000-000000000006', 'DEAD_AIR', 'Excessive dead air without keeping customer informed', 'Unexplained silences lasting beyond acceptable thresholds.'),

-- Effective Probing
('11000000-0000-0000-0000-000000000022', 'e0000000-0000-0000-0000-000000000007', 'POOR_PROBING', 'Failed to ask relevant probing questions', 'Did not ask diagnostic questions to uncover issue root cause.'),
('11000000-0000-0000-0000-000000000023', 'e0000000-0000-0000-0000-000000000007', 'JUMPED_TO_CONCLUSIONS', 'Jumped to conclusions or gave autopilot responses', 'Assumed problem without validation or gave generic scripted answers.'),
('11000000-0000-0000-0000-000000000024', 'e0000000-0000-0000-0000-000000000007', 'FAILED_TO_SUMMARIZE', 'Failed to summarize or confirm understanding', 'Did not validate understanding of complex inquiry before actioning.'),

-- Accurate Resolution
('11000000-0000-0000-0000-000000000025', 'e0000000-0000-0000-0000-000000000008', 'INCORRECT_PRODUCT_INFO', 'Provided incorrect product or process information', 'Shared inaccurate pricing, specifications, or company policy.'),
('11000000-0000-0000-0000-000000000026', 'e0000000-0000-0000-0000-000000000008', 'INCORRECT_TAT', 'Incorrect turnaround-time (TAT) communicated', 'Promised resolution timeline conflicting with standard operating procedure.'),
('11000000-0000-0000-0000-000000000027', 'e0000000-0000-0000-0000-000000000008', 'FAILED_TO_OFFER_ALTERNATIVES', 'Failed to provide appropriate alternatives', 'Did not offer viable backup solutions when primary request was unfeasible.'),
('11000000-0000-0000-0000-000000000028', 'e0000000-0000-0000-0000-000000000008', 'IMPROPER_ESCALATION', 'Unnecessary or improper escalation sequence', 'Escalated ticket that could have been resolved on first contact or sent to wrong queue.'),

-- Completeness of Resolution
('11000000-0000-0000-0000-000000000029', 'e0000000-0000-0000-0000-000000000009', 'MISSED_MYSMILE_PITCH', 'Did not adequately pitch the MySmile App', 'Omitted pitch for customer to download and utilize the self-service app.'),
('11000000-0000-0000-0000-000000000030', 'e0000000-0000-0000-0000-000000000009', 'MISSED_FURTHER_ASSISTANCE', 'Failed to ask if customer needs anything else', 'Did not offer further assistance before concluding the call.'),
('11000000-0000-0000-0000-000000000031', 'e0000000-0000-0000-0000-000000000009', 'INCORRECT_CLOSING', 'Did not use approved closing statement', 'Abrupt hang-up or informal closing verbiage.'),

-- CRM Accuracy & Completeness
('11000000-0000-0000-0000-000000000032', 'e0000000-0000-0000-0000-000000000010', 'INCOMPLETE_NOTES', 'CRM notes incomplete or missing vital details', 'Failed to document interaction steps, customer complaints, or actions taken.'),
('11000000-0000-0000-0000-000000000033', 'e0000000-0000-0000-0000-000000000010', 'INCORRECT_TAGGING', 'Ticket incorrectly tagged or query category misclassified', 'Misclassified ticket type or failed to tag all sub-queries.'),
('11000000-0000-0000-0000-000000000034', 'e0000000-0000-0000-0000-000000000010', 'TOOL_MISUSE', 'Ineffective use of support tools or failure to raise required ticket', 'Failed to trigger required back-office workflow or misconfigured JIRA entry.')
ON CONFLICT (id) DO NOTHING;

-- 8. Verbiage Guidelines (All 7 official parameters from Section 16)
INSERT INTO verbiage_guidelines (id, scorecard_id, parameter, language, suggested_verbiage, reference_guideline)
VALUES
(
    '12000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'Opening',
    'English',
    'Good [morning/afternoon/evening], thank you for calling Smile Telecom. My name is [Agent Name]. How may I assist you today?',
    'Must include time-of-day greeting, company name, agent name, and polite assistance offer. Clear articulation and warm vocal tone.'
),
(
    '12000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    'Security Checks',
    'English',
    'For security and account verification purposes, may I please have your full name, registered phone number, and account or SIM number?',
    'Verify mandatory identity parameters before accessing or revealing sensitive customer data. Check against system CRM records.'
),
(
    '12000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'Hold',
    'English',
    'May I place you on a brief hold for about 1 to 2 minutes while I look into your account details? ... Thank you for holding, I appreciate your patience.',
    'Always request permission and specify expected duration. Refresh within 30 seconds on initial hold and every 45 seconds thereafter. Thank the customer upon return.'
),
(
    '12000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000001',
    'Empathy',
    'English',
    'I truly understand how inconvenient this situation is for you, and I apologize for the trouble. Please be assured that I will do everything possible to resolve this today.',
    'Acknowledge customer frustration with genuine empathy. Do not give robotic apologies or apologize excessively without actionable ownership.'
),
(
    '12000000-0000-0000-0000-000000000005',
    'd0000000-0000-0000-0000-000000000001',
    'Escalation',
    'English',
    'I am escalating your ticket to our technical investigations team under reference [Ticket Number]. You will receive an update via SMS within 24 to 48 hours.',
    'Ensure all front-line troubleshooting steps were exhausted first. Clearly communicate ticket reference number and exact turnaround time (TAT).'
),
(
    '12000000-0000-0000-0000-000000000006',
    'd0000000-0000-0000-0000-000000000001',
    'Closing',
    'English',
    'You can also download our MySmile App from Google Play or Apple App Store for 24/7 instant account management and data recharge. Is there anything else I can assist you with today? ... Thank you for calling Smile Telecom. Have a wonderful day!',
    'Pitch the mobile application, ask for additional queries, and deliver the approved corporate sign-off.'
),
(
    '12000000-0000-0000-0000-000000000007',
    'd0000000-0000-0000-0000-000000000001',
    'System Downtime',
    'English',
    'Our account management portal is temporarily undergoing maintenance. I have documented your request details and will manually update your account as soon as service is restored.',
    'Remain calm and professional. Never blame internal IT negatively; reassure the customer of offline follow-up and create manual documentation.'
)
ON CONFLICT (id) DO NOTHING;
