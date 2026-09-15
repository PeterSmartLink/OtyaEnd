const CLIENT_FEATURE_KEYS = new Set([
  'transfer',
  'private',
  // Legacy aliases are retained for older installed clients only.
  'beam',
  'safe',
  'equalizer',
  'trimmer',
  'whatsappTrimmer',
  'converter',
  'onlineThemes',
  'googleSignIn',
  'driveBackup',
  'feedback',
  'ratings',
  'firebaseIdentity',
  'firebaseAuth',
  'firebaseAppCheck',
  'firebaseAnalytics',
  'firebasePerformance',
])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function pickFeatures(value: unknown): Record<string, unknown> {
  const features = asRecord(value)
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(features)) {
    if (CLIENT_FEATURE_KEYS.has(key) && typeof item === 'boolean') out[key] = item
  }
  return out
}

/**
 * Firebase Remote Config owns only approved client presentation/experiment
 * settings. Removed product surfaces (including consumer AI and Online Music) are deliberately
 * absent from this allowlist and cannot be re-enabled remotely.
 */
export function extractFirebaseOwnedClientConfig(
  fullConfig: Record<string, unknown>,
): Record<string, unknown> {
  return {
    features: pickFeatures(fullConfig.features),
    home: asRecord(fullConfig.home),
    ai: asRecord(fullConfig.ai),
    search: asRecord(fullConfig.search),
    campaigns: Array.isArray(fullConfig.campaigns) ? fullConfig.campaigns : [],
  }
}

/**
 * Merge Firebase-owned client values onto the Cloudflare safety config while
 * refusing to let Firebase override server-critical sections.
 */
export function mergeFirebaseOwnedClientConfig(
  cloudflareConfig: Record<string, unknown>,
  firebaseClientConfig: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!firebaseClientConfig) return cloudflareConfig

  const cloudflareFeatures = asRecord(cloudflareConfig.features)
  const firebaseFeatures = pickFeatures(firebaseClientConfig.features)

  return {
    ...cloudflareConfig,
    features: {
      ...cloudflareFeatures,
      ...firebaseFeatures,
    },
    home: {
      ...asRecord(cloudflareConfig.home),
      ...asRecord(firebaseClientConfig.home),
    },
    ai: {
      ...asRecord(cloudflareConfig.ai),
      ...asRecord(firebaseClientConfig.ai),
    },
    search: {
      ...asRecord(cloudflareConfig.search),
      ...asRecord(firebaseClientConfig.search),
    },
    campaigns: Array.isArray(firebaseClientConfig.campaigns)
      ? firebaseClientConfig.campaigns
      : cloudflareConfig.campaigns,
  }
}
