/**
 * Experimental connector registry primitives.
 *
 * This module intentionally does not execute connector code, fetch arbitrary URLs,
 * access databases, or grant permissions. It is safe metadata/policy groundwork,
 * not a deployed connector API or authentication substitute.
 */

const ALLOWED_RISKS = new Set(["read", "write", "sensitive", "financial", "destructive"]);
const ID_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

export function validateConnectorManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { ok: false, errors: ["manifest must be an object"] };
  }

  if (typeof manifest.id !== "string" || !ID_PATTERN.test(manifest.id)) {
    errors.push("id must be a lowercase stable identifier");
  }
  if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    errors.push("version must be semantic MAJOR.MINOR.PATCH");
  }
  if (typeof manifest.publisher !== "string" || !manifest.publisher.trim()) {
    errors.push("publisher is required");
  }
  if (!["draft", "enabled", "suspended", "retired"].includes(manifest.state)) {
    errors.push("state must be draft, enabled, suspended, or retired");
  }
  if (!Array.isArray(manifest.capabilities)) {
    errors.push("capabilities must be an array");
  } else {
    const names = new Set();
    for (const [index, capability] of manifest.capabilities.entries()) {
      const prefix = `capabilities[${index}]`;
      if (!capability || typeof capability !== "object" || Array.isArray(capability)) {
        errors.push(`${prefix} must be an object`);
        continue;
      }
      if (typeof capability.name !== "string" || !CAPABILITY_PATTERN.test(capability.name)) {
        errors.push(`${prefix}.name is invalid`);
      } else if (names.has(capability.name)) {
        errors.push(`duplicate capability: ${capability.name}`);
      } else {
        names.add(capability.name);
      }
      if (!ALLOWED_RISKS.has(capability.risk)) errors.push(`${prefix}.risk is invalid`);
      if (!Array.isArray(capability.requiredScopes) ||
          capability.requiredScopes.some(scope => typeof scope !== "string" || !scope.trim())) {
        errors.push(`${prefix}.requiredScopes must be an array of non-empty strings`);
      }
      if (typeof capability.readOnly !== "boolean") {
        errors.push(`${prefix}.readOnly must be explicitly true or false`);
      }
      if (capability.readOnly === true && capability.risk !== "read") {
        errors.push(`${prefix}: read-only capabilities must use read risk`);
      }
      if (capability.requiresApproval !== true && capability.requiresApproval !== false) {
        errors.push(`${prefix}.requiresApproval must be explicit`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function createConnectorRegistry(manifests) {
  if (!Array.isArray(manifests)) throw new TypeError("manifests must be an array");

  const connectors = new Map();
  for (const manifest of manifests) {
    const validation = validateConnectorManifest(manifest);
    if (!validation.ok) {
      throw new TypeError(`Invalid connector manifest: ${validation.errors.join("; ")}`);
    }
    if (connectors.has(manifest.id)) throw new TypeError(`Duplicate connector id: ${manifest.id}`);
    // Copy only contract fields. Unknown manifest fields may contain mutable objects,
    // secrets, executable-looking metadata, or values the registry never meant to expose.
    connectors.set(manifest.id, Object.freeze({
      id: manifest.id,
      version: manifest.version,
      publisher: manifest.publisher,
      state: manifest.state,
      capabilities: Object.freeze(manifest.capabilities.map(capability =>
        Object.freeze({
          name: capability.name,
          risk: capability.risk,
          requiredScopes: Object.freeze([...capability.requiredScopes]),
          readOnly: capability.readOnly,
          requiresApproval: capability.requiresApproval,
        })
      )),
    }));
  }

  return Object.freeze({
    list() {
      return [...connectors.values()].map(manifest => ({
        id: manifest.id,
        version: manifest.version,
        publisher: manifest.publisher,
        state: manifest.state,
        capabilities: manifest.capabilities.map(({ name, risk, requiredScopes, readOnly, requiresApproval }) => ({
          name, risk, requiredScopes: [...requiredScopes], readOnly, requiresApproval,
        })),
      }));
    },
    get(connectorId) {
      return connectors.get(connectorId) ?? null;
    },
  });
}

/**
 * Fail-closed policy decision. This does not authenticate a caller; callers must
 * supply a verified actor and effective scopes from the owning auth layer.
 */
export function authorizeConnectorCapability({ registry, connectorId, capabilityName, grantedScopes = [], mode = "read" }) {
  if (!registry || typeof registry.get !== "function") {
    return { allowed: false, code: "registry_unavailable" };
  }
  if (mode !== "read") return { allowed: false, code: "mode_not_supported" };

  const manifest = registry.get(connectorId);
  if (!manifest) return { allowed: false, code: "connector_not_found" };
  if (manifest.state !== "enabled") return { allowed: false, code: "connector_not_enabled" };

  const capability = manifest.capabilities.find(item => item.name === capabilityName);
  if (!capability) return { allowed: false, code: "capability_not_found" };
  if (!capability.readOnly || capability.risk !== "read") {
    return { allowed: false, code: "read_only_mode_denies_capability" };
  }

  const scopes = new Set(Array.isArray(grantedScopes) ? grantedScopes : []);
  if (!capability.requiredScopes.every(scope => scopes.has(scope))) {
    return { allowed: false, code: "insufficient_scope" };
  }
  return {
    allowed: true,
    code: "allowed",
    connectorId: manifest.id,
    connectorVersion: manifest.version,
    capability: capability.name,
    risk: capability.risk,
  };
}
