import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeConnectorCapability,
  createConnectorRegistry,
  validateConnectorManifest,
} from "../lib/connectors/registry.mjs";

const readOnlyManifest = {
  id: "example-status",
  version: "1.0.0",
  publisher: "Otya Hold Ltd",
  state: "enabled",
  capabilities: [{
    name: "service.status.read",
    risk: "read",
    requiredScopes: ["service:status:read"],
    readOnly: true,
    requiresApproval: false,
  }],
};

test("validates an explicit read-only connector manifest", () => {
  assert.deepEqual(validateConnectorManifest(readOnlyManifest), { ok: true, errors: [] });
});

test("rejects manifests without explicit risk and read-only declarations", () => {
  const invalid = structuredClone(readOnlyManifest);
  delete invalid.capabilities[0].readOnly;
  delete invalid.capabilities[0].risk;
  assert.equal(validateConnectorManifest(invalid).ok, false);
});

test("rejects duplicate connector IDs", () => {
  assert.throws(
    () => createConnectorRegistry([readOnlyManifest, readOnlyManifest]),
    /Duplicate connector id/,
  );
});

test("allows a read-only capability only when the connector is enabled and scope is present", () => {
  const registry = createConnectorRegistry([readOnlyManifest]);
  assert.equal(authorizeConnectorCapability({
    registry,
    connectorId: "example-status",
    capabilityName: "service.status.read",
    grantedScopes: ["service:status:read"],
  }).allowed, true);
  assert.deepEqual(authorizeConnectorCapability({
    registry,
    connectorId: "example-status",
    capabilityName: "service.status.read",
    grantedScopes: [],
  }), { allowed: false, code: "insufficient_scope" });
});

test("denies write mode, suspended connectors, and write capabilities by default", () => {
  const writeManifest = {
    ...readOnlyManifest,
    id: "example-write",
    capabilities: [{
      name: "service.config.write",
      risk: "write",
      requiredScopes: ["service:config:write"],
      readOnly: false,
      requiresApproval: true,
    }],
  };
  const registry = createConnectorRegistry([readOnlyManifest, writeManifest]);
  assert.equal(authorizeConnectorCapability({
    registry, connectorId: "example-status", capabilityName: "service.status.read",
    grantedScopes: ["service:status:read"], mode: "write",
  }).code, "mode_not_supported");
  assert.equal(authorizeConnectorCapability({
    registry, connectorId: "example-write", capabilityName: "service.config.write",
    grantedScopes: ["service:config:write"],
  }).code, "read_only_mode_denies_capability");

  const suspended = createConnectorRegistry([{ ...readOnlyManifest, state: "suspended" }]);
  assert.equal(authorizeConnectorCapability({
    registry: suspended, connectorId: "example-status", capabilityName: "service.status.read",
    grantedScopes: ["service:status:read"],
  }).code, "connector_not_enabled");
});

test("registry output omits internal implementation fields and does not expose mutable internal arrays", () => {
  const registry = createConnectorRegistry([readOnlyManifest]);
  const listed = registry.list();
  listed[0].capabilities[0].requiredScopes.push("admin");
  assert.deepEqual(registry.get("example-status").capabilities[0].requiredScopes, ["service:status:read"]);
});
