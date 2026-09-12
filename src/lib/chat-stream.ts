export type ChatStreamEvent = {
  type?: string
  delta?: string
  error?: string
  handoff_available?: boolean
}

/** Read Next's SSE protocol without losing fragmented Unicode or final errors. */
export async function readChatStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<boolean> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let received = false
  let complete = false
  function consume(block: string) {
    const raw = block.split(/\r?\n/).filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart()).join('\n').trim()
    if (!raw) return
    if (raw === '[DONE]') { complete = true; return }
    const event = JSON.parse(raw) as ChatStreamEvent | null
    if (!event || typeof event !== 'object') throw new Error('Invalid response event')
    if (event.type === 'error') throw new Error('The response was interrupted')
    if (event.type === 'done') complete = true
    if (event.type === 'delta' && typeof event.delta === 'string' && event.delta) received = true
    onEvent(event)
  }
  try {
    while (!complete) {
      const { done, value } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() || ''
      for (const block of blocks) { consume(block); if (complete) break }
      if (buffer.length > 65536) throw new Error('Response event is too large')
      if (done) { if (!complete && buffer.trim()) consume(buffer); break }
    }
    if (!complete) throw new Error('The response ended before completion')
    return received
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
