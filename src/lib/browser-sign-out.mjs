// A failed request must leave the UI signed in so the user can retry.
export async function signOutBrowser({ fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const controller = new AbortController()
  const deadline = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl('/api/account-session/logout', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('Sign out failed')
  } finally {
    clearTimeout(deadline)
  }
}
