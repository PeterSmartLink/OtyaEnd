import { readFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

// Immutable owner-approved cyan/blue Otya identity, vendored from
// assets/branding/otya_app_icon.webp. Builds must work with private repositories.
const APPROVED_APP_COMMIT = '63be1b59f1a261c853aab786cef584a70e29989d'
const EXPECTED_SHA256 = '34f8e6568b52900d8eaa7c30cd304770d60fb56745b6e2ed3874bc61ab205c51'
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
  const bytes = await readFile(resolve(process.cwd(), TARGET))
  if (createHash('sha256').update(bytes).digest('hex') !== EXPECTED_SHA256) {
    throw new Error('Local Otya mark does not match the approved asset checksum.')
  }
  if (!isCanonicalWebP(bytes)) {
    throw new Error('Approved Otya mark did not resolve to the expected 512x512 WebP asset.')
  }

  // Old builds generated malformed PNG bytes into many icon paths. Remove all
  // retired generated names so a dirty workspace cannot publish stale branding.
  await Promise.all(
    RETIRED_GENERATED_TARGETS.map(target => rm(resolve(process.cwd(), target), { force: true })),
  )

  console.log(`Verified canonical Otya WebP from OtyaPlayer@${APPROVED_APP_COMMIT} at ${TARGET}.`)
}

await sync()
