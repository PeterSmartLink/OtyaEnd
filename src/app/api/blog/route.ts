import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { secureJson, errorJson } from '@/lib/response'
import { getDB } from '@/lib/d1'
import { verifyAdminSession } from '@/lib/admin_auth'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://petersmartlink.com',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function slugify(title: string) {
  return title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

export async function GET() {
  const { env } = await getCloudflareContext({ async: true })
  const db = getDB(env as Record<string, unknown>)
  try {
    const { results } = await db.prepare('SELECT id, slug, title, excerpt, category, author_name, created_at FROM blog_posts WHERE published = 1 ORDER BY created_at DESC LIMIT 50').all()
    return secureJson({ posts: results }, { cache: 'public, max-age=300' })
  } catch (err) {
    console.error('[blog] D1 query failed:', err)
    return errorJson('Failed to load articles', 500)
  }
}

async function requireAdmin(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const envMap = env as Record<string, unknown>
  return await verifyAdminSession(req, envMap) ? envMap : null
}

export async function POST(req: NextRequest) {
  const envMap = await requireAdmin(req)
  if (!envMap) return errorJson('Unauthorized', 401)
  let body: { title?: string; content?: string; slug?: string; excerpt?: string; category?: string; author_name?: string }
  try { body = await req.json() } catch { return errorJson('Invalid JSON body') }
  if (!body.title?.trim() || !body.content?.trim()) return errorJson('title and content are required')
  const slug = body.slug?.trim() || slugify(body.title)
  const db = getDB(envMap)
  try {
    const result = await db.prepare('INSERT INTO blog_posts (slug, title, content, excerpt, category, author_name, published) VALUES (?, ?, ?, ?, ?, ?, 1)')
      .bind(slug, body.title.trim(), body.content.trim(), body.excerpt?.trim() ?? null, body.category?.trim() ?? 'Product', body.author_name?.trim() ?? 'PeterSmart Link').run()
    const post = await db.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(result.meta.last_row_id).first()
    return secureJson({ ok: true, post }, { status: 201 })
  } catch (err) {
    console.error('[blog POST] D1 insert failed:', err)
    return String(err).includes('UNIQUE') ? errorJson('An article with this slug already exists', 409) : errorJson('Failed to publish article', 500)
  }
}

export async function PATCH(req: NextRequest) {
  const envMap = await requireAdmin(req)
  if (!envMap) return errorJson('Unauthorized', 401)
  let body: { id?: number; title?: string; content?: string; excerpt?: string; category?: string; author_name?: string; published?: number }
  try { body = await req.json() } catch { return errorJson('Invalid JSON body') }
  if (!body.id) return errorJson('id is required')
  const clauses = ['updated_at = CURRENT_TIMESTAMP'], binds: unknown[] = []
  for (const [key, column] of [['title', 'title'], ['content', 'content'], ['excerpt', 'excerpt'], ['category', 'category'], ['author_name', 'author_name']] as const) {
    if (body[key] !== undefined) { clauses.push(column + ' = ?'); binds.push(body[key]) }
  }
  if (body.published !== undefined) { clauses.push('published = ?'); binds.push(body.published ? 1 : 0) }
  if (clauses.length === 1) return errorJson('No fields to update')
  binds.push(body.id)
  const db = getDB(envMap)
  try {
    await db.prepare('UPDATE blog_posts SET ' + clauses.join(', ') + ' WHERE id = ?').bind(...binds).run()
    const post = await db.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(body.id).first()
    return post ? secureJson({ ok: true, post }) : errorJson('Article not found', 404)
  } catch (err) {
    console.error('[blog PATCH] D1 update failed:', err)
    return errorJson('Failed to update article', 500)
  }
}

export async function DELETE(req: NextRequest) {
  const envMap = await requireAdmin(req)
  if (!envMap) return errorJson('Unauthorized', 401)
  let body: { id?: number; slug?: string }
  try { body = await req.json() } catch { return errorJson('Invalid JSON body') }
  if (!body.id && !body.slug) return errorJson('id or slug is required')
  const db = getDB(envMap)
  try {
    if (body.id) await db.prepare('UPDATE blog_posts SET published = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(body.id).run()
    else await db.prepare('UPDATE blog_posts SET published = 0, updated_at = CURRENT_TIMESTAMP WHERE slug = ?').bind(body.slug).run()
    return secureJson({ ok: true, message: 'Article unpublished' })
  } catch (err) {
    console.error('[blog DELETE] D1 update failed:', err)
    return errorJson('Failed to unpublish article', 500)
  }
}

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS_HEADERS }) }
