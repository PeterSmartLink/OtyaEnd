#!/usr/bin/env node
/**
 * Verify a recovery bundle manifest without changing any source system.
 *
 * Usage:
 *   node scripts/recovery/verify-backup-manifest.mjs <bundle-directory>
 *
 * Expected manifest.json:
 * {
 *   "formatVersion": 1,
 *   "createdAt": "2026-01-01T00:00:00.000Z",
 *   "source": "cloudflare",
 *   "resources": [
 *     { "name": "example.sql", "sha256": "<64 lowercase hex chars>", "bytes": 123 }
 *   ]
 * }
 *
 * This validates files already present in a bundle; it does not export data,
 * decrypt archives, restore a database, or prove business-level consistency.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const fail = (message) => {
  console.error(`BACKUP VERIFY FAILED: ${message}`);
  process.exitCode = 1;
};

async function sha256File(filePath) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), bytes };
}

async function main() {
  const input = process.argv[2];
  if (!input || process.argv.length > 3) {
    throw new Error("Usage: node scripts/recovery/verify-backup-manifest.mjs <bundle-directory>");
  }

  const bundleDir = await realpath(input);
  const manifestPath = path.join(bundleDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  if (manifest.formatVersion !== 1) throw new Error("Unsupported formatVersion; expected 1");
  if (typeof manifest.createdAt !== "string" || Number.isNaN(Date.parse(manifest.createdAt))) {
    throw new Error("createdAt must be a valid ISO-compatible timestamp");
  }
  if (manifest.createdAt && Date.parse(manifest.createdAt) > Date.now() + 5 * 60_000) {
    throw new Error("createdAt is more than five minutes in the future");
  }
  if (typeof manifest.source !== "string" || !manifest.source.trim()) {
    throw new Error("source must be a non-empty string");
  }
  if (!Array.isArray(manifest.resources) || manifest.resources.length === 0) {
    throw new Error("resources must be a non-empty array");
  }

  const seen = new Set();
  for (const resource of manifest.resources) {
    if (!resource || typeof resource.name !== "string" || !resource.name.trim()) {
      throw new Error("each resource needs a name");
    }
    if (resource.name === "manifest.json" || path.isAbsolute(resource.name) ||
        resource.name.split(/[\\/]/).includes("..") || resource.name.includes("\\0")) {
      throw new Error(`unsafe resource path: ${resource.name}`);
    }
    if (seen.has(resource.name)) throw new Error(`duplicate resource name: ${resource.name}`);
    seen.add(resource.name);
    if (!/^[a-f0-9]{64}$/.test(resource.sha256)) {
      throw new Error(`invalid SHA-256 for ${resource.name}`);
    }
    if (!Number.isSafeInteger(resource.bytes) || resource.bytes < 0) {
      throw new Error(`invalid byte count for ${resource.name}`);
    }

    const filePath = path.resolve(bundleDir, resource.name);
    if (!filePath.startsWith(bundleDir + path.sep)) throw new Error(`resource escapes bundle: ${resource.name}`);
    const info = await lstat(filePath);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`resource must be a regular file: ${resource.name}`);
    const actualPath = await realpath(filePath);
    if (!actualPath.startsWith(bundleDir + path.sep)) throw new Error(`resource resolves outside bundle: ${resource.name}`);

    const actual = await sha256File(actualPath);
    if (actual.bytes !== resource.bytes) {
      throw new Error(`size mismatch for ${resource.name}: expected ${resource.bytes}, got ${actual.bytes}`);
    }
    if (actual.sha256 !== resource.sha256) throw new Error(`SHA-256 mismatch for ${resource.name}`);
    console.log(`OK ${resource.name} (${actual.bytes} bytes)`);
  }

  console.log(`Verified ${manifest.resources.length} resource(s); source=${manifest.source}; createdAt=${manifest.createdAt}`);
  console.log("Note: checksum verification is not a database restore or application-consistency test.");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
