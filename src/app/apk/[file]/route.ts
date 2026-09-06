import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getDB } from '@/lib/d1'

const LATEST_MAP: Record<string, string> = {
  arm64: 'Otya-arm64.apk',
  arm32: 'Otya-arm32.apk',
}
const LEGACY_VERSION_RE = /^\d+\.\d+\.\d+$/
const BUILD_TAG_RE = /^v\d+\.\d+\.\d+\+[1-9]\d*$/
const DOWNLOAD_RATE_WINDOW_SECONDS = 60

type DownloadKV = {
  get(key: string): Promise<string | null>
}

type DownloadRateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>
}

function requestIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? ''
  ).trim().slice(0, 64)
}

async function enforceDownloadAbuseControls(
  req: NextRequest,
  env: Record<string, unknown>,
): Promise<NextResponse | null> {
  const ip = requestIp(req)
  if (!ip) return null

  const kv = env.KV as DownloadKV | undefined
  if (kv?.get) {
    try {
      if (await kv.get(`blocked:${ip}`) !== null) {
        return new NextResponse('Forbidden', {
          status: 403,
          headers: { 'Cache-Control': 'no-store' },
        })
      }
    } catch (error) {
      console.error('[download] IP block check failed:', (error as Error)?.message)
    }
  }

  const limiter = env.RATE_LIMITER as DownloadRateLimiter | undefined
  if (limiter?.limit) {
    try {
      const result = await limiter.limit({ key: ip })
      if (!result.success) {
        return new NextResponse('Too many download requests. Please try again shortly.', {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(DOWNLOAD_RATE_WINDOW_SECONDS),
          },
        })
      }
    } catch (error) {
      // Fail open on a Cloudflare limiter outage: the hourly D1/KV abuse
      // detector remains a second layer and legitimate downloads should not
      // become unavailable because the limiter binding is temporarily down.
      console.error('[download] RATE_LIMITER failed:', (error as Error)?.message)
    }
  }

  return null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params

  if (file !== 'arm64' && file !== 'arm32') {
    return new NextResponse('Not found', { status: 404 })
  }

  // New immutable releases use a full build tag so multiple builds can share
  // the same public version without colliding. Keep the old `v=X.Y.Z` lookup
  // only for historical links that predate build-specific tags.
  const tag = req.nextUrl.searchParams.get('tag')
  const version = req.nextUrl.searchParams.get('v')
  if (tag && version) {
    return new NextResponse('Choose either tag or version, not both', { status: 400 })
  }

  let key: string
  let releaseIdentity = 'latest'
  if (tag) {
    if (!BUILD_TAG_RE.test(tag)) {
      return new NextResponse('Invalid release tag', { status: 400 })
    }
    key = `releases/${tag}/Otya-${file}.apk`
    releaseIdentity = tag
  } else if (version) {
    if (!LEGACY_VERSION_RE.test(version)) {
      return new NextResponse('Invalid version', { status: 400 })
    }
    key = `releases/v${version}/Otya-${file}.apk`
    releaseIdentity = `v${version}`
  } else {
    key = LATEST_MAP[file]
  }

  try {
    const { env } = await getCloudflareContext()
    const runtimeEnv = env as Record<string, unknown>
    const denied = await enforceDownloadAbuseControls(req, runtimeEnv)
    if (denied) return denied

    const r2 = runtimeEnv.R2 as {
      get(key: string): Promise<{
        body: ReadableStream
        size: number
        httpMetadata?: { contentType?: string }
      } | null>
    } | undefined

    if (!r2) {
      return new NextResponse('Storage is not available.', { status: 503 })
    }

    const object = await r2.get(key)
    if (!object) {
      return NextResponse.redirect(
        'https://petersmartlink.com/download/otya-player',
        { status: 302 }
      )
    }

    try {
      const db = getDB(runtimeEnv)
      await db.prepare(
          'INSERT INTO downloads (abi, version, ip, user_agent) VALUES (?, ?, ?, ?)'
        ).bind(
          file,
          releaseIdentity,
          requestIp(req),
          (req.headers.get('user-agent') ?? '').slice(0, 250)
        ).run()
    } catch { /* non-fatal */ }

    const filename = `Otya-${file}.apk`
    const headers = new Headers()
    const contentType = object.httpMetadata?.contentType ?? 'application/vnd.android.package-archive'
    headers.set('Content-Type', contentType)
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    if (object.size > 0) headers.set('Content-Length', String(object.size))
    headers.set(
      'Cache-Control',
      releaseIdentity !== 'latest'
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=300, must-revalidate',
    )
    headers.set('Access-Control-Allow-Origin', '*')

    return new NextResponse(object.body, { headers })
  } catch {
    return new NextResponse('Download failed. Try again.', { status: 500 })
  }
}
