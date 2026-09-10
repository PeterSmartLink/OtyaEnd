import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const router = readFileSync(new URL('../src/production-router.mjs', import.meta.url), 'utf8')
const nextConfig = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8')
const status = readFileSync(new URL('../src/app/status/page.tsx', import.meta.url), 'utf8')

test('documentation product links and help preserve their destinations', () => {
  assert.ok(router.includes('publicDestinations.has(publicPath)'))
  assert.ok(router.includes('redirectToHost(url, APP_HOST, url.pathname)'))
  assert.ok(router.includes("redirectToHost(url, DOCS_HOST, '/help/')"))
})

test('custom domains are canonical public entry points', () => {
  assert.ok(router.includes("const APP_HOST = 'petersmartlink.com'"))
  assert.ok(router.includes("const DOCS_HOST = 'docs.petersmartlink.com'"))
  assert.ok(router.includes("const STATUS_HOST = 'status.petersmartlink.com'"))
  assert.ok(router.includes("const SPACE_HOST = 'space.petersmartlink.com'"))
  assert.ok(router.includes("redirectToHost(url, DOCS_HOST, '/')"))
  assert.ok(router.includes("redirectToHost(url, STATUS_HOST, '/')"))
  assert.ok(router.includes("redirectToHost(url, SPACE_HOST, '/')"))
})

test('Space root is a product home while Account and Admin remain Space sections', () => {
  assert.ok(router.includes("url.pathname === '/' || url.pathname === '/space'"))
  assert.ok(router.includes("dispatchSurface(request, url, env, ctx, '/space/')"))
  assert.ok(router.includes("url.pathname === '/account'"))
  assert.ok(router.includes("dispatchSurface(request, url, env, ctx, '/account/')"))
  assert.ok(router.includes("pathname.startsWith('/account/')"))
  assert.ok(router.includes("pathname === '/admin'"))
  assert.ok(router.includes("pathname.startsWith('/admin/')"))
  assert.ok(router.includes("['admin', '/admin']"))
})

test('Space allows approved signed-in product routes instead of redirecting them away', () => {
  assert.ok(router.includes("pathname.startsWith('/account/')"))
  assert.ok(router.includes("pathname === '/ask'"))
  assert.ok(router.includes("pathname.startsWith('/ask/')"))
  assert.ok(router.includes("pathname === '/telegram/'"))
  assert.ok(router.includes("pathname === '/admin'"))
  assert.ok(router.includes('isSpaceSurfacePath(url.pathname)'))
})

test('Docs root is real documentation while Help and Status stay distinct surfaces', () => {
  assert.ok(router.includes("host === DOCS_HOST"))
  assert.ok(router.includes("url.pathname === '/' || url.pathname === '/docs'"))
  assert.ok(router.includes("dispatchSurface(request, url, env, ctx, '/docs/')"))
  assert.ok(router.includes("dispatchSurface(request, url, env, ctx, '/help/')"))
  assert.ok(router.includes("host === STATUS_HOST"))
  assert.ok(router.includes("dispatchSurface(request, url, env, ctx, '/status/')"))
  assert.ok(!router.includes("redirectToHost(url, APP_HOST, '/help')"))
  assert.ok(!router.includes("redirectToHost(url, APP_HOST, '/status')"))
})

test('surface rewrites preserve browser hostname and Next trailing slash policy', () => {
  assert.ok(nextConfig.includes('trailingSlash: true'))
  assert.ok(router.includes('async function dispatchSurface'))
  assert.ok(router.includes("headers.set('X-Forwarded-Host', url.hostname)"))
  assert.ok(router.includes("target.pathname = pathname"))
  assert.ok(!router.includes('target.hostname = APP_HOST'))
  assert.ok(router.includes("dispatchSurface(request, url, env, ctx, '/space/')"))
  assert.ok(router.includes("dispatchSurface(request, url, env, ctx, '/account/')"))
  assert.ok(router.includes("dispatchSurface(request, url, env, ctx, '/sign-in/')"))
  assert.ok(router.includes("dispatchSurface(request, url, env, ctx, '/docs/')"))
})

test('legacy apex paths converge to clean subdomains without losing intent', () => {
  assert.ok(router.includes("url.pathname === '/docs'"))
  assert.ok(router.includes("url.pathname === '/help'"))
  assert.ok(router.includes("url.pathname === '/status'"))
  assert.ok(router.includes("url.pathname === '/account'"))
  assert.ok(router.includes("url.pathname === '/admin'"))
  assert.ok(router.includes("redirectToHost(url, DOCS_HOST, '/')"))
  assert.ok(router.includes("redirectToHost(url, STATUS_HOST, '/')"))
  assert.ok(router.includes("redirectToHost(url, SPACE_HOST, '/account/')"))
  assert.ok(router.includes("redirectToHost(url, SPACE_HOST, url.pathname)"))
})

test('custom surfaces keep HTTPS and generated OpenNext routing explicit', () => {
  assert.ok(router.includes("target.protocol = 'https:'"))
  assert.ok(router.includes("import openNextWorker from '../.open-next/worker.js'"))
  assert.ok(router.includes('Response.redirect(target.toString(), 302)'))
})

test('public status page avoids exposing internal monitoring details', () => {
  assert.ok(status.includes("title: 'Otya Status'"))
  assert.ok(status.includes('never publishes customer data, logs, secrets'))
  assert.ok(status.includes('Account-specific or private operational issues are intentionally not shown here'))
  assert.ok(!status.includes('CLOUDFLARE_ACCOUNT_ID'))
  assert.ok(!status.includes('INTERNAL_SECRET'))
  assert.ok(!status.includes('D1 database'))
  assert.ok(!status.includes('R2 bucket'))
})
