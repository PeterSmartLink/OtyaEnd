import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { mergeFirebaseOwnedClientConfig } from '@/lib/client_config'
import {
  extractOtyaClientConfig,
  getFirebaseRemoteConfigTemplate,
} from '@/lib/firebase_remote_config'

const KEY = 'app:remote-config'
const FIREBASE_CACHE_KEY = 'app:remote-config:firebase-cache-v1'
const CURRENT_REVISION = 11
const FIREBASE_CACHE_FRESH_MS = 10 * 60 * 1000
const FIREBASE_CACHE_TTL_SECS = 60 * 60

const DEFAULT_CONFIG = {
  schemaVersion: 1,
  revision: CURRENT_REVISION,
  maintenance: {
    enabled: false,
    title: 'Otya online services are temporarily unavailable',
    message: 'Local playback and offline tools are still available.',
    allowOfflinePlayback: true,
    services: {},
  },
  versions: {
    minimumBuild: 1,
    recommendedBuild: 1,
    forceUpdate: false,
    minimumMessage: 'This version of Otya can no longer use online services. Please update to continue.',
    recommendedMessage: 'A newer Otya version is available with improvements and fixes.',
    downloadUrl: 'https://petersmartlink.com/download/otya-player',
  },
  features: {
    transfer: true,
    private: true,
    // Legacy aliases are retained for older clients only.
    beam: true,
    safe: true,
    equalizer: true,
    whatsappTrimmer: true,
    converter: true,
    onlineThemes: true,
    googleSignIn: true,
    firebaseIdentity: true,
    firebaseAuth: true,
    firebaseAppCheck: true,
    firebaseAnalytics: true,
    firebasePerformance: true,
    driveBackup: true,
    feedback: true,
    aiAssistant: true,
    cloudPush: true,
    together: true,
    togetherNearby: true,
    togetherAnywhere: true,
  },
  home: {
    featuredCard: {
      enabled: true,
      title: 'Your media. Your way.',
      subtitle: 'Private, fast and built for everyday playback.',
      action: '/music',
    },
    sectionOrder: ['continue', 'recent', 'featured', 'tools'],
    banners: [],
  },
  announcement: null,
  links: {
    website: 'https://petersmartlink.com/otya-player',
    download: 'https://petersmartlink.com/download/otya-player',
    support: 'https://petersmartlink.com/apps/otya-player/support',
    privacy: 'https://petersmartlink.com/privacy',
    terms: 'https://petersmartlink.com/terms',
    docs: 'https://petersmartlink.com/docs',
    account: 'https://petersmartlink.com/account',
    ai: 'https://petersmartlink.com/ask',
  },
  ai: {
    enabled: true,
    standaloneService: false,
    optionalForPlayer: true,
    scope: 'general-assistant',
    productContext: 'otya-aware',
    guestPolicy: 'single-low-cost-model',
    signedInPolicy: 'managed-model-selector',
    greeting: 'Ask Otya anything. It can answer general questions and has extra Otya product context when you need help with playback, files, Transfer, Private, updates or your account.',
    suggestedPrompts: [
      'Explain something I am learning in simple language.',
      'Help me think through a decision step by step.',
      'How do I send a large video with Otya Transfer?',
      'Why can a video have picture but no sound?',
    ],
  },
  push: {
    enabled: true,
    provider: 'fcm',
    optionalForPlayback: true,
  },
  auth: {
    authority: 'otya-auth',
    emailPassword: 'cloudflare',
    otp: 'cloudflare-resend',
    firebaseIdentity: true,
    firebaseIsSessionAuthority: false,
  },
  security: {
    appCheck: {
      mode: 'monitor',
      header: 'X-Firebase-AppCheck',
      provider: 'play-integrity',
      allowOfflinePlayback: true,
    },
  },
  search: {
    suggestions: [],
    categories: ['video', 'music', 'folders', 'playlists', 'files', 'help'],
    providerPriority: ['local', 'help'],
    timeoutSeconds: 6,
  },
  experiments: {
    assignment: 'stable-per-install',
    saltVersion: 1,
    items: {},
  },
  regions: {
    default: { enabled: true },
    UG: { enabled: true },
  },
  runtime: {
    apiTimeoutSeconds: 8,
    retryCount: 2,
    retryBackoffMs: 500,
    catalogRefreshMinutes: 30,
    configRefreshMinutes: 15,
    updateCheckHours: 12,
  },
  campaigns: [],
}

type ConfigRecord = Record<string, unknown>
type FirebaseCache = {
  config: Record<string, unknown> | null
  revision: number | null
  fetchedAtMs: number
}

type KvLike = {
  get(key: string, type?: 'json'): Promise<unknown>
  put?(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

function asRecord(value: unknown): ConfigRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ConfigRecord
    : {}
}

function enforceProductScope(value: ConfigRecord): ConfigRecord {
  const features = {
    ...asRecord(value.features),
    together: true,
    togetherNearby: true,
    togetherAnywhere: true,
  }
  delete features.onlineMusic

  return {
    ...value,
    revision: CURRENT_REVISION,
    features,
    search: {
      ...asRecord(value.search),
      categories: DEFAULT_CONFIG.search.categories,
      providerPriority: DEFAULT_CONFIG.search.providerPriority,
    },
    ai: {
      ...asRecord(value.ai),
      greeting: DEFAULT_CONFIG.ai.greeting,
    },
  }
}

function migrateConfig(stored: unknown): ConfigRecord {
  const source = asRecord(stored)
  const revision = Number(source.revision ?? 0)
  if (revision >= CURRENT_REVISION) return enforceProductScope(source)

  const oldFeatures = asRecord(source.features)
  const transfer = oldFeatures.transfer ?? oldFeatures.beam ?? true
  const privateFeature = oldFeatures.private ?? oldFeatures.safe ?? true
  const firebaseIdentity = oldFeatures.firebaseIdentity ?? oldFeatures.firebaseAuth ?? true
  const features = {
    ...DEFAULT_CONFIG.features,
    transfer,
    private: privateFeature,
    beam: transfer,
    safe: privateFeature,
    equalizer: oldFeatures.equalizer ?? true,
    whatsappTrimmer: oldFeatures.whatsappTrimmer ?? oldFeatures.trimmer ?? true,
    converter: oldFeatures.converter ?? true,
    onlineThemes: oldFeatures.onlineThemes ?? true,
    googleSignIn: oldFeatures.googleSignIn ?? true,
    firebaseIdentity,
    firebaseAuth: firebaseIdentity,
    firebaseAppCheck: oldFeatures.firebaseAppCheck ?? true,
    firebaseAnalytics: oldFeatures.firebaseAnalytics ?? true,
    firebasePerformance: oldFeatures.firebasePerformance ?? true,
    driveBackup: oldFeatures.driveBackup ?? true,
    feedback: oldFeatures.feedback ?? true,
    aiAssistant: oldFeatures.aiAssistant ?? true,
    cloudPush: oldFeatures.cloudPush ?? true,
    together: true,
    togetherNearby: true,
    togetherAnywhere: true,
  }

  const links = { ...DEFAULT_CONFIG.links, ...asRecord(source.links), ai: DEFAULT_CONFIG.links.ai }
  const push = {
    ...DEFAULT_CONFIG.push,
    ...asRecord(source.push),
    provider: 'fcm',
    optionalForPlayback: true,
  }

  return enforceProductScope({
    ...DEFAULT_CONFIG,
    ...source,
    revision: CURRENT_REVISION,
    maintenance: {
      ...DEFAULT_CONFIG.maintenance,
      ...asRecord(source.maintenance),
      allowOfflinePlayback: true,
    },
    versions: { ...DEFAULT_CONFIG.versions, ...asRecord(source.versions) },
    features,
    home: { ...DEFAULT_CONFIG.home, ...asRecord(source.home) },
    links,
    ai: DEFAULT_CONFIG.ai,
    push,
    auth: DEFAULT_CONFIG.auth,
    security: {
      ...DEFAULT_CONFIG.security,
      ...asRecord(source.security),
      appCheck: {
        ...DEFAULT_CONFIG.security.appCheck,
        ...asRecord(asRecord(source.security).appCheck),
        allowOfflinePlayback: true,
      },
    },
    search: {
      ...DEFAULT_CONFIG.search,
      ...asRecord(source.search),
      categories: DEFAULT_CONFIG.search.categories,
      providerPriority: DEFAULT_CONFIG.search.providerPriority,
    },
    experiments: { ...DEFAULT_CONFIG.experiments, ...asRecord(source.experiments) },
    regions: { ...DEFAULT_CONFIG.regions, ...asRecord(source.regions) },
    runtime: { ...DEFAULT_CONFIG.runtime, ...asRecord(source.runtime) },
  })
}

function validFirebaseCache(value: unknown): FirebaseCache | null {
  const record = asRecord(value)
  if (typeof record.fetchedAtMs !== 'number') return null
  const config = record.config
  return {
    config: config && typeof config === 'object' && !Array.isArray(config)
      ? config as Record<string, unknown>
      : null,
    revision: typeof record.revision === 'number' ? record.revision : null,
    fetchedAtMs: record.fetchedAtMs,
  }
}

async function loadFirebaseClientLayer(
  env: Record<string, unknown>,
  kv: KvLike | undefined,
): Promise<FirebaseCache | null> {
  const cached = kv ? validFirebaseCache(await kv.get(FIREBASE_CACHE_KEY, 'json')) : null
  if (cached && Date.now() - cached.fetchedAtMs < FIREBASE_CACHE_FRESH_MS) return cached

  const serviceAccountJson = env.FCM_SERVICE_ACCOUNT_JSON as string | undefined
  if (!serviceAccountJson) return cached

  try {
    const remote = await getFirebaseRemoteConfigTemplate(
      serviceAccountJson,
      env.FIREBASE_PROJECT_ID as string | undefined,
    )
    const extracted = extractOtyaClientConfig(remote.template)
    const fresh: FirebaseCache = {
      config: extracted.config,
      revision: extracted.revision,
      fetchedAtMs: Date.now(),
    }
    if (kv?.put) {
      try {
        await kv.put(
          FIREBASE_CACHE_KEY,
          JSON.stringify(fresh),
          { expirationTtl: FIREBASE_CACHE_TTL_SECS },
        )
      } catch {
        // Cache persistence is optional; the fresh response is still usable.
      }
    }
    return fresh
  } catch (error) {
    console.error('[app-config] Firebase Remote Config fetch failed:', (error as Error)?.message)
    return cached
  }
}

export async function GET() {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as Record<string, unknown>
  const kv = recordEnv.KV as KvLike | undefined
  let config: ConfigRecord = DEFAULT_CONFIG

  if (kv) {
    try {
      const stored = await kv.get(KEY, 'json')
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        const migrated = migrateConfig(stored)
        config = migrated
        const oldRevision = Number(asRecord(stored).revision ?? 0)
        if (oldRevision < CURRENT_REVISION && kv.put) {
          try {
            await kv.put(KEY, JSON.stringify(migrated))
          } catch {
            // Migration persistence is best-effort; serving config must continue.
          }
        }
      }
    } catch {
      config = DEFAULT_CONFIG
    }
  }

  const cloudflareRevision = Number(config.revision ?? CURRENT_REVISION)
  const firebaseLayer = await loadFirebaseClientLayer(recordEnv, kv)
  const useFirebase = Boolean(
    firebaseLayer?.config
    && firebaseLayer.revision !== null
    && firebaseLayer.revision >= cloudflareRevision,
  )

  if (useFirebase && firebaseLayer?.config) {
    config = mergeFirebaseOwnedClientConfig(config, firebaseLayer.config)
  }
  config = enforceProductScope(config)

  return NextResponse.json(
    {
      ok: true,
      config,
      source: {
        safety: 'cloudflare',
        clientConfig: useFirebase ? 'firebase-remote-config' : 'cloudflare-fallback',
      },
      fetchedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
