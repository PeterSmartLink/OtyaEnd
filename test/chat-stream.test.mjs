import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/lib/chat-stream.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
const { readChatStream } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
function stream(text) {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close() } })
}
test('fragmented UTF-8 and final completion event preserve the answer', async () => {
  let answer = ''
  const received = await readChatStream(stream('data: {"type":"delta","delta":"Hello 👋\\nOtya"}\r\n\r\ndata: {"type":"done"}'), event => { if (event.delta) answer += event.delta })
  assert.equal(answer, 'Hello 👋\nOtya')
  assert.equal(received, true)
})
test('a final error without newline is not silently discarded', async () => {
  await assert.rejects(readChatStream(stream('data: {"type":"error"}'), () => {}), /interrupted/)
})
test('truncated streams report failure after preserving partial text', async () => {
  let answer = ''
  await assert.rejects(readChatStream(stream('data: {"type":"delta","delta":"Partial"}\n\n'), event => { answer += event.delta || '' }), /before completion/)
  assert.equal(answer, 'Partial')
})
test('DONE cancels the reader even when the transport stays open', async () => {
  let cancelled = false
  const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: [DONE]\n\n')) }, cancel() { cancelled = true } })
  assert.equal(await readChatStream(body, () => {}), false)
  assert.equal(cancelled, true)
})
