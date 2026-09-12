import { getGoogleAccessToken } from './google_oauth'

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

/** Mint a short-lived OAuth2 access token for the FCM HTTP v1 API. */
export async function getFcmAccessToken(serviceAccountJson: string): Promise<string> {
  return getGoogleAccessToken(serviceAccountJson, [FCM_SCOPE])
}

export interface FcmSendResult {
  sent: number
  failed: number
}

/**
 * Send FCM messages using a pre-fetched OAuth2 access token.
 * Callers that send many messages should obtain the token once and reuse it.
 */
export async function sendFcmWithToken(
  tokens: string[],
  title: string,
  body: string,
  url: string,
  accessToken: string,
  projectId: string,
): Promise<FcmSendResult> {
  const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

  let sent = 0
  let failed = 0
  const uniqueTokens = [...new Set(tokens.filter(Boolean))]
  let next = 0
  const worker = async () => {
    while (next < uniqueTokens.length) {
      const token = uniqueTokens[next++]
      try {
        const response = await fetch(fcmEndpoint, {
          method: 'POST',
          signal: AbortSignal.timeout(8000),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { url },
              android: {
                priority: 'high',
                ttl: '86400s',
                collapse_key: 'otya_announcement',
                notification: {
                  channel_id: 'otya_announcements',
                  default_sound: true,
                },
              },
            },
          }),
        })
        if (response.ok) sent++
        else failed++
      } catch {
        // One unreachable device must not discard the rest of the batch or
        // erase counts for requests the provider already accepted.
        failed++
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, uniqueTokens.length) }, worker))

  return { sent, failed }
}

/** Convenience wrapper for one batch. */
export async function sendFcmToTokens(
  tokens: string[],
  title: string,
  body: string,
  url: string,
  serviceAccountJson: string,
  projectId: string,
): Promise<FcmSendResult> {
  const accessToken = await getFcmAccessToken(serviceAccountJson)
  return sendFcmWithToken(tokens, title, body, url, accessToken, projectId)
}
