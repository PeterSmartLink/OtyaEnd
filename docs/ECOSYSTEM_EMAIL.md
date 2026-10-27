# Shared Resend service for the Otya ecosystem

Resend is the shared transactional email provider for Otya Server, Otya accounts, Otya Media account/security messages, and OmniPoint operations. Keep provider credentials and sending logic central instead of duplicating API keys in each application.

## Existing Resend account (read-only audit)

- petersmartlink.com is verified and sending is enabled.
- Existing API keys include Auth Send Email and otya-store-worker.
- Six published Otya templates cover welcome, verification, password reset, security alerts, service notices, and updates.
- The enabled delivery webhook remains on the existing Otya website. Preserve it until the receiver is audited.
- A separate legacy Appwrite webhook is disabled and should not be re-enabled as part of the Cloudflare-only architecture.

## OmniPoint low-stock notification contract

The internal route POST /internal/notifications/omnipoint/low-stock is intended for Cloudflare Service Binding calls from trusted Otya Workers. The otya-auth Worker is configured with workers.dev disabled and has no public route in its checked-in configuration.

The request is limited to:
- productName
- sku
- quantityOnHand
- reorderLevel

The endpoint:
- validates every field and rejects stock above the positive reorder threshold;
- uses only the operator-managed ADMIN_EMAILS list as recipients;
- uses the existing RESEND_API_KEY secret and verified petersmartlink.com sender;
- does not accept a caller-supplied recipient, API key, sender, HTML, or arbitrary message;
- suppresses repeat alerts for the same SKU for 24 hours;
- returns generic errors without exposing Resend responses or credentials.

The route is an internal service-boundary contract, not a public email API. The caller should be the OmniPoint Cloudflare Worker through its AUTH service binding.

## Rollout boundary

This branch is code-only and is not deployed. Do not rotate/create API keys, expose secret values, change DNS, enable the disabled Appwrite webhook, or send real email as part of implementation. Before rollout, verify that the existing Otya Auth RESEND_API_KEY secret is present without reading its value, deploy this handler first, then deploy the OmniPoint caller, and finally test with an explicitly approved operator recipient.

## Future shared events

New email use cases should be event-specific, reviewed, and routed through this central service. Use Cloudflare Queues for durable delivery/retries before promising delivery guarantees. Email remains a side effect: it must never be able to roll back a committed sale, stock adjustment, account change, or ledger entry.
