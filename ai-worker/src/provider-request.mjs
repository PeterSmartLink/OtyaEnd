// These callers only need the provider's HTTP status. No automatic retries:
// a timed-out email or message may already have been delivered.
export async function providerRequest(url, init, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const controller = new AbortController()
  const deadline = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(deadline)
  }
}
