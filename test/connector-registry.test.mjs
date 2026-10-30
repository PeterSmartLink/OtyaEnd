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

test("registry allow-lists contract fields and isolates caller-owned manifest objects", () => {
  const manifest = structuredClone(readOnlyManifest);
  manifest.privatePayload = { token: "should-not-be-exposed" };
  const registry = createConnectorRegistry([manifest]);

  manifest.capabilities[0].requiredScopes.push("admin");
  manifest.privatePayload.token = "mutated-after-registration";

  const stored = registry.get("example-status");
  assert.deepEqual(Object.keys(stored).sort(), ["capabilities", "id", "publisher", "state", "version"]);
  assert.equal("privatePayload" in stored, false);
  assert.deepEqual(stored.capabilities[0].requiredScopes, ["service:status:read"]);
  assert.equal(Object.isFrozen(stored), true);
  assert.equal(Object.isFrozen(stored.capabilities[0]), true);
});

test("rejects duplicate capability names and malformed scope declarations", () => {
  const duplicate = structuredClone(readOnlyManifest);
  duplicate.capabilities.push(structuredClone(duplicate.capabilities[0]));
  assert.equal(validateConnectorManifest(duplicate).ok, false);

  const malformedScopes = structuredClone(readOnlyManifest);
  malformedScopes.capabilities[0].requiredScopes = ["service:status:read", ""];
  assert.equal(validateConnectorManifest(malformedScopes).ok, false);
});

test("fails closed for missing registry, missing connector, and unsupported modes", () => {
  assert.deepEqual(authorizeConnectorCapability({ registry: null, connectorId: "x", capabilityName: "x" }), {
    allowed: false, code: "registry_unavailable",
  });

  const registry = createConnectorRegistry([readOnlyManifest]);
  assert.equal(authorizeConnectorCapability({
    registry, connectorId: "not-registered", capabilityName: "service.status.read",
  }).code, "connector_not_found");

  assert.equal(authorizeConnectorCapability({
    registry, connectorId: "example-status", capabilityName: "service.status.read",
    grantedScopes: ["service:status:read"], mode: "execute",
  }).code, "mode_not_supported");
});

test("retired and draft connectors cannot be authorized", () => {
  for (const state of ["draft", "retired"]) {
    const registry = createConnectorRegistry([{ ...readOnlyManifest, state }]);
    assert.equal(authorizeConnectorCapability({
      registry, connectorId: "example-status", capabilityName: "service.status.read",
      grantedScopes: ["service:status:read"],
    }).code, "connector_not_enabled");
  }
});

test("registry metadata is isolated from mutable nested input objects", () => {
  const manifest = structuredClone(readOnlyManifest);
  const registry = createConnectorRegistry([manifest]);
  manifest.capabilities[0].name = "service.admin.write";
  manifest.capabilities[0].requiredScopes[0] = "admin";

  const stored = registry.get("example-status");
  assert.equal(stored.capabilities[0].name, "service.status.read");
  assert.deepEqual(stored.capabilities[0].requiredScopes, ["service:status:read"]);
});

