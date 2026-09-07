import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

// Immutable owner-approved cyan/blue Otya identity. Website builds fetch the
// exact app asset rather than regenerating or recoloring a second logo.
const APPROVED_APP_COMMIT = '63be1b59f1a261c853aab786cef584a70e29989d'
const SOURCE = `https://raw.githubusercontent.com/PeterSmartLink/OtyaPlayer/${APPROVED_APP_COMMIT}/assets/branding/otya_app_icon.webp`
const TARGET = 'public/otya-app-icon.webp'
const EXPECTED_WIDTH = 512
const EXPECTED_HEIGHT = 512
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

function readVp8Dimensions(bytes) {
  // Canonical Otya asset is a lossy VP8 WebP. Width/height are the 14-bit
  // little-endian values immediately after the 0x9d012a frame marker.
  if (bytes.length < 30 || bytes.subarray(12, 16).toString('ascii') !== 'VP8 ') {
    return null
  }
  const marker = bytes.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20)
  if (marker < 0 || marker + 7 > bytes.length) return null
  return {
    width: bytes.readUInt16LE(marker + 3) & 0x3fff,
    height: bytes.readUInt16LE(marker + 5) & 0x3fff,
  }
}

function isCanonicalWebP(bytes) {
  if (bytes.length < 4096) return false
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF') return false
  if (bytes.subarray(8, 12).toString('ascii') !== 'WEBP') return false
  const dimensions = readVp8Dimensions(bytes)
  return dimensions?.width === EXPECTED_WIDTH && dimensions?.height === EXPECTED_HEIGHT
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
  if (!isCanonicalWebP(bytes)) {
    throw new Error('Approved Otya mark did not resolve to the expected 512x512 WebP asset.')
  }

  const destination = resolve(process.cwd(), TARGET)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, bytes)

  // Old builds generated malformed PNG bytes into many icon paths. Remove all
  // retired generated names so a dirty workspace cannot publish stale branding.
  await Promise.all(
    RETIRED_GENERATED_TARGETS.map(target => rm(resolve(process.cwd(), target), { force: true })),
  )

  console.log(`Synced canonical Otya WebP from OtyaPlayer@${APPROVED_APP_COMMIT} to ${TARGET}.`)
}

await sync()
