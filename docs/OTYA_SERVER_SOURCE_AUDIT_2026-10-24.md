# Otya Server source readiness review

Audit date: 2026-10-24  
Repository: PeterSmartLink/Otya-Server  
Scope: Read-only review of checked-in source and configuration. This is not a live Cloudflare audit, penetration test, or certification.

## Assessment

Otya Server is already a substantial platform. The repository contains a Cloudflare core Worker, a separate authentication Worker, an Otya Next service binding, D1/KV/R2/Queues/Analytics bindings, release workflows, security documentation, migration checks, and automated tests. The right path is to extend this system rather than build a parallel backend.

## Verified strengths

- The core Worker is configured as `otya-core`; `workers.dev` is disabled, official hostnames are declared, and observability redacts query strings.
- Separate service bindings exist for Otya Auth and Otya Next.
- The router applies browser security headers to HTML responses and calls Otya Auth through a service binding for Together identity checks.
- JWT verification pins the algorithm to HS256, verifies the signature, and checks expiry and time claims.
- Google sign-in validation checks configured audience, issuer, expiry and verified email.
- The repository has configuration, migration-layout, operations-readiness and security-related tests.

These are source-level findings. They do not prove the deployed resources or configuration match the repository.

## Findings to address before connecting more products

### 1. Cross-product identity contract

The current JWT payload contains `sub`, `email`, `iat` and `exp`. The verifier validates the signature and time claims but does not validate issuer or audience claims. That may work within a narrowly controlled boundary, but it is not a complete cross-service identity contract by itself.

The OmniPoint integration has an identified mismatch between Otya Auth tokens and OmniPoint's isolated token-verification scaffold. Do not work around it in the browser, broadly share signing secrets, or weaken verification.

**Next:** define issuer, audience, product scope, organization membership, permission checks, revocation and key rotation. Add negative tests for wrong audience/scope, expired tokens, missing membership and cross-tenant access. Implement a reviewed server-side adapter before enabling financial routes.

### 2. Rate limiting under concurrency

Some authentication rate-limit helpers read a KV counter and then write an incremented value. That sequence is not atomic, so concurrent requests can exceed the intended threshold. The Together control module also permits requests when its optional limiter throws.

**Next:** decide fail-open versus fail-closed behavior by endpoint risk; use an appropriate centralized/atomic limiter for login, OTP, recovery and sensitive mutations; test concurrency and limiter outages. Do not change live behavior without tests and review.

### 3. Deployment can apply remote migrations

The package scripts include a `predeploy` lifecycle hook that runs `wrangler d1 migrations apply DB --remote`. Running the ordinary deploy script can therefore change the remote core D1 schema.

**Next:** preserve deployment gates, require a reviewed migration plan and recovery evidence, confirm the exact target environment before applying, and do not run the deploy script as a routine test.

### 4. Configuration is not proof of live readiness

Checked-in bindings and runtime schema checks do not prove deployed Worker versions, secrets availability, actual D1 schema state or service health.

**Next:** use read-only environment inventory and migration-status checks, compare deployed configuration with the repository, and record timestamped evidence without printing secret values.

### 5. Static tests need service-boundary integration tests

Source-level tests are useful but cannot fully prove deployed authentication, tenant isolation or retry safety.

**Next:** add isolated tests for cross-product token acceptance/rejection, revoked sessions, tenant isolation, duplicate webhooks/idempotency, queue retries, service timeouts, clean D1 migration and restore validation.

### 6. Keep product data separately owned

Otya Server should provide shared identity, policy, API patterns, events and observability. OmniPoint must remain authoritative for its inventory, sales, agency transactions and accounting ledgers. Shared identity must not grant unrestricted access to every product's data.

**Next:** define the data owner, authoritative database, tenant key, permitted operations, event schema, retention and recovery owner for each integration.

## Safe order of work

1. Keep production resources unchanged during the review.
2. Reconcile identity contracts and test authorization failures.
3. Harden rate limiting with tests.
4. Add read-only environment/schema verification and explicit migration approval.
5. Test service-to-service boundaries using disposable resources.
6. Connect OmniPoint only through a versioned API and idempotent events after its schema is reconciled.
7. Deploy through the reviewed release workflow only after explicit approval and recovery checks.

## Evidence limits

This review inspected checked-in source/configuration on `main`. It did not query live Cloudflare resources, inspect secret values, execute tests locally, apply migrations, change bindings, deploy Workers, modify secrets, or perform financial operations. Live readiness still needs separate evidence.
