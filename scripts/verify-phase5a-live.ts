import http from "http";

function fetchJson(url: string, options: any = {}): Promise<{ status: number; data: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve({ status: res.statusCode || 200, data, headers: res.headers });
          } catch {
            resolve({ status: res.statusCode || 200, data: body, headers: res.headers });
          }
        });
      }
    );
    req.on("error", reject);
    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runLiveHttpVerification() {
  console.log("===============================================================");
  console.log("LIVE HTTP ENDPOINT VERIFICATION (PORT 3005)");
  console.log("===============================================================");

  const baseUrl = "http://localhost:3005";

  // 1. GET /api/reviews
  console.log("\n[1] Testing GET /api/reviews");
  const queueRes = await fetchJson(`${baseUrl}/api/reviews`);
  if (queueRes.status !== 200 || !queueRes.data.success) {
    throw new Error(`GET /api/reviews failed with status ${queueRes.status}`);
  }
  console.log(`   -> PASS: Status 200. Total reviews in queue: ${queueRes.data.total}`);

  // 2. GET /api/reviews/:id
  const firstReview = queueRes.data.reviews[0];
  console.log(`\n[2] Testing GET /api/reviews/${firstReview.id}`);
  const reviewRes = await fetchJson(`${baseUrl}/api/reviews/${firstReview.id}`);
  if (reviewRes.status !== 200 || !reviewRes.data.success) {
    throw new Error(`GET /api/reviews/${firstReview.id} failed with status ${reviewRes.status}`);
  }
  const payload = reviewRes.data;
  console.log(`   Review Call ID: ${payload.call.id}`);
  console.log(`   Review Status:  ${payload.review.status} (Version: ${payload.review.version})`);
  console.log(`   Scorecard:      ${payload.call.scorecard_name} (${payload.review.decisions.length} parameters)`);
  console.log(`   Audio URL:      ${payload.signedAudioUrl ? "Generated Signed URL" : "None"}`);
  console.log("   -> PASS: Complete review workspace payload loaded successfully.");

  // 3. PUT /api/reviews/:id (Optimistic Concurrency & Draft Save)
  console.log(`\n[3] Testing PUT /api/reviews/${firstReview.id} (Draft Save & Concurrency)`);
  const currentVersion = payload.review.version;
  const param = payload.review.decisions[0];

  // 3a. Save valid draft
  const saveRes = await fetchJson(`${baseUrl}/api/reviews/${firstReview.id}`, {
    method: "PUT",
    body: {
      expectedVersion: currentVersion,
      decisions: [
        {
          parameter_id: param.parameter_id,
          review_action: "AGREED",
          human_result: "PASS",
          human_awarded_points: param.max_weight,
        },
      ],
    },
  });

  if (saveRes.status !== 200 || !saveRes.data.success) {
    throw new Error(`Draft save failed: ${JSON.stringify(saveRes.data)}`);
  }
  const newVersion = saveRes.data.review.version;
  console.log(`   Saved draft successfully. Version incremented: ${currentVersion} -> ${newVersion}`);

  // 3b. Test Concurrency Conflict (submit old version)
  const conflictRes = await fetchJson(`${baseUrl}/api/reviews/${firstReview.id}`, {
    method: "PUT",
    body: {
      expectedVersion: currentVersion, // Outdated version!
      decisions: [
        {
          parameter_id: param.parameter_id,
          review_action: "AGREED",
          human_result: "PASS",
          human_awarded_points: param.max_weight,
        },
      ],
    },
  });

  if (conflictRes.status !== 409) {
    throw new Error(`Expected HTTP 409 Conflict, got ${conflictRes.status}`);
  }
  console.log(`   -> PASS: HTTP 409 Conflict returned on stale version submission (${conflictRes.data.error}).`);

  // 4. GET /api/calibration
  console.log("\n[4] Testing GET /api/calibration");
  const calRes = await fetchJson(`${baseUrl}/api/calibration`);
  if (calRes.status !== 200 || !calRes.data.success) {
    throw new Error(`GET /api/calibration failed with status ${calRes.status}`);
  }
  const m = calRes.data.metrics;
  console.log(`   Overall Agreement: ${m.overallAgreementRate}%`);
  console.log(`   FAIL Recall:       ${m.failRecall}%`);
  console.log(`   PASS Precision:    ${m.passPrecision}%`);
  console.log(`   Evidence Accuracy: ${m.evidenceAccuracyRate}%`);
  console.log("   -> PASS: Calibration API returns complete deterministic metrics.");

  // 5. Test HTML Page Responses
  console.log("\n[5] Testing HTML Pages Rendering");
  const pages = ["/reviews", `/audits/${payload.review.audit_id}/review`, "/reports/ai-calibration"];
  for (const page of pages) {
    const pageRes = await fetchJson(`${baseUrl}${page}`);
    if (pageRes.status !== 200) {
      throw new Error(`Page ${page} returned status ${pageRes.status}`);
    }
    console.log(`   -> PASS: ${page.padEnd(45)} returned 200 OK`);
  }

  console.log("\n===============================================================");
  console.log("ALL LIVE HTTP VERIFICATIONS PASSED SUCCESSFULLY ON PORT 3005!");
  console.log("===============================================================");
}

runLiveHttpVerification().catch((err) => {
  console.error("\n[LIVE HTTP VERIFICATION FAILED]", err);
  process.exit(1);
});
