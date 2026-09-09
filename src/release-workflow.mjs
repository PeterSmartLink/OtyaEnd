import { WorkflowEntrypoint } from 'cloudflare:workers'
import { mirrorApkToFirebaseAppDistribution } from './lib/firebase_app_distribution'
import { decodeWorkflowPayload } from './lib/workflow_payload.mjs'

const TAG_RE = /^v\d+\.\d+\.\d+\+[1-9]\d*$/
const VERSION_RE = /^\d+\.\d+\.\d+$/
const DEFAULT_WORKER_URL = 'https://petersmartlink.com'
const OFFICIAL_RELEASE_HOSTS = new Set(['petersmartlink.com', 'www.petersmartlink.com'])

function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required`)
  }
  return value.trim()
}

function normalizeWorkerUrl(value) {
  if (value == null || value === '') return DEFAULT_WORKER_URL
  if (typeof value !== 'string') throw new Error('workerUrl must be an HTTPS URL')
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('workerUrl must be a valid HTTPS URL')
  }
  if (url.protocol !== 'https:' || url.username || url.password || !OFFICIAL_RELEASE_HOSTS.has(url.hostname)) {
    throw new Error('workerUrl must use an official PeterSmart Link HTTPS host')
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('workerUrl must be an origin without a path, query, or fragment')
  }
  return url.origin
}

function immutableApkUrl(workerUrl, abi, tag) {
  return `${workerUrl}/apk/${abi}?tag=${encodeURIComponent(tag)}`
}

function normalizePayload(raw = {}) {
  const tag = requireString(raw.tag, 'tag')
  const version = requireString(raw.version, 'version')
  if (!TAG_RE.test(tag)) throw new Error('tag must match vX.Y.Z+BUILD')
  if (!VERSION_RE.test(version)) throw new Error('version must match X.Y.Z')

  const tagIdentity = tag.slice(1)
  const separator = tagIdentity.lastIndexOf('+')
  const tagVersion = tagIdentity.slice(0, separator)
  const tagBuild = Number(tagIdentity.slice(separator + 1))
  if (tagVersion !== version) throw new Error('tag version and public version do not match')
  if (!Number.isSafeInteger(tagBuild) || tagBuild <= 0) {
    throw new Error('tag build must be a positive integer')
  }

  const versionCode = Number(raw.versionCode ?? raw.version_code)
  if (!Number.isSafeInteger(versionCode) || versionCode <= 0) {
    throw new Error('versionCode must be a positive integer')
  }
  if (tagBuild !== versionCode) {
    throw new Error('tag build and versionCode do not match')
  }

  const arm64Key = requireString(
    raw.arm64Key ?? `releases/${tag}/OTYA-Player-${tag}-arm64.apk`,
    'arm64Key',
  )
  const arm32Key = requireString(
    raw.arm32Key ?? `releases/${tag}/OTYA-Player-${tag}-arm32.apk`,
    'arm32Key',
  )

  if (!arm64Key.startsWith(`releases/${tag}/`) || !arm32Key.startsWith(`releases/${tag}/`)) {
    throw new Error('versioned APK keys must live under releases/<tag>/')
  }

  return {
    tag,
    version,
    versionCode,
    arm64Key,
    arm32Key,
    changelog: typeof raw.changelog === 'string' ? raw.changelog.trim().slice(0, 8000) : '',
    minSdk: Number.isSafeInteger(Number(raw.minSdk)) ? Number(raw.minSdk) : 24,
    targetSdk: Number.isSafeInteger(Number(raw.targetSdk)) ? Number(raw.targetSdk) : 36,
    forceUpdate: raw.forceUpdate === true,
    workerUrl: normalizeWorkerUrl(raw.workerUrl),
  }
}

async function sendAdminReport(env, subject, text) {
  if (!env.RESEND_API_KEY || !env.ADMIN_REPORT_EMAIL) {
    return { sent: false, reason: 'RESEND_API_KEY or ADMIN_REPORT_EMAIL is not configured' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'OTYA Releases <noreply@petersmartlink.com>',
      to: [env.ADMIN_REPORT_EMAIL],
      subject,
      text,
    }),
  })

  if (!response.ok) {
    throw new Error(`Resend admin report failed with HTTP ${response.status}`)
  }
  const data = await response.json().catch(() => ({}))
  return { sent: true, id: data.id ?? null }
}

export class OtyaReleaseWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    let release
    try {
      release = await step.do(
        'validate release metadata',
        async () => normalizePayload(decodeWorkflowPayload(event.payload)),
      )

      const artifacts = await step.do(
        'verify versioned R2 APK artifacts',
        { retries: { limit: 3, delay: '5 seconds', backoff: 'linear' } },
        async () => {
          const [arm64, arm32] = await Promise.all([
            this.env.R2.head(release.arm64Key),
            this.env.R2.head(release.arm32Key),
          ])
          if (!arm64 || !arm32) throw new Error('One or more versioned APK artifacts are missing from R2')
          if ((arm64.size ?? 0) < 5_000_000 || (arm32.size ?? 0) < 5_000_000) {
            throw new Error('One or more APK artifacts are unexpectedly small')
          }
          return {
            arm64: { key: release.arm64Key, size: arm64.size, etag: arm64.etag },
            arm32: { key: release.arm32Key, size: arm32.size, etag: arm32.etag },
          }
        },
      )

      const database = await step.do('upsert D1 release metadata safely', async () => {
        const latest = await this.env.DB.prepare(
          'SELECT tag, version_code FROM releases ORDER BY version_code DESC LIMIT 1',
        ).first()
        if (
          latest
          && latest.tag !== release.tag
          && Number(latest.version_code) >= release.versionCode
        ) {
          throw new Error(`Refusing non-monotonic version code ${release.versionCode}; current release is ${latest.tag} (${latest.version_code})`)
        }

        const date = new Date().toISOString().slice(0, 10)
        await this.env.DB.prepare(`
          INSERT INTO releases
            (tag, version, version_code, date, changelog, force_update,
             download_url, arm64_url, arm32_url, min_sdk, target_sdk, released_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'))
          ON CONFLICT(tag) DO UPDATE SET
            version = excluded.version,
            version_code = excluded.version_code,
            date = excluded.date,
            changelog = COALESCE(NULLIF(excluded.changelog, ''), releases.changelog),
            force_update = excluded.force_update,
            download_url = excluded.download_url,
            arm64_url = excluded.arm64_url,
            arm32_url = excluded.arm32_url,
            min_sdk = excluded.min_sdk,
            target_sdk = excluded.target_sdk,
            released_at = excluded.released_at
        `).bind(
          release.tag,
          release.version,
          release.versionCode,
          date,
          release.changelog,
          release.forceUpdate ? 1 : 0,
          `${release.workerUrl}/download/otya-player`,
          immutableApkUrl(release.workerUrl, 'arm64', release.tag),
          immutableApkUrl(release.workerUrl, 'arm32', release.tag),
          release.minSdk,
          release.targetSdk,
        ).run()
        return { updated: true, tag: release.tag, versionCode: release.versionCode }
      })

      const metadata = await step.do('publish version metadata', async () => {
        const value = {
          tag: release.tag,
          version: release.version,
          versionCode: release.versionCode,
          date: new Date().toISOString(),
          arm64: release.arm64Key,
          arm32: release.arm32Key,
          latestAliases: {
            arm64: 'Otya-arm64.apk',
            arm32: 'Otya-arm32.apk',
          },
          changelog: release.changelog || `OTYA Player ${release.version} is now available.`,
          minSdk: release.minSdk,
          targetSdk: release.targetSdk,
          workerUrl: release.workerUrl,
          downloads: {
            arm64: `${release.workerUrl}/apk/arm64`,
            arm32: `${release.workerUrl}/apk/arm32`,
            exactArm64: immutableApkUrl(release.workerUrl, 'arm64', release.tag),
            exactArm32: immutableApkUrl(release.workerUrl, 'arm32', release.tag),
            auto: `${release.workerUrl}/download/otya-player`,
            page: `${release.workerUrl}/download/otya-player`,
          },
        }
        const body = JSON.stringify(value, null, 2) + '\n'
        await this.env.R2.put('version.json', body, {
          httpMetadata: {
            contentType: 'application/json; charset=utf-8',
            cacheControl: 'public, max-age=300, must-revalidate',
          },
        })
        await this.env.KV.delete('version:current')
        await this.env.KV.put('LATEST_BUILD_INFO', JSON.stringify(value))
        return value
      })

      const firebaseDistribution = await step.do('mirror test build to Firebase App Distribution', async () => {
        try {
          const apk = await this.env.R2.get(release.arm64Key)
          if (!apk?.body) return { configured: false, mirrored: false, reason: 'arm64-apk-missing' }
          return await mirrorApkToFirebaseAppDistribution(
            this.env,
            apk.body,
            `OTYA-${release.tag}-arm64.apk`,
            metadata.changelog,
          )
        } catch (error) {
          console.error('[release] Firebase App Distribution mirror failed:', error?.message)
          return {
            configured: true,
            mirrored: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      })

      const notification = await step.do('queue update notification once', async () => {
        try {
          const markerKey = `release:push:${release.tag}`
          if (await this.env.KV.get(markerKey)) return { queued: false, duplicate: true }
          const url = `${release.workerUrl}/download/otya-player`
          await this.env.PUSH_QUEUE.send({
            title: `Otya ${release.version} is ready`,
            body: 'New features and improvements are ready. Tap to see what’s new.',
            url,
            type: 'release_available',
            version: release.version,
            data: {
              type: 'release_available',
              tag: release.tag,
              version: release.version,
              versionCode: String(release.versionCode),
              download_url: url,
              dedupeKey: markerKey,
            },
          })
          await this.env.KV.put(markerKey, new Date().toISOString(), { expirationTtl: 90 * 24 * 60 * 60 })
          return { queued: true, duplicate: false }
        } catch (error) {
          console.error('[release] Push notification queue failed:', error?.message)
          return {
            queued: false,
            duplicate: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      })

      const analytics = await step.do('record release analytics', async () => {
        try {
          if (!this.env.OTYA_ANALYTICS?.writeDataPoint) return { written: false, reason: 'binding-unavailable' }
          this.env.OTYA_ANALYTICS.writeDataPoint({
            blobs: ['release_completed', release.tag, release.version],
            doubles: [release.versionCode, artifacts.arm64.size ?? 0, artifacts.arm32.size ?? 0],
            indexes: [release.tag],
          })
          return { written: true }
        } catch (error) {
          console.error('[release] Analytics write failed:', error?.message)
          return { written: false, error: error instanceof Error ? error.message : String(error) }
        }
      })

      const report = await step.do('send completion report', async () => {
        try {
          return await sendAdminReport(
            this.env,
            `OTYA ${release.tag} release workflow completed`,
            [
              `Release: ${release.tag}`,
              `Version code: ${release.versionCode}`,
              `arm64: ${release.arm64Key}`,
              `arm32: ${release.arm32Key}`,
              `Firebase test mirror: ${firebaseDistribution.mirrored ? 'yes' : 'no'}`,
              `Push queued: ${notification.queued}`,
              'Status: completed',
            ].join('\n'),
          )
        } catch (error) {
          console.error('[release] Completion report failed:', error?.message)
          return { sent: false, error: error instanceof Error ? error.message : String(error) }
        }
      })

      return {
        ok: true,
        tag: release.tag,
        version: release.version,
        versionCode: release.versionCode,
        artifacts,
        database,
        firebaseDistribution,
        notification,
        analytics,
        report,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      try {
        await step.do('send failure report', async () => sendAdminReport(
          this.env,
          `OTYA release workflow failed${release?.tag ? `: ${release.tag}` : ''}`,
          `Status: failed\nReason: ${message}`,
        ))
      } catch {
      }
      throw error
    }
  }
}
