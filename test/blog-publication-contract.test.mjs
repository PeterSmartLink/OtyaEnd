import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('PeterSmart Journal uses the migrated publication schema', () => {
  const list = read('src/app/api/blog/route.ts')
  const article = read('src/app/api/blog/[slug]/route.ts')
  const migration = read('migrations/0012_blog_publication_hardening.sql')
  assert.match(list, /WHERE published = 1/)
  assert.match(article, /WHERE slug = \? AND published = 1/)
  assert.match(list, /author_name/)
  assert.match(migration, /ADD COLUMN category/)
  assert.match(migration, /ADD COLUMN author_name/)
  assert.doesNotMatch(list, /isPublished|createdAt|updatedAt/)
})

test('public journal routes are restored without sample-content seeding', () => {
  const index = read('src/app/blog/page.tsx')
  const seed = read('src/app/api/blog/seed/route.ts')
  assert.match(index, /The PeterSmart Journal/)
  assert.match(index, /BlogIndexClient/)
  assert.match(seed, /status: 410/)
})
