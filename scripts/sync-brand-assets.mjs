import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

// This commit contains the owner-approved, decoded cyan/blue Otya WebP. Keep
// the source immutable so website builds cannot silently drift to another logo.
const APPROVED_APP_COMMIT = '63be1b59f1a261c853aab786cef584a70e29989d'
const SOURCE = `https://raw.githubusercontent.com/PeterSmartLink/OtyaPlayer/${APPROVED_APP_COMMIT}/assets/branding/otya_app_icon.webp`
const TARGET = 'public/otya-app-icon.webp'
const RETIRED_GENERATED_TARGETS = [
  'public/otya-mark-current.png',
  'public/android-chrome-192x192.png',
  'public/android-chrome-512x512.png',
  'public/apple-touch-icon.png',
  'public/favicon-16x16.png',
  'public/favicon-32x32.png',
  'public/web-app-manifest-192x192.png',
  'public/web-app-manifest-512x512.png',
]

function isWebP(bytes) {
  return bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
}

async function sync() {
  const response = await fetch(SOURCE, {
    headers: { 'User-Agent': 'Otya-Server brand asset sync' },
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error(`Could not fetch approved Otya mark (${response.status}).`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 4096 || !isWebP(bytes)) {
    throw new Error('Approved Otya mark did not resolve to the expected WebP asset.')
  }

  const destination = resolve(process.cwd(), TARGET)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, bytes)

  // Old builds generated one malformed PNG into many public icon names. Remove
  // those generated files on every build so they cannot shadow the canonical
  // WebP or be accidentally deployed from a dirty workspace.
  await Promise.all(
    RETIRED_GENERATED_TARGETS.map(target => rm(resolve(process.cwd(), target), { force: true })),
  )

  console.log(`Synced canonical Otya WebP from OtyaPlayer@${APPROVED_APP_COMMIT} to ${TARGET}.`)
}

await sync()
