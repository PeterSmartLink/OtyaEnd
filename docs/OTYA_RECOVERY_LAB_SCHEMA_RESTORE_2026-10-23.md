# Recovery Lab Schema Restore — 2026-10-23

## Status

**Passed: isolated OmniPoint PostgreSQL schema reconstruction. Not yet a full data-backup or Cloudflare-to-Supabase recovery proof.**

- Recovery project: `Otya-Recovery-Lab`
- Supabase project ref: `iqajvbqdhnlwpsiofwcv`
- Region: `eu-west-2`
- Status at verification: `ACTIVE_HEALTHY`
- Cost quote at creation: $0/month (estimate only; usage or plan changes may affect billing)
- Source project retained unchanged: `OmniPoint` (`iptzfakfeiyjnvepfqcg`)

## What was done

Reconstructed the schema in the isolated lab from reviewed, version-controlled OmniPoint SQL migrations. Applied the baseline and subsequent changes for authentication-profile compatibility, the `SOVEREIGN` role, restrictive Data API grants, foreign-key indexes, staff onboarding, financial-history immutability, trigger search paths, and balanced ledger sources.

No customer/business rows, passwords, API keys, secrets, or production files were copied. No production deployment or traffic change was made.

## Verification results

Read-only metadata queries compared source and lab:

| Check | Source OmniPoint | Recovery Lab |
|---|---:|---:|
| Public tables | 9 | 9 |
| Public indexes | 42 | 42 |
| User-defined triggers | 3 | 3 |
| Public tables with RLS enabled | 9 | 9 |
| Public RLS policies | 0 | 0 |
| Rows in `User` | 1 | 0 |
| Rows in `AuditEvent` | 1 | 0 |

The zero row counts in the lab are intentional: this was a schema-only exercise, not a production data copy. RLS is enabled and there are no public policies, and table/sequence privileges for `anon` and `authenticated` are revoked. This matches the current migration design in which trusted server-side Prisma access is expected.

Supabase security advisors report the expected informational `rls_enabled_no_policy` findings on all nine tables. This is intentional for the isolated schema and should not be changed by adding broad client policies. Performance advisors report unused indexes because the lab has no workload yet; do not remove indexes based on this empty-lab observation.

## What remains before claiming disaster-recovery readiness

1. Produce a consistent, encrypted, checksummed backup artifact from each Cloudflare data class using a procedure appropriate to D1, KV, R2, queues, and configuration.
2. Restore those artifacts into isolated targets and compare schema, object checksums, record counts, queue/idempotency state, and references.
3. Test application-level behavior and financial reconciliation without routing production traffic.
4. Record measured recovery time and recoverable data-loss window; define RPO/RTO only after evidence.
5. Verify secrets are provisioned separately through secure secret management, never included in backup artifacts.
6. Keep Cloudflare as the single writer until a reviewed recovery exercise proves the failover/failback procedure.

**Conclusion:** the lab proves that the checked-in OmniPoint schema migrations can be applied cleanly to a separate Supabase project and that core schema counts match the current source. It does not yet prove recovery of Cloudflare-hosted data or live OmniPoint business records.
