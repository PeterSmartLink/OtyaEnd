import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFailoverReadiness } from "../../scripts/recovery/failover-gate.mjs";

const readyInput = {
  consecutiveProbeFailures: 3,
  primaryIncidentConfirmed: true,
  backupVerified: true,
  restoreSucceeded: true,
  smokeTestsPassed: true,
  writerFenced: true,
  singleWriterLeaseHeld: true,
  financialReconciliationReady: true,
  backupAgeMinutes: 10,
  maxBackupAgeMinutes: 60,
};

test("permits readiness only when every safety gate passes", () => {
  assert.deepEqual(evaluateFailoverReadiness(readyInput), { ready: true, reasons: [] });
});

test("fails closed when primary failure is not confirmed", () => {
  const result = evaluateFailoverReadiness({ ...readyInput, primaryIncidentConfirmed: false });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("primary incident not confirmed"));
});

test("fails closed if the primary writer cannot be fenced", () => {
  const result = evaluateFailoverReadiness({ ...readyInput, writerFenced: false });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("primary writer fencing not verified"));
});

test("fails closed for a stale backup", () => {
  const result = evaluateFailoverReadiness({ ...readyInput, backupAgeMinutes: 61 });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("backup exceeds the permitted recovery-point age"));
});

test("fails closed when restore or reconciliation is incomplete", () => {
  const result = evaluateFailoverReadiness({
    ...readyInput,
    restoreSucceeded: false,
    financialReconciliationReady: false,
  });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("isolated restore not successful"));
  assert.ok(result.reasons.includes("financial reconciliation readiness not confirmed"));
});

test("requires multiple consecutive probe failures", () => {
  const result = evaluateFailoverReadiness({ ...readyInput, consecutiveProbeFailures: 1 });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("insufficient consecutive independent probe failures"));
});
