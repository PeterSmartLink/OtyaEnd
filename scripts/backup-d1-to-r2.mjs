#!/usr/bin/env node
/**
 * Manual D1 export + checksum + private R2 upload/verification operator.
 *
 * Safety: dry-run is the default. Real remote export requires BOTH:
 *   --execute
 *   OTYA_BACKUP_CONFIRM=I_UNDERSTAND_THIS_EXPORTS_REMOTE_DATABASES
 *
 * This script never imports/restores, deletes objects, or changes Worker/DNS config.
 * Run from the repository root after reviewing the backup runbook and current IDs.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const config = join(root, 'scripts', 'backup-wrangler.toml')
const bucket = 'omnipoint-backups'
const databases = [
  { name: 'omnipoint-prod', id: '65868e64-ff39-4ed3-91de-59c237cd9cb0' },
  { name: 'omnipoint-migration-test', id: '43d274ce-d46e-462f-bcef-59b93caefc21' },
  { name: 'otya-auth-db', id: 'b05595f6-260a-4720-acca-4f8b13f5c43e' },
  { name: 'otya-store-db', id: 'ab157fc6-2cbb-4d46-9789-2e4392e16aea' },
]
const execute = process.argv.includes('--execute')
const confirm = process.env.OTYA_BACKUP_CONFIRM === 'I_UNDERSTAND_THIS_EXPORTS_REMOTE_DATABASES'
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outputDir = resolve(process.env.OTYA_BACKUP_DIR || join(root, '.private-backups', timestamp))

function run(args, opts = {}) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const result = spawnSync(command, ['--no-install', 'wrangler', ...args], {
    cwd: root, encoding: 'utf8', stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Wrangler command failed (exit ${result.status}): wrangler ${args[0]} ${args[1] || ''}\n${(result.stderr || '').slice(-3000)}`)
  }
  return result.stdout || ''
}
function sha256(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolveHash(hash.digest('hex')))
  })
}
function assertExportLooksComplete(path) {
  const size = statSync(path).size
  if (!size) throw new Error('Export file is empty; refusing upload.')
  const sql = readFileSync(path, 'utf8').trimEnd()
  if (!sql || !/(CREATE TABLE|CREATE INDEX|INSERT INTO|PRAGMA|CREATE VIEW|CREATE TRIGGER)/i.test(sql)) {
    throw new Error('Export does not look like a SQL dump; refusing upload.')
  }
  return size
}
async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try { return await new Promise(resolveAnswer => rl.question(question, resolveAnswer)) }
  finally { rl.close() }
}

if (!execute) {
  console.log('DRY RUN ONLY — no remote database or R2 operations will be performed.')
  console.log('Would export these database IDs and upload verified dumps to the private R2 bucket:')
  for (const db of databases) console.log(`- ${db.name}: ${db.id}`)
  console.log(`Destination: ${bucket}/d1/YYYY/MM/DD/<database>/<timestamp>.sql`)
  console.log('Review scripts/backup-wrangler.toml and docs/operations/d1-backup-restore-runbook.md.')
  console.log('To execute, pass --execute and set OTYA_BACKUP_CONFIRM to the exact confirmation string in this script header.')
  process.exit(0)
}
if (!confirm) {
  console.error('Blocked: missing explicit OTYA_BACKUP_CONFIRM environment confirmation.')
  process.exit(2)
}
if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error('Blocked: CLOUDFLARE_API_TOKEN is not set. Use a dedicated least-privilege token; never use the global API key.')
  process.exit(2)
}
if (!readFileSync(config, 'utf8').includes('name = "otya-backup-operator"')) {
  throw new Error('Unexpected backup-only Wrangler config; refusing to continue.')
}
const approved = await ask(`This will export all four remote D1 databases and upload sensitive SQL dumps to private R2 bucket "${bucket}". Verify the account, database IDs, token permissions, quiet period and off-account encryption plan. Type BACKUP-OTYA-NOW to continue: `)
if (approved.trim() !== 'BACKUP-OTYA-NOW') {
  console.log('Cancelled; no operations performed.')
  process.exit(0)
}

mkdirSync(outputDir, { recursive: true, mode: 0o700 })
const day = new Date().toISOString().slice(0, 10).split('-')
const prefix = `d1/${day[0]}/${day[1]}/${day[2]}`
const manifest = {
  createdAt: new Date().toISOString(),
  bucket,
  prefix,
  wranglerVersion: run(['--version']).trim(),
  databases: [],
}
for (const db of databases) {
  const filename = `${db.name}.sql`
  const localPath = join(outputDir, filename)
  console.log(`Exporting ${db.name} (${db.id})...`)
  run(['d1', 'export', db.name, '--remote', '--config', config, `--output=${localPath}`])
  const bytes = assertExportLooksComplete(localPath)
  const checksum = await sha256(localPath)
  const key = `${prefix}/${db.name}/${timestamp}/${filename}`
  console.log(`Uploading ${db.name} to private R2 key ${key}...`)
  run(['r2', 'object', 'put', `${bucket}/${key}`, `--file=${localPath}`])
  const downloaded = join(outputDir, `${db.name}.r2-verify.sql`)
  run(['r2', 'object', 'get', `${bucket}/${key}`, `--file=${downloaded}`])
  const downloadedChecksum = await sha256(downloaded)
  if (downloadedChecksum !== checksum) throw new Error(`Checksum mismatch for ${db.name}; do not treat this backup as successful.`)
  manifest.databases.push({
    name: db.name, databaseId: db.id, objectKey: key,
    bytes, sha256: checksum, uploadedObjectVerified: true,
  })
  console.log(`Verified ${db.name}: ${bytes} bytes, SHA-256 matches.`)
}
const manifestPath = join(outputDir, 'manifest.json')
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
const manifestKey = `${prefix}/manifest/${timestamp}.json`
run(['r2', 'object', 'put', `${bucket}/${manifestKey}`, `--file=${manifestPath}`])
console.log('All four exports uploaded and checksum-verified in R2.')
console.log('IMPORTANT: This is not yet an off-account backup or a successful restore drill.')
console.log(`Local export directory: ${outputDir}`)
console.log(`Manifest R2 key: ${manifestKey}`)
console.log('Keep the local directory private, encrypt a separate off-account copy, and test restore into a newly created isolated D1 database before declaring recovery ready.')
