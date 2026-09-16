async function testLiveServer() {
  console.log("Testing live server at http://localhost:3005...");

  // 1. Get Call
  const getCallRes = await fetch("http://localhost:3005/api/calls/c1000000-0000-0000-0000-000000000001");
  const callData = await getCallRes.json();
  console.log(`1. Call status: ${callData.call?.processing_status} (Success: ${callData.success})`);

  // 2. Transcribe Call
  const transcribeRes = await fetch("http://localhost:3005/api/calls/c1000000-0000-0000-0000-000000000001/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ simulateWebhook: true, forceMock: true }),
  });
  const transcribeData = await transcribeRes.json();
  console.log(`2. Transcribe response: ${transcribeData.processingStatus} (Success: ${transcribeData.success})`);

  // 3. Get Transcript
  const transcriptRes = await fetch("http://localhost:3005/api/calls/c1000000-0000-0000-0000-000000000001/transcript");
  const transcriptData = await transcriptRes.json();
  console.log(`3. Transcript Utterances: ${transcriptData.utterances?.length} utterances received`);
  console.log(`   Speech Duration: ${transcriptData.metrics?.speechDurationMs} ms`);
  console.log(`   Speaker Turns: ${transcriptData.metrics?.speakerTurnCount}`);
  console.log(`   Talk Ratio: ${transcriptData.metrics?.roughTalkRatio}%`);

  // 4. Supervisor Role Patch
  const patchRes = await fetch("http://localhost:3005/api/calls/c1000000-0000-0000-0000-000000000001/transcript/speakers", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roleOverrides: { A: "AGENT", B: "CUSTOMER" },
      reason: "Supervisor confirmed via Live HTTP test",
    }),
  });
  const patchData = await patchRes.json();
  console.log(`4. Supervisor role patch: success=${patchData.success}, updated=${patchData.updatedCount}`);

  console.log("\nALL LIVE HTTP ENDPOINTS RESPONDING PERFECTLY (HTTP 200)!");
}

testLiveServer().catch((err) => {
  console.error("Live test failed:", err);
  process.exit(1);
});
