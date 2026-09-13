import test from 'node:test'
import assert from 'node:assert/strict'

import {
  analyzeOwnerWorkspaceImage,
  isOwnerImageContext,
} from '../ai-worker/src/owner-vision.mjs'

test('owner vision uses bounded data URI through Workers AI only on explicit image context', async () => {
  const calls = []
  const env = {
    AI: {
      run: async (model, input) => {
        calls.push({ model, input })
        return { answer: 'This is an OTYA settings screenshot.' }
      },
    },
  }
  const context = {
    kind: 'local_image',
    title: 'settings.png',
    source: '120 KB · image · private vision ready',
    text: 'data:image/png;base64,AAAA',
  }

  assert.equal(isOwnerImageContext(context), true)
  const result = await analyzeOwnerWorkspaceImage(
    env,
    'Analyze this image and tell me what looks wrong.',
    context,
  )

  assert.equal(result.answer, 'This is an OTYA settings screenshot.')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].model, '@cf/moondream/moondream3.1-9B-A2B')
  assert.equal(calls[0].input.task, 'query')
  assert.equal(calls[0].input.image, context.text)
  assert.equal(calls[0].input.reasoning, false)
  assert.equal(calls[0].input.stream, false)
})

test('owner vision rejects URLs and unsupported image payloads', async () => {
  let called = false
  const env = {
    AI: {
      run: async () => {
        called = true
        return { answer: 'should not run' }
      },
    },
  }

  await assert.rejects(
    analyzeOwnerWorkspaceImage(env, 'Analyze this', {
      kind: 'local_image',
      text: 'https://example.com/private.png',
    }),
    TypeError,
  )
  await assert.rejects(
    analyzeOwnerWorkspaceImage(env, 'Analyze this', {
      kind: 'local_image',
      text: 'data:image/svg+xml;base64,AAAA',
    }),
    TypeError,
  )
  assert.equal(called, false)
})
