import { readFileSync } from 'node:fs'

const requiredApproval = 'I_HAVE_REVIEWED_TARGET_AND_BACKUP'
const expectedTarget = 'otya-store-db:ab157fc6-2cbb-4d46-9789-2e4392e16aea'
const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')

if (!config.includes('database_name = "otya-store-db"') ||
    !config.includes('database_id   = "ab157fc6-2cbb-4d46-9789-2e4392e16aea"')) {
  console.error('Blocked: the configured DB binding does not match the reviewed Otya Server target.')
  process.exit(1)
}

if (process.env.OTYA_ALLOW_REMOTE_D1_MIGRATIONS !== requiredApproval ||
    process.env.OTYA_REMOTE_D1_TARGET !== expectedTarget) {
  console.error('Blocked: remote D1 migrations require an explicit approval marker and exact target confirmation.')
  console.error('Review the migration plan and a verified backup/restore path first.')
  console.error('Set OTYA_ALLOW_REMOTE_D1_MIGRATIONS=I_HAVE_REVIEWED_TARGET_AND_BACKUP')
  console.error('Set OTYA_REMOTE_D1_TARGET=otya-store-db:ab157fc6-2cbb-4d46-9789-2e4392e16aea')
  process.exit(1)
}

console.log('Explicit remote D1 migration approval and target confirmation verified.')
