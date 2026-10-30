/**
 * Pure failover readiness gate. This module never changes traffic or data.
 * A separate, authenticated controller must consume the decision and enforce
 * a single-writer lease before any production route change is permitted.
 */
export function evaluateFailoverReadiness(input) {
  const reasons = [];
  if (!input || typeof input !== "object") {
    return { ready: false, reasons: ["missing readiness input"] };
  }
  if (!Number.isInteger(input.consecutiveProbeFailures) || input.consecutiveProbeFailures < 3) {
    reasons.push("insufficient consecutive independent probe failures");
  }
  if (input.primaryIncidentConfirmed !== true) reasons.push("primary incident not confirmed");
  if (input.backupVerified !== true) reasons.push("backup integrity not verified");
  if (input.restoreSucceeded !== true) reasons.push("isolated restore not successful");
  if (input.smokeTestsPassed !== true) reasons.push("recovery smoke tests did not pass");
  if (input.writerFenced !== true) reasons.push("primary writer fencing not verified");
  if (input.singleWriterLeaseHeld !== true) reasons.push("single-writer lease not held");
  if (input.financialReconciliationReady !== true) reasons.push("financial reconciliation readiness not confirmed");
  if (!Number.isFinite(input.backupAgeMinutes) || input.backupAgeMinutes < 0) {
    reasons.push("backup age is missing or invalid");
  } else if (!Number.isFinite(input.maxBackupAgeMinutes) || input.maxBackupAgeMinutes <= 0 ||
             input.backupAgeMinutes > input.maxBackupAgeMinutes) {
    reasons.push("backup exceeds the permitted recovery-point age");
  }
  return { ready: reasons.length === 0, reasons };
}
