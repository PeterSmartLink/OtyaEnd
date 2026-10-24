import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(\`../\${path}\`, import.meta.url), 'utf8')
const migration = read('migrations/0009_omnipoint_core.sql')
const api = read('src/app/api/omnipoint/route.ts')
const workspace = read('src/app/omnipoint/page.tsx')
const adminAuth = read('src/lib/admin_auth.ts')

test('OmniPoint migration is additive, namespaced and does not seed fake business data', () => {
  for (const table of [
    'omni_products', 'omni_retail_sales', 'omni_retail_sale_lines',
    'omni_stock_movements', 'omni_agency_transactions', 'omni_ledger_entries',
    'omni_reconciliation_sessions', 'omni_audit_events',
  ]) assert.match(migration, new RegExp(\`CREATE TABLE IF NOT EXISTS \${table}\\\\b\`))
  assert.doesNotMatch(migration, /\bINSERT\s+INTO\b/i)
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i)
})

test('OmniPoint API requires a signed MFA admin identity and never trusts actor IDs from request bodies', () => {
  assert.match(api, /getAdminSessionEmail/)
  assert.match(adminAuth, /verifySignedAdminCookie\(request, env\)/)
  assert.doesNotMatch(api, /body\.actorId/)
  assert.match(api, /const actorId = auth\.actorId/)
})

test('OmniPoint writes inventory changes and audit records using D1 batches', () => {
  assert.match(api, /db\.batch\(statements\)/)
  assert.match(api, /db\.batch\(\[/)
  assert.match(api, /INSERT INTO omni_audit_events/)
  assert.match(api, /INSERT INTO omni_stock_movements/)
  assert.match(api, /Stock changed concurrently/)
})

test('OmniPoint workspace uses production API and does not embed a sample catalogue', () => {
  assert.match(workspace, /fetch\("\/api\/omnipoint\?resource=products"/)
  assert.match(workspace, /production records/)
  assert.doesNotMatch(workspace, /USB-C Fast Charger|Wireless Earbuds|Sample retail sales|385,000/)
  assert.match(workspace, /No demo data is shown/)
})
