import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { evaluateFailoverReadiness } from "../../scripts/recovery/failover-gate.mjs";

/**
 * Synthetic-only recovery contract tests.
 * No provider SDKs, credentials, production records, or live services are used.
 */

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("synthetic D1 relational fixture preserves row and ledger invariants", () => {
  const accounts = [
    { id: "cash", openingMinor: 100_000 },
    { id: "float", openingMinor: 250_000 },
  ];
  const entries = [
    { transactionId: "txn-test-001", accountId: "cash", debitMinor: 10_000, creditMinor: 0 },
    { transactionId: "txn-test-001", accountId: "float", debitMinor: 0, creditMinor: 10_000 },
  ];

  assert.equal(accounts.length, 2);
  assert.ok(entries.every((entry) => accounts.some((account) => account.id === entry.accountId)));
  assert.equal(entries.reduce((sum, entry) => sum + entry.debitMinor, 0),
    entries.reduce((sum, entry) => sum + entry.creditMinor, 0));
  assert.equal(new Set(entries.map((entry) => `${entry.transactionId}:${entry.accountId}`)).size, entries.length);
});

test("synthetic KV backup retains TTL metadata and value checksum", () => {
  const source = [
    { key: "pilot:feature-flag", value: "enabled", expiresAt: "2030-01-01T00:00:00.000Z" },
    { key: "pilot:rate-limit", value: "3", expiresAt: null },
  ];
  const backup = structuredClone(source);
  assert.deepEqual(backup, source);
  for (const item of backup) {
    assert.equal(typeof item.key, "string");
    assert.equal(sha256(Buffer.from(item.value)), sha256(Buffer.from(source.find((row) => row.key === item.key).value)));
    assert.ok(item.expiresAt === null || !Number.isNaN(Date.parse(item.expiresAt)));
  }
});

test("synthetic R2 object manifest detects byte changes", () => {
  const original = Buffer.from("synthetic release artifact only\n");
  const manifest = { name: "pilot/release.txt", bytes: original.length, sha256: sha256(original) };
  assert.equal(manifest.bytes, original.length);
  assert.equal(manifest.sha256, sha256(original));
  const changed = Buffer.from("changed synthetic artifact\n");
  assert.notEqual(sha256(changed), manifest.sha256);
});

test("synthetic queue replay is idempotent by stable event ID", () => {
  const delivered = [
    { eventId: "evt-test-001", effect: "send-test-notification" },
    { eventId: "evt-test-001", effect: "send-test-notification" },
    { eventId: "evt-test-002", effect: "send-test-notification" },
  ];
  const applied = new Set();
  let effects = 0;
  for (const event of delivered) {
    if (applied.has(event.eventId)) continue;
    applied.add(event.eventId);
    effects += 1;
  }
  assert.equal(effects, 2);
  assert.deepEqual([...applied].sort(), ["evt-test-001", "evt-test-002"]);
});

test("standby is not ready when writer fencing is absent", () => {
  const result = evaluateFailoverReadiness({
    consecutiveProbeFailures: 3,
    primaryIncidentConfirmed: true,
    backupVerified: true,
    restoreSucceeded: true,
    smokeTestsPassed: true,
    writerFenced: false,
    singleWriterLeaseHeld: false,
    financialReconciliationReady: true,
    backupAgeMinutes: 5,
    maxBackupAgeMinutes: 60,
  });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("primary writer fencing not verified"));
  assert.ok(result.reasons.includes("single-writer lease not held"));
});

test("standby is not ready when backup exceeds the allowed recovery-point age", () => {
  const result = evaluateFailoverReadiness({
    consecutiveProbeFailures: 3,
    primaryIncidentConfirmed: true,
    backupVerified: true,
    restoreSucceeded: true,
    smokeTestsPassed: true,
    writerFenced: true,
    singleWriterLeaseHeld: true,
    financialReconciliationReady: true,
    backupAgeMinutes: 121,
    maxBackupAgeMinutes: 60,
  });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("backup exceeds the permitted recovery-point age"));
});
