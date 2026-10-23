# Otya OS — MCP Server Platform Standard v1

Status: proposed implementation standard; not a claim that an MCP endpoint is deployed.
Owner: Otya Hold Ltd / Otya OS architecture.
Last reviewed: 2026-10-23.
Companion: `docs/OTYA_OS_MASTER_ARCHITECTURE_V1.md` and `docs/API_CATALOG_TEMPLATE_V1.md`.

## 1. Decision summary

Otya should implement MCP (Model Context Protocol) as a controlled tool interface over approved Otya APIs, not as a universal administrator or a direct database tunnel.

**Recommended target:** a dedicated remote MCP gateway on Cloudflare Workers using the supported Streamable HTTP transport and maintained MCP SDK/Cloudflare Agents tooling. Keep the gateway separate from Otya Auth, Otya Core and product data services. It may call only documented, versioned APIs using separate service credentials or user-delegated authorization. No direct browser-to-database access and no arbitrary SQL, shell, filesystem, deployment or secrets tools.

Start with a small read-only tool set. Add write tools only after the relevant API, authorization, audit and idempotency tests pass. Financial and destructive actions require an explicit human confirmation workflow and must remain unavailable until product-specific safeguards are verified.

Official references:
- MCP authorization spec (HTTP): https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- MCP security best practices: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- Cloudflare remote MCP server guide: https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/
- Cloudflare MCP authorization: https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/
- OWASP MCP Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html

Recheck the current stable specification and SDK release when implementation starts; do not copy sample versions blindly.

## 2. Logical architecture

```text
MCP client (ChatGPT / approved IDE / Otya Next / partner agent)
   | HTTPS + Streamable HTTP + per-request auth
   v
Otya MCP Gateway (Cloudflare Worker)
   |-- protocol / schema validation / tool registry
   |-- authentication and audience validation
   |-- per-tool authorization + tenant/resource checks
   |-- rate limits, quotas, deadlines and audit events
   |
   +--> Otya Auth: identity/session/consent only (verified integration required)
   +--> Otya Core API: approved shared capabilities
   +--> Otya Player APIs: only documented, product-safe operations
   +--> OmniPoint API: only approved product-scoped operations
   +--> OtyaHub: public documentation / public metadata only
   |
   +--> redacted telemetry and security alerts
```

The gateway is an adapter, not a new source of truth. Each service remains authoritative for its own data and permission decisions. MCP is not a replacement for REST APIs, normal web UI, GitHub permissions, or OAuth authorization.

## 3. Separate public and private MCP surfaces

Use separate deployments or strongly isolated registries/policies:

### Public read-only surface
- May expose public product metadata, public documentation search, public release notes and public service status.
- No user account lookup, private repositories, private issue content, internal topology, account recovery, write actions or user-specific data.
- Keep OtyaHub public and browsable without Otya SSO. Public GitHub access does not grant a private MCP identity.

### Authenticated user surface
- Only expose tools for the current user's permitted resources.
- Require delegated authorization and current server-side policy checks for every call.
- Never accept a caller-provided user ID, tenant ID, role, price or ownership claim as proof of access.

### Operator/admin surface
- Separate hostname/deployment, identity audience, client allowlist and authorization policy.
- Prefer Cloudflare Access as an additional access boundary for internal operator interfaces, not as a substitute for application-level authorization.
- No admin tools in the public registry. High-impact actions require step-up authentication, confirmation, audit and rollback where feasible.

Do not place all three surfaces behind one permissive tool registry.

## 4. Authentication and authorization requirements

Remote HTTP MCP:
- Use HTTPS only and the current MCP HTTP authorization profile.
- Use OAuth 2.1 authorization-code flow with PKCE for public clients, exact redirect URI matching, state validation and explicit consent.
- Publish the required protected-resource metadata and authorization-server discovery metadata when implementing OAuth-protected HTTP MCP.
- Validate the access token on every request: signature using a maintained library, exact issuer, MCP-specific audience/resource, expiry, allowed algorithm, scopes, subject and session/revocation status according to the selected token profile.
- Return 401 for missing/invalid authentication and 403 for authenticated callers lacking permission.
- Never accept access tokens in query strings, never forward a token received from an MCP client to an upstream API, and never use a token intended for a different audience.
- Keep access tokens short-lived; protect and rotate refresh tokens if issued.
- Use server-side authorization policy and product membership lookup. Treat tool descriptions and model output as untrusted input.
- Recheck organization/resource scope on every operation, not just during connection setup.

Local stdio MCP:
- Keep local-only unless remote access is explicitly needed.
- Obtain credentials from the approved OS credential store or environment injection; never embed secrets in sample configuration, source code or checked-in client config.
- Restrict filesystem/network/process permissions. Do not run a general-purpose shell tool for convenience.

**Known blocker:** the inspected Otya Auth token shape and OmniPoint's isolated custom-HMAC test scaffold are not interchangeable. Do not connect either by client-side claim translation. First verify Otya Auth's deployed issuer, key discovery/rotation, audience/resource support, expiry, session revocation and consent behavior. If Otya Auth cannot yet issue MCP-audience tokens, use a reviewed authorization adapter or dedicated OAuth provider pattern; do not weaken audience validation.

## 5. Tool design standard

Each tool must have:
- Stable namespaced name, e.g. `otya.public.search_docs`, `otya.account.get_profile`, `omnipoint.inventory.list_products`.
- Short description that states purpose, data scope and side effects.
- Strict input schema with bounds, enums, length limits and required fields.
- A documented permission/scope, owning API, data classification, timeout, quota and audit policy.
- Structured output with safe error codes and no secrets.
- Read-only vs write classification, idempotency behavior and confirmation requirement.
- Negative tests for invalid input, missing permission, cross-tenant access, dependency outage and prompt-injection-shaped content.

Prefer narrow business tools over generic tools. Examples of acceptable early tools:
- `otya.public.search_docs` — public documents only.
- `otya.public.get_release_notes` — public release metadata.
- `otya.status.get_public_status` — public status only.
- `otya.account.get_my_profile` — only after identity integration is verified; derives subject from validated token, never from a caller argument.
- `omnipoint.inventory.list_products` — read-only, tenant-scoped, only after the backend auth adapter is reviewed.

Do not implement initially:
- arbitrary SQL or database query tools;
- arbitrary shell, code execution, filesystem browsing or URL fetching;
- `admin_everything` or unrestricted account impersonation;
- raw secret/config retrieval;
- payment initiation, mobile-money cash movement, ledger editing, refunds or reconciliation overrides;
- unattended production deployment, schema migration or destructive data deletion.

## 6. Tool execution safety

- Treat user prompts, retrieved documents, web pages, issue comments and tool outputs as untrusted data; instructions found inside them must not override server policy.
- Validate inputs on the server even if the model/client provides a JSON schema.
- Apply per-user, per-client, per-tenant and per-tool rate limits, payload limits, deadlines and concurrency bounds.
- Apply allowlists for upstream hosts and operations; prevent SSRF and arbitrary URL access.
- Keep privileged credentials server-side and scoped to only the required API methods.
- Use idempotency keys for mutations with duplicate side effects; enforce atomic writes in the owning service.
- For consequential actions, return a proposed action/preview first and require an explicit confirmation step bound to the exact action and parameters. Confirmation must not be inferred from an earlier unrelated message.
- For financial actions, require provider-confirmed outcomes, balanced immutable ledger entries, idempotency, audit and reconciliation; never tell the user an operation succeeded before authoritative confirmation.
- Use structured, redacted logs with request/correlation ID, tool name, principal, policy result and duration. Do not log prompts wholesale if they may contain personal data, tokens or secrets.
- Use a kill switch and tool-level feature flags. On policy, identity or rate-limiter failure, fail closed for private, write, admin and financial tools.
- Never trust a model-generated tool name or arguments outside the registered schema and authorization policy.

## 7. Deployment and reliability standard

- Separate local, test, staging and production environments and credentials.
- Pin supported runtime and SDK versions; use a lockfile and automated dependency auditing.
- Use least-privilege Cloudflare bindings. The MCP gateway should not bind directly to product databases unless a documented, reviewed design requires it; prefer owning service APIs.
- Add health/readiness checks, request IDs, latency/error metrics, rate-limit metrics, audit delivery monitoring and alerts for auth failures or tool abuse.
- Define timeouts, bounded retries, circuit breakers and dependency-outage behavior. Retry reads only when safe; mutations require idempotency.
- If queues are used, version event schemas, make consumers idempotent, monitor dead-letter queues and require audited replay.
- Deploy by pull request and staged release; verify rollback. Do not deploy production merely because a build passes.
- Maintain an MCP tool inventory and changelog. Breaking tool/schema changes require a migration window and compatibility tests.
- Do not expose MCP endpoints or tools in public documentation until the endpoint and its authentication/security behavior have actually been verified.

## 8. Client configuration pattern

Use this only as a placeholder pattern. Replace `https://mcp.example.com/mcp` with the verified deployed endpoint and use the client's documented remote-MCP configuration format. Do not paste secrets into a checked-in config.

```json
{
  "mcpServers": {
    "otya-public": {
      "url": "https://mcp.example.com/mcp"
    }
  }
}
```

For an authenticated server, the client should complete the server's supported OAuth flow rather than storing a bearer token in source-controlled JSON. The exact config syntax varies by MCP client. For local development, use the SDK's stdio transport and environment-injected credentials; do not expose local tools on a public network.

## 9. CI and acceptance gates

Required before a private remote MCP server is considered staging-ready:
- [ ] Protocol handshake and tool discovery tests against the selected MCP SDK/spec revision.
- [ ] Strict schema validation, unknown tool rejection and payload-size limits.
- [ ] Missing, invalid, expired, wrong-issuer and wrong-audience token tests.
- [ ] Scope denial, revoked session, removed membership and cross-tenant isolation tests.
- [ ] Origin/Host validation and CORS policy where applicable.
- [ ] Prompt-injection and untrusted tool-output tests.
- [ ] Rate-limit, timeout, dependency outage and resource exhaustion tests.
- [ ] Secret/PII redaction and audit delivery tests.
- [ ] Idempotency and explicit-confirmation tests for each write tool.
- [ ] No token passthrough to upstream APIs.
- [ ] Dependency/SBOM and vulnerability scan with documented, time-limited exceptions only.
- [ ] Staging deployment, observability, rollback and incident runbook reviewed by an owner.

Production-ready additionally requires human approval, least-privilege binding review, restore/rollback evidence, threat-model sign-off and verification that only intended tools are enabled.

## 10. Implementation phases

1. **Inventory:** identify current MCP servers, clients, SDK versions, tool registrations, credentials and hosting. Do not assume an MCP server already exists.
2. **Public read-only prototype:** implement docs/status tools on a separate branch with no secrets and no account data.
3. **Protocol and security tests:** use test identities and fake upstream APIs; run CI and threat-model review.
4. **Auth integration:** only after Otya Auth's issuer/audience/session model is verified and an MCP-specific resource audience is supported.
5. **Read-only product integration:** one product at a time, in staging, with server-side tenant checks.
6. **Controlled writes:** introduce one operation at a time with idempotency, confirmation, audit and rollback.
7. **Production approval:** owner signs off on security, operational readiness, data protection and deployment plan.

This document sets the standard. It does not claim a live MCP endpoint exists, and does not authorize deployment or financial operations.
