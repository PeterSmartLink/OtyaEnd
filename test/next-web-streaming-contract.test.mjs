import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/OtyaAssistPrompt.tsx', import.meta.url), 'utf8')

test('website Next requests SSE and consumes response chunks incrementally', () => {
  assert.match(source, /'accept':'text\/event-stream'/)
  assert.match(source, /readChatStream\(response\.body/)
  assert.match(source, /event\.type==='delta'/)
  assert.match(source, /content:message\.content\+event\.delta/)
})

test('website Next keeps JSON fallback and retry behavior', () => {
  assert.match(source, /response\.json\(\)/)
  assert.match(source, /failed:true/)
  assert.match(source, /retryLast/)
})
