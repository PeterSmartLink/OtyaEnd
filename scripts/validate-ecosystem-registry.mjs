import { readFileSync } from 'node:fs'

const path = new URL('../config/ecosystem-registry.json', import.meta.url)
const registry = JSON.parse(readFileSync(path, 'utf8'))
const errors = []
const ids = new Set()

function requireCondition(condition, message) {
  if (!condition) errors.push(message)
}

requireCondition(registry.schemaVersion === 1, 'schemaVersion must be 1')
requireCondition(registry.operatingPrinciples?.primaryInfrastructure === 'Cloudflare', 'Cloudflare must remain the primary infrastructure')
requireCondition(registry.operatingPrinciples?.crossProductDatabaseAccess === false, 'cross-product direct database access must remain disabled')
requireCondition(registry.operatingPrinciples?.productionChangesRequireExplicitApproval === true, 'production changes must require explicit approval')
requireCondition(registry.management?.controlPlaneProductId === 'otya-server', 'Otya Server must be the shared control plane')
requireCondition(registry.management?.publicBrowserAdmin === 'retired-by-design', 'public browser admin must remain retired by design')
requireCondition(Array.isArray(registry.products) && registry.products.length >= 4, 'at least four products must be registered')

for (const product of registry.products ?? []) {
  requireCondition(typeof product.id === 'string' && product.id.length > 0, 'every product needs an id')
  requireCondition(!ids.has(product.id), `duplicate product id: ${product.id}`)
  ids.add(product.id)
  requireCondition(typeof product.repository === 'string' && product.repository.length > 0, `${product.id}: repository is required`)
  requireCondition(Array.isArray(product.owns) && product.owns.length > 0, `${product.id}: data/capability ownership must be explicit`)
  requireCondition(Array.isArray(product.integratesWith), `${product.id}: integrations must be listed`)
  requireCondition(product.productionReleaseAllowed === false, `${product.id}: production release must remain gated until readiness is independently proven`)
}

for (const required of ['otya-server', 'omnipoint', 'otyahub', 'otya-player', 'otya-next']) {
  requireCondition(ids.has(required), `required ecosystem product missing: ${required}`)
}

const omni = registry.products?.find(product => product.id === 'omnipoint')
requireCondition(omni?.primaryData?.includes('omnipoint-prod'), 'OmniPoint must own its dedicated primary database')
requireCondition(!omni?.primaryData?.includes('otya-store-db'), 'OmniPoint must not use the shared Otya store database')
requireCondition(omni?.owns?.includes('retail-ledger') && omni?.owns?.includes('agency-ledger'), 'OmniPoint retail and agency ledgers must be explicit and separate')
requireCondition(registry.nonNegotiableGates?.some(rule => rule.includes('backup and restore evidence')), 'remote migration gate must require backup and restore evidence')
requireCondition(registry.sharedCapabilities?.some(capability => capability.id === 'backups-and-recovery' && capability.status === 'not-certified-until-restore-test-passes'), 'recovery must not be marked ready without a restore test')

if (errors.length) {
  console.error('Ecosystem registry validation failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`Ecosystem registry valid: ${registry.products.length} products, ${registry.sharedCapabilities.length} shared capabilities; all production release gates remain closed.`)
}
