import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('visitor-facing pages use the canonical Otya Player download path', () => {
  const music = read('src/app/music/page.tsx')
  assert.match(music, /href="\/download\/otya-player"/)
  assert.doesNotMatch(music, /href="\/download\/otya"/)
})

test('generic website loading uses Otya identity without impersonating Next thinking', () => {
  const loading = read('src/app/loading.tsx')
  assert.match(loading, /Loading Otya/)
  assert.match(loading, />Otya<\/div>/)
  assert.doesNotMatch(loading, /Otya Player/)
  assert.doesNotMatch(loading, /\bthinking\b/)
  assert.doesNotMatch(loading, /Next is getting/)
})

test('404 and error fallbacks keep current public product language', () => {
  const notFound = read('src/app/not-found.tsx')
  const errorPage = read('src/app/error.tsx')
  assert.match(notFound, /Open Next/)
  assert.doesNotMatch(notFound, /ask Otya/i)
  assert.match(errorPage, /Try again/)
  assert.match(errorPage, /href="\/help"/)
})

test('help copy is user-facing and mobile contact cards can stack', () => {
  const help = read('src/app/help/page.tsx')
  assert.doesNotMatch(help, /use Resend only/i)
  assert.match(help, /grid sm:grid-cols-2 gap-3/)
})
