# Otya Shared Identity Contract v1

Status: proposed contract for review; not a production configuration or authorization grant.
Owner: Otya Auth / Otya Hold Ltd
Last reviewed: 2026-10-23

## 1. Goal

Provide one consistent Otya sign-in experience across supported products while preserving separate product, organization, and data permissions. Authentication proves which account is present; authorization decides what that account may do in a particular product and organization.

This document defines the integration contract before any product is connected. It does not enable a production cutover.

## 2. Product principles

- Otya Auth is the intended identity authority for Otya products.
- Use one branded sign-in experience and a central SSO flow; products must not invent incompatible local login screens or token formats.
- Use OpenID Connect / OAuth 2.1 Authorization Code with PKCE for browser and native public clients where supported by the reviewed implementation.
- Validate redirect URI exactly; use state and nonce; use PKCE S256; never place access tokens in URLs or logs.
- Keep product data and permissions separate. One account does not imply access to every product or organization.
- Offline-first features (especially local Otya Media playback) must continue to work when the identity service is unavailable, within the product's documented offline policy.
- Cloudflare Access may add a protection layer for internal/admin surfaces. It is not a substitute for public customer identity.

## 3. Canonical identity concepts

- `sub`: stable, opaque Otya account identifier. Never use email or phone number as the permanent primary key.
- `iss`: exact trusted issuer identifier for the deployed Otya Auth environment.
- `aud`: intended API or client audience. A token minted for one service must not be accepted by another unless that audience is explicitly authorized.
- `iat`, `exp`: issued-at and expiry timestamps in seconds.
- `sid`: session identifier for revocation and audit correlation, where supported.
- `jti`: unique token identifier where supported, for replay/revocation controls.
- `org` / membership: organization context must be resolved and validated server-side. Never trust a browser-supplied role or organization ID without checking membership.
- `scope`: narrowly granted API permissions, not a replacement for server-side resource-level authorization.

The exact signed claim schema, signing algorithm, key rotation, discovery metadata and JWKS endpoint must be approved from the deployed Otya Auth implementation before implementation. Do not infer them from this proposal.

## 4. Token acceptance rules

Every protected API must:

1. Fail closed when issuer configuration, key material, identity provider or required authorization data is missing.
2. Verify the signature using an explicitly allowlisted algorithm and trusted keys; reject algorithm confusion and malformed tokens.
3. Require the exact configured issuer and intended audience.
4. Validate expiry and issued-at with a small documented clock-skew allowance.
5. Validate the account is active and enforce session/token revocation according to the documented freshness limit.
6. Resolve current product and organization membership server-side; do not treat a role claim from an untrusted client as authority.
7. Enforce resource ownership and product-specific permissions on every request.
8. Return safe errors without exposing tokens, secrets, user enumeration details or internal exception messages.
9. Record security-relevant outcomes with a correlation ID while redacting credentials and personal data.

A missing rate limiter or identity dependency must not silently bypass authentication or authorization. Define outage behavior by operation class; financial, destructive, privileged and release operations must fail closed.

## 5. OTP and account recovery

- OTP delivery channels: email OTP initially if configured and verified; phone/SMS OTP is a separate provider and cost/security decision, not implied by email OTP.
- OTPs must be single-use, expire quickly, be bound to the intended account and purpose, and be invalidated after successful use or replacement.
- Apply rate limits to issue and verify endpoints by account/contact, IP/device signals and risk; use generic responses to reduce account enumeration.
- Store only a secure verifier/hash of OTP secrets where appropriate; never log OTP values.
- Limit attempts and resend frequency; monitor delivery failure and abuse.
- Account recovery must not be weaker than sign-in. High-risk staff and owner accounts need stronger recovery controls and step-up verification for sensitive actions.
- Session logout, account suspension, credential recovery and role removal must have documented revocation behavior.

## 6. Product authorization model

Identity is shared; permissions are product-scoped.

- OtyaHub: public content and account/profile features only, according to its own grants.
- Otya Media / Otya Player: optional account-linked features; local/offline playback must not depend on successful login.
- Otya Next: only explicitly granted assistant tools and data. Read-only by default; sensitive actions require human approval and an audit record.
- OmniPoint: organization-scoped retail and agency roles, with separate retail inventory/sales permissions and financial ledger/float permissions. Do not enable live money operations through an identity migration.
- Otya Core: service API identity must be distinct from end-user permissions; use least-privilege service credentials and explicit audience checks.
- Admin consoles: require stronger policy, short sessions where appropriate, step-up authentication and Cloudflare Access or equivalent additional controls.

Role names and permission mapping must be maintained in a server-side policy registry. Do not automatically map a global account to OmniPoint's SOVEREIGN, MANAGER, ATTENDANT or other privileged role. Privileged membership requires explicit provisioning, audit trail and review.

## 7. Current incompatibility that blocks integration

As inspected on 2026-10-23:

- `auth-worker/src/crypto.ts` currently defines an Otya Auth JWT payload containing `sub`, `email`, `iat` and `exp`.
- OmniPoint's isolated D1 scaffold independently verifies a custom HMAC token containing `sub`, `role`, `exp`, `iss: "omnipoint"` and `aud: "omnipoint-api"`.

These formats are not interchangeable. The scaffold's custom HMAC secret and client-facing role claims must not be reused as the shared identity contract. Do not connect OmniPoint's frontend to this scaffold using a token minted or transformed by the browser.

Before implementation, choose and review one of these approaches:
1. Otya Auth issues standard, audience-scoped tokens that each API verifies against trusted keys and current server-side authorization; or
2. A reviewed server-side token exchange creates a short-lived, audience-bound internal token after validating the original Otya Auth token and resolving current membership.

The decision must include key management/rotation, revocation freshness, token lifetime, organization membership, service audience, migration/rollback and incident response. No client-side role translation.

## 8. Acceptance tests required before product integration

### Token validation
- Valid signature, issuer, audience and expiry accepted.
- Missing/incorrect issuer or audience rejected.
- Expired token, future issued-at outside clock skew, malformed token and unsupported algorithm rejected.
- Wrong key, rotated/revoked key and tampered claims rejected.
- Token for Otya Core rejected by OmniPoint unless explicitly issued for the OmniPoint audience.
- Revoked session, suspended account and removed membership denied within the documented freshness bound.
- No secret, token or OTP is written to logs.

### Authorization
- Customer cannot access staff/admin endpoints.
- A user from organization A cannot read or mutate organization B's data.
- Browser-supplied role, owner ID or organization ID cannot elevate permissions.
- Staff role removal takes effect within the documented freshness bound.
- Service-to-service credentials cannot be used as end-user credentials.
- Financial, destructive and release actions fail closed if authorization or rate limiting is unavailable.

### OTP and sessions
- OTP expires, is single-use, and is invalidated by successful use or replacement.
- Brute-force, resend and enumeration controls work.
- Logout and recovery invalidate the appropriate session/refresh token.
- Step-up verification is required for configured high-risk actions.
- SSO return/callback validates state, nonce and PKCE; redirect URI allowlist is exact.

### Client behavior
- One branded login and consistent error/recovery experience across products.
- No tokens in URLs, analytics or crash logs.
- Android deep-link/callback handling validates state and exact redirect target.
- Otya Media local playback continues offline.
- Expired session returns to a safe re-authentication flow without losing unsaved work.

## 9. Implementation sequence

1. Inventory the actual deployed Otya Auth login, OTP, access-token, refresh-token, session and revocation behavior.
2. Decide the standard token profile and publish environment-specific issuer/audience/key configuration.
3. Implement verifier and policy tests in isolation; never weaken the existing verifier to make a test pass.
4. Add a server-side OmniPoint authorization adapter with explicit staff membership provisioning; keep the frontend disconnected until the tests pass.
5. Integrate one product at a time behind a test environment and review each PR.
6. Add cross-product SSO UI only after the protocol and callback behavior are verified.
7. Test recovery, revocation, account suspension, role changes, monitoring and rollback.
8. Require explicit approval before production policy changes, secret changes, route changes or deployment.

## 10. Non-goals and safety

- This proposal does not prove production readiness or confirm any OTP delivery provider is configured.
- It does not authorize live sales, mobile-money transactions, financial reconciliation or production database changes.
- It does not authorize automatic merging or deployment.
- Supabase remains backup/recovery only for the ecosystem policy; the isolated OmniPoint D1 migration scaffold remains test-only until the database architecture is explicitly reviewed.
