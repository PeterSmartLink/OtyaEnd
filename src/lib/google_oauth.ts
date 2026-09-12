export interface GoogleServiceAccount {
  client_email: string
  private_key: string
  token_uri?: string
}

const GOOGLE_TOKEN_ORIGIN = 'https://oauth2.googleapis.com'
const GOOGLE_TOKEN_PATH = '/token'

function base64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function encodeUtf8(value: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(value)
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength,
  ) as ArrayBuffer
}

function googleTokenUri(value?: string): string {
  const candidate = value?.trim() || `${GOOGLE_TOKEN_ORIGIN}${GOOGLE_TOKEN_PATH}`
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error('Firebase service account token_uri is invalid')
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.origin !== GOOGLE_TOKEN_ORIGIN
    || parsed.pathname !== GOOGLE_TOKEN_PATH
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('Firebase service account token_uri is not an approved Google OAuth endpoint')
  }
  return parsed.toString()
}

export async function getGoogleAccessToken(
  serviceAccountJson: string,
  scopes: string[],
): Promise<string> {
  if (!serviceAccountJson.trim()) throw new Error('Firebase service account is not configured')
  if (scopes.length === 0) throw new Error('At least one Google OAuth scope is required')

  let serviceAccount: GoogleServiceAccount
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as GoogleServiceAccount
  } catch {
    throw new Error('Firebase service account JSON is invalid')
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Firebase service account JSON is missing client_email or private_key')
  }

  const now = Math.floor(Date.now() / 1000)
  const tokenUri = googleTokenUri(serviceAccount.token_uri)
  const header = base64urlEncode(
    encodeUtf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
  )
  const payload = base64urlEncode(
    encodeUtf8(JSON.stringify({
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      aud: tokenUri,
      scope: scopes.join(' '),
      iat: now,
      exp: now + 3600,
    })),
  )
  const signingInput = `${header}.${payload}`

  const pemBody = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const derBytes = Uint8Array.from(atob(pemBody), (char) => char.charCodeAt(0))
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    derBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    encodeUtf8(signingInput),
  )
  const assertion = `${signingInput}.${base64urlEncode(signature)}`

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) {
    throw new Error(`Google OAuth token exchange failed (HTTP ${response.status})`)
  }

  const data = await response.json() as { access_token?: string }
  if (!data.access_token) throw new Error('Google OAuth token response did not contain access_token')
  return data.access_token
}
