import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const roots = [
  { label: 'core', dir: 'migrations', pattern: /^(\d{4})_[a-z0-9][a-z0-9_-]*\.sql$/ },
  { label: 'auth', dir: 'auth-worker/migrations', pattern: /^(\d{8})_[a-z0-9][a-z0-9_-]*\.sql$/ },
]

let failed = false

for (const root of roots) {
  const files = readdirSync(root.dir).filter((name) => name.endsWith('.sql')).sort()
  if (files.length === 0) {
    console.error(`[migrations] ${root.label}: no migration files found`)
    failed = true
    continue
  }

  const seen = new Set()
  let previous = ''
  for (const name of files) {
    const match = name.match(root.pattern)
    if (!match) {
      console.error(`[migrations] ${root.label}: invalid migration filename ${name}`)
      failed = true
      continue
    }

    const version = match[1]
    if (seen.has(version)) {
      console.error(`[migrations] ${root.label}: duplicate migration version ${version}`)
      failed = true
    }
    seen.add(version)

    if (previous && version <= previous) {
      console.error(`[migrations] ${root.label}: migration versions are not strictly increasing at ${name}`)
      failed = true
    }
    previous = version

    const sql = readFileSync(join(root.dir, name), 'utf8')
    if (!sql.trim()) {
      console.error(`[migrations] ${root.label}: empty migration ${name}`)
      failed = true
    }

    const destructive = /\b(DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM|TRUNCATE\b)\b/i.test(sql)
    const approved = /OTYA-DESTRUCTIVE-MIGRATION-APPROVED/i.test(sql)
    if (destructive && !approved) {
      console.error(`[migrations] ${root.label}: ${name} contains destructive SQL without OTYA-DESTRUCTIVE-MIGRATION-APPROVED`)
      failed = true
    }
  }

  console.log(`[migrations] ${root.label}: ${files.length} migration(s) checked`)
}

const operationsSql = readFileSync('migrations/0007_operations_and_notifications.sql', 'utf8')
for (const table of ['notification_events', 'notification_reads', 'security_events', 'operational_events', 'queue_delivery_events']) {
  if (!new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i').test(operationsSql)) {
    console.error(`[migrations] operations migration is missing ${table}`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log('[migrations] migration integrity checks passed')
