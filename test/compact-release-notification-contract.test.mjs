import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const queue = fs.readFileSync('src/queue-worker.mjs', 'utf8')
const workflow = fs.readFileSync('src/release-workflow.mjs', 'utf8')

test('push consumer canonicalizes release notifications to the updates channel', () => {
  assert.match(queue, /rawType === 'update' \|\| rawType === 'release_available'/)
  assert.match(queue, /messageType: 'update'/)
  assert.match(queue, /channelId = messageType === 'update'/)
  assert.match(queue, /data\.type = 'update'/)
})

test('release notification copy is compact and does not render changelog as body', () => {
  const compact = 'New features and improvements are ready. Tap to see what’s new.'
  assert.ok(queue.includes(compact))
  assert.ok(workflow.includes(compact))

  assert.ok(!workflow.includes('body: metadata.changelog'))
  assert.ok(!queue.includes('body: metadata.changelog'))
})
