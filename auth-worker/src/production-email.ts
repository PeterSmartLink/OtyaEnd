import { generateOtp } from './crypto'
import { sendResendEmail } from './resend'

interface KVLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export interface ProductionEmailEnv {
  AUTH_KV: KVLike
  AUTH_JWT_SECRET: string
  RESEND_API_KEY?: string
}

const VERIFY_TTL = 10 * 60
const LAST_LOGIN_IP_TTL = 90 * 24 * 60 * 60

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function verificationDigest(env: ProductionEmailEnv, userId: string, code: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.AUTH_JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`otya-otp:verify-email:${userId}:${code.trim().toUpperCase()}`))
  return `hmac-sha256:${toHex(new Uint8Array(signature))}`
}

function userFromResponse(response: Response): Promise<{ id?: string; email?: string | null; name?: string | null } | null> {
  return response.clone().json().then(data => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const user = (data as { user?: unknown }).user
    return user && typeof user === 'object' && !Array.isArray(user)
      ? user as { id?: string; email?: string | null; name?: string | null }
      : null
  }).catch(() => null)
}

/** Registration owns exactly one automatic email: the verification code. */
export async function deliverRegistrationEmails(response: Response, env: ProductionEmailEnv): Promise<void> {
  if (!response.ok) return
  const user = await userFromResponse(response)
  const userId = String(user?.id ?? '').trim()
  const email = String(user?.email ?? '').trim().toLowerCase()
  if (!userId || !email) return

  const name = String(user?.name ?? '').trim() || 'there'
  const code = generateOtp()
  const key = `verify_otp:${userId}`
  await env.AUTH_KV.put(key, await verificationDigest(env, userId, code), { expirationTtl: VERIFY_TTL })

  try {
    await sendResendEmail(env.RESEND_API_KEY, {
      from: 'Otya <noreply@petersmartlink.com>',
      to: [email],
      subject: 'Your Otya verification code',
      text: [
        `Hi ${name},`,
        '',
        'Use this code to verify your Otya email address:',
        '',
        code,
        '',
        'This code expires in 10 minutes.',
        'Only the newest verification code will work.',
        '',
        'If you did not create this Otya account, you can ignore this message.',
        '— The Otya Team',
      ].join('\n'),
    })
  } catch (error) {
    await env.AUTH_KV.delete(key)
    console.error('[auth/email] Registration verification delivery failed:', (error as Error)?.message)
  }
}

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    ?? 'unknown'
}

export async function deliverNewDeviceAlert(request: Request, response: Response, env: ProductionEmailEnv): Promise<void> {
  if (!response.ok) return
  const user = await userFromResponse(response)
  const userId = String(user?.id ?? '').trim()
  const email = String(user?.email ?? '').trim().toLowerCase()
  if (!userId || !email) return

  const ip = clientIp(request)
  const key = `resend_last_login_ip:${userId}`
  let previous: string | null = null
  try {
    previous = await env.AUTH_KV.get(key)
  } catch (error) {
    console.error('[auth/email] New-device state update failed:', (error as Error)?.message)
    return
  }
  if (previous === ip) return
  if (!previous) {
    await env.AUTH_KV.put(key, ip, { expirationTtl: LAST_LOGIN_IP_TTL })
    return
  }

  try {
    await sendResendEmail(env.RESEND_API_KEY, {
      from: 'Otya Security <noreply@petersmartlink.com>',
      to: [email],
      subject: 'New login to your Otya account',
      text: [
        'We detected a login to your Otya account from a different network.',
        '',
        `IP address : ${ip}`,
        `Time       : ${new Date().toUTCString()}`,
        '',
        'If this was you, no action is needed.',
        'If it was not you, review your Otya account security and active sessions.',
        '',
        '— The Otya Security Team',
      ].join('\n'),
    })
    // Advance the baseline only after the provider accepts the alert.
    await env.AUTH_KV.put(key, ip, { expirationTtl: LAST_LOGIN_IP_TTL })
  } catch (error) {
    console.error('[auth/email] New-device alert delivery failed:', (error as Error)?.message)
  }
}
