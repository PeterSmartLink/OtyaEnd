import test from 'node:test'
import assert from 'node:assert/strict'
import { sendResendEmail } from '../auth-worker/src/resend.ts'
const email = { from: 'Otya <noreply@example.com>', to: ['test@example.com'], subject: 'Otya service notice', text: 'First detail.\nSecond detail.' }
async function mocked(responses, run) {
  const original = globalThis.fetch
  const payloads = []
  globalThis.fetch = async (_url, init) => {
    payloads.push(JSON.parse(init.body))
    const next = responses.shift()
    if (next instanceof Error) throw next
    return next
  }
  try { await run(payloads) } finally { globalThis.fetch = original }
}
test('service notice uses published alias and preserves all message lines', async () => {
  await mocked([Response.json({ id: 'accepted' })], async calls => {
    assert.equal(await sendResendEmail('test-key', email), 'accepted')
    assert.equal(calls[0].template.id, 'otya-service-notice-1')
    assert.equal(calls[0].template.variables.MESSAGE, email.text)
  })
})
test('ambiguous failures do not send a second email', async () => {
  for (const response of [new Error('network'), Response.json({}, { status: 429 }), Response.json({}, { status: 503 }), Response.json({})]) {
    await mocked([response], async calls => {
      await assert.rejects(sendResendEmail('test-key', email))
      assert.equal(calls.length, 1)
    })
  }
})
test('explicit missing-template rejection uses escaped branded fallback', async () => {
  await mocked([Response.json({}, { status: 404 }), Response.json({ id: 'fallback' })], async calls => {
    await sendResendEmail('test-key', { ...email, text: '<script>unsafe</script>' })
    assert.equal(calls.length, 2)
    assert.match(calls[1].html, /&lt;script&gt;/)
    assert.equal(calls[1].text, '<script>unsafe</script>')
  })
})
test('admin verification preserves purpose instead of using generic template', async () => {
  await mocked([Response.json({ id: 'admin' })], async calls => {
    await sendResendEmail('test-key', { ...email, subject: 'Your Otya Admin verification code', text: 'A1234\nOnly approve your own admin request.' })
    assert.equal(calls[0].template, undefined)
    assert.match(calls[0].text, /Only approve/)
  })
})
