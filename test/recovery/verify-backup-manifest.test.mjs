import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const script = path.resolve("scripts/recovery/verify-backup-manifest.mjs");
const fixtureBytes = Buffer.from("safe recovery test fixture\n");
const digest = createHash("sha256").update(fixtureBytes).digest("hex");

async function makeBundle(t, manifestOverride = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "otya-recovery-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, "sample.sql"), fixtureBytes);
  const manifest = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    source: "test-fixture",
    resources: [{ name: "sample.sql", sha256: digest, bytes: fixtureBytes.length }],
    ...manifestOverride,
  };
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest));
  return dir;
}

test("accepts a valid bundle and prints a verification summary", async (t) => {
  const dir = await makeBundle(t);
  const output = execFileSync(process.execPath, [script, dir], { encoding: "utf8" });
  assert.match(output, /Verified 1 resource/);
  assert.match(output, /not a database restore/);
});

test("rejects tampered resource content", async (t) => {
  const dir = await makeBundle(t);
  await writeFile(path.join(dir, "sample.sql"), "tampered");
  const result = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /size mismatch|SHA-256 mismatch/);
});

test("rejects path traversal in manifest", async (t) => {
  const dir = await makeBundle(t, {
    resources: [{ name: "../outside.sql", sha256: digest, bytes: fixtureBytes.length }],
  });
  const result = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsafe resource path/);
});

test("rejects duplicate resource names", async (t) => {
  const dir = await makeBundle(t, {
    resources: [
      { name: "sample.sql", sha256: digest, bytes: fixtureBytes.length },
      { name: "sample.sql", sha256: digest, bytes: fixtureBytes.length },
    ],
  });
  const result = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate resource name/);
});

test("rejects future-dated manifest", async (t) => {
  const dir = await makeBundle(t, { createdAt: new Date(Date.now() + 60 * 60_000).toISOString() });
  const result = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /future/);
});
