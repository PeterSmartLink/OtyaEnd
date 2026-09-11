import { CONVERSATION_TONE } from './conversation-tone.mjs'
import { gmailStatus, listGmailMessages } from './gmail-connector.mjs'
import { controlPlaneStatus } from './control-plane.mjs'
import {
  appendMessage,
  listConversations,
  newConversation,
  readConversation,
  getOrCreateConversation,
  archiveConversation,
} from './conversations.mjs'

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const OTYA_CORE_URL = 'https://petersmartlink.com'

const clean = (v, max = 5000) => String(v ?? '')
  .replace(/[\u0000-\u001f]/g, ' ')
  .trim()
  .slice(0, max)
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
})
const aiText = (r) => typeof r?.response === 'string'
  ? r.response
  : (typeof r?.choices?.[0]?.message?.content === 'string' ? r.choices[0].message.content : '')
const parse = (s) => {
  try {
    const m = String(s || '').match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : null
  } catch {
    return null
  }
}

function internalAuthorized(request, env) {
  return Boolean(env.INTERNAL_SECRET)
    && (request.headers.get('X-OTYA-Internal-Secret') || '') === env.INTERNAL_SECRET
}

async function runAi(env, messages) {
  if (!env.AI?.run) throw new Error('AI binding unavailable')
  return clean(aiText(await env.AI.run(env.OTYA_AI_MODEL || DEFAULT_MODEL, { messages })), 12000)
}

async function telegramCoreStatus() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3500)
  try {
    const response = await fetch(`${OTYA_CORE_URL}/api/telegram/status`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    const data = await response.json().catch(() => ({}))
    const configured = data?.webhook_configured === true
    const aiReady = data?.ai_service_ready === true
    return {
      reachable: response.status === 200 || response.status === 503,
      configured,
      ai_ready: aiReady,
      connected: response.ok && data?.ok === true && configured && aiReady,
    }
  } catch {
    return { reachable: false, configured: false, ai_ready: false, connected: false }
  } finally {
    clearTimeout(timeout)
  }
}

async function pluginRegistry(env) {
  const [gmail, control, telegram] = await Promise.all([
    gmailStatus(env),
    controlPlaneStatus(env),
    telegramCoreStatus(),
  ])
  const firebase = control.firebase_remote_config

  return [
    {
      id: 'resend',
      name: 'Resend',
      category: 'Email',
      status: env.RESEND_API_KEY ? 'connected' : 'setup_required',
      capabilities: ['transactional email', 'outbound support replies', 'operational alerts'],
      write: true,
    },
    {
      id: 'telegram',
      name: 'Telegram',
      category: 'Messaging',
      status: telegram.connected ? 'connected' : telegram.configured ? 'degraded' : 'setup_required',
      capabilities: ['same OTYA AI', 'private support', 'server conversation memory', 'official channel publishing'],
      write: true,
      setup_hint: telegram.connected
        ? 'Healthy through the canonical Otya Core webhook and Next readiness path.'
        : telegram.reachable
          ? 'Otya Core is reachable, but the Telegram webhook or live Next dependency needs attention.'
          : 'Telegram transport is owned by Otya Core; check the Core runtime rather than adding bot credentials to Next.',
    },
    {
      id: 'otya',
      name: 'OTYA',
      category: 'Product',
      status: env.DB && env.KV ? 'connected' : 'degraded',
      capabilities: ['feedback', 'crashes', 'releases', 'users', 'devices', 'usage signals', 'AI queue'],
      write: false,
    },
    {
      id: 'otya-knowledge',
      name: 'OTYA Knowledge',
      category: 'Knowledge',
      status: env.AI_SEARCH?.search ? 'connected' : 'setup_required',
      capabilities: ['private product knowledge search', 'docs retrieval', 'release/support context'],
      write: false,
      setup_hint: 'Bound directly to the existing private Cloudflare AI Search instance. No public search endpoint is exposed.',
    },
    {
      id: 'firebase-remote-config',
      name: 'Firebase Remote Config',
      category: 'Mobile services',
      status: !firebase.configured
        ? 'setup_required'
        : firebase.synced
          ? 'connected'
          : 'degraded',
      capabilities: [
        'client experiment configuration',
        'versioned Remote Config templates',
        'Cloudflare fallback delivery',
      ],
      write: false,
      setup_hint: firebase.configured
        ? `Client source: ${firebase.client_source}.`
        : 'Uses the existing Firebase service account through OTYA Store; no Firebase credential is exposed to AI.',
    },
    {
      id: 'gmail',
      name: 'Gmail',
      category: 'Email',
      status: gmail.connected ? 'connected' : gmail.configured ? 'ready_to_connect' : 'setup_required',
      capabilities: ['support inbox', 'read mailbox', 'search threads', 'read messages', 'send approved mail'],
      write: true,
      setup_hint: gmail.connected
        ? 'Connected through encrypted OAuth tokens.'
        : gmail.configured
          ? 'Ready for Google consent.'
          : 'Requires a Google OAuth Web client and client secret.',
    },
    {
      id: 'github',
      name: 'GitHub',
      category: 'Developer',
      status: 'available_next',
      capabilities: ['issues', 'pull requests', 'workflow status', 'release context'],
      write: true,
      setup_hint: 'Use a dedicated GitHub App/token with least-privilege repository permissions.',
    },
    {
      id: 'cloudflare',
      name: 'Cloudflare',
      category: 'Infrastructure',
      status: env.DB && env.KV ? 'connected' : 'degraded',
      capabilities: ['OTYA D1/KV state', 'config source health', 'queues', 'release and crash data'],
      write: false,
      setup_hint: 'Private Admin AI receives safe OTYA bindings only; it never receives Cloudflare account credentials.',
    },
  ]
}

async function scalar(env, sql, bindings = []) {
  if (!env.DB?.prepare) return 0
  try {
    const row = await env.DB.prepare(sql).bind(...bindings).first()
    return Number(row?.count || 0)
  } catch {
    return 0
  }
}

async function systemSnapshot(env) {
  const out = {
    generated_at: new Date().toISOString(),
    database: Boolean(env.DB),
    kv: Boolean(env.KV),
    ai: Boolean(env.AI?.run),
    ai_search: Boolean(env.AI_SEARCH?.search),
    browser: Boolean(env.BROWSER),
    push: Boolean(env.PUSH_QUEUE?.send),
    email: Boolean(env.RESEND_API_KEY),
    control_plane: await controlPlaneStatus(env),
  }

  if (env.DB?.prepare) {
    out.feedback_7d = await scalar(env, "SELECT COUNT(*) count FROM feedback WHERE created_at>=datetime('now','-7 days')")
    out.crashes_7d = await scalar(env, "SELECT COUNT(*) count FROM crash_reports WHERE created_at>=datetime('now','-7 days')")
    out.downloads_7d = await scalar(env, "SELECT COUNT(*) count FROM downloads WHERE created_at>=datetime('now','-7 days')")
    out.users = await scalar(env, 'SELECT COUNT(*) count FROM users')
    out.devices = await scalar(env, 'SELECT COUNT(*) count FROM devices')
    out.support_actions_7d = await scalar(env, "SELECT COUNT(*) count FROM ai_support_audit WHERE created_at>=datetime('now','-7 days')")
    try {
      out.latest_release = await env.DB.prepare(
        'SELECT tag,version,released_at FROM releases ORDER BY released_at DESC LIMIT 1',
      ).first()
    } catch {}
  }
  return out
}

async function recentFeedback(env) {
  if (!env.DB?.prepare) return []
  try {
    const { results = [] } = await env.DB.prepare(
      'SELECT id,category,sentiment,description,created_at FROM feedback ORDER BY created_at DESC LIMIT 20',
    ).all()
    return results.map((x) => ({ ...x, description: clean(x.description, 700) }))
  } catch {
    return []
  }
}

async function recentCrashes(env) {
  if (!env.DB?.prepare) return []
  try {
    const { results = [] } = await env.DB.prepare(
      "SELECT group_id,error_type,COUNT(*) count,MAX(created_at) latest FROM crash_reports WHERE created_at>=datetime('now','-14 days') GROUP BY group_id,error_type ORDER BY count DESC LIMIT 15",
    ).all()
    return results
  } catch {
    return []
  }
}

async function recentReleases(env) {
  if (!env.DB?.prepare) return []
  try {
    const { results = [] } = await env.DB.prepare(
      'SELECT tag,version,version_code,changelog,released_at FROM releases ORDER BY released_at DESC LIMIT 8',
    ).all()
    return results.map((x) => ({ ...x, changelog: clean(x.changelog, 1000) }))
  } catch {
    return []
  }
}

async function supportInbox(env, limit = 12) {
  const gmail = await gmailStatus(env)
  if (!gmail.connected) return []
  const rows = await listGmailMessages(env, 'to:support@petersmartlink.com in:inbox', Math.max(1, Math.min(limit, 20)))
  return rows.map((x) => ({
    id: x.id,
    from: clean(x.from, 300),
    subject: clean(x.subject, 300),
    created_at: x.date,
    provider: 'gmail',
  }))
}

async function supportAudit(env) {
  if (!env.DB?.prepare) return []
  try {
    const { results = [] } = await env.DB.prepare(
      'SELECT action,risk,subject,sender_email,created_at FROM ai_support_audit ORDER BY id DESC LIMIT 25',
    ).all()
    return results
  } catch {
    return []
  }
}

async function knowledgeSearch(env, query) {
  const text = clean(query, 1800)
  if (!text) return { available: true, chunks: [] }
  if (!env.AI_SEARCH?.search) {
    return { available: false, chunks: [], reason: 'AI Search binding unavailable' }
  }
  try {
    const result = await env.AI_SEARCH.search({
      messages: [{ role: 'user', content: text }],
      ai_search_options: {
        retrieval: { max_num_results: 5 },
      },
    })
    const chunks = Array.isArray(result?.chunks) ? result.chunks.slice(0, 5) : []
    return {
      available: true,
      chunks: chunks.map((chunk) => ({
        text: clean(chunk?.text ?? chunk?.content ?? chunk?.page_content, 2200),
        filename: clean(chunk?.filename ?? chunk?.metadata?.filename, 240),
        source: clean(chunk?.source ?? chunk?.metadata?.source ?? chunk?.metadata?.url, 500),
        score: Number.isFinite(Number(chunk?.score)) ? Number(chunk.score) : null,
      })).filter((chunk) => chunk.text),
    }
  } catch (error) {
    console.error('[ai-console] knowledge search failed:', error?.message)
    return { available: false, chunks: [], reason: 'OTYA knowledge search is temporarily unavailable' }
  }
}

async function operationalReport(env) {
  const [status, plugins, feedback, crashes, releases, support, audit] = await Promise.all([
    systemSnapshot(env),
    pluginRegistry(env),
    recentFeedback(env),
    recentCrashes(env),
    recentReleases(env),
    supportInbox(env, 10),
    supportAudit(env),
  ])
  return { status, plugins, feedback, crashes, releases, support, audit }
}

async function routeTool(env, message) {
  const tools = [
    'none',
    'system_status',
    'config_status',
    'plugins',
    'feedback_summary',
    'crash_summary',
    'release_summary',
    'support_inbox',
    'support_audit',
    'knowledge_search',
    'full_report',
  ]
  const prompt = `Choose at most one read-only OTYA admin tool that materially helps answer the user. Tools: ${tools.join(', ')}. Use knowledge_search when the owner asks how OTYA is designed, how a product feature should behave, what internal docs say, or needs indexed product/support/release knowledge. Use config_status for Firebase Remote Config, feature-config ownership or sync questions. Use full_report for requests like system report, daily/weekly report, what needs attention, overall health, summarize everything. Use support_inbox for requests about unread/recent support email. Use none for ordinary conversation, writing or planning. Return JSON only: {"tool":"name","reason":"brief"}.\nUser: ${clean(message, 1800)}`
  const routed = parse(await runAi(env, [
    { role: 'system', content: 'You are a conservative private admin tool router. Never choose a write action.' },
    { role: 'user', content: prompt },
  ])) || {}
  return tools.includes(routed.tool)
    ? routed
    : { tool: 'none', reason: 'No safe tool selected.' }
}

async function toolData(env, tool, message = '') {
  if (tool === 'plugins') return { plugins: await pluginRegistry(env) }
  if (tool === 'system_status') return { status: await systemSnapshot(env) }
  if (tool === 'config_status') return { control_plane: await controlPlaneStatus(env) }
  if (tool === 'feedback_summary') return { feedback: await recentFeedback(env) }
  if (tool === 'crash_summary') return { crashes: await recentCrashes(env) }
  if (tool === 'release_summary') return { releases: await recentReleases(env) }
  if (tool === 'support_inbox') return { emails: await supportInbox(env, 15) }
  if (tool === 'support_audit') return { audit: await supportAudit(env) }
  if (tool === 'knowledge_search') return { knowledge: await knowledgeSearch(env, message) }
  if (tool === 'full_report') return operationalReport(env)
  return null
}

const ownerType = 'admin'
const ownerKey = 'primary'

async function chat(env, body) {
  const message = clean(body?.message, 4000)
  if (!message) throw new Error('message is required')

  const conv = await getOrCreateConversation(env, {
    ownerType,
    ownerKey,
    conversationId: clean(body?.conversation_id, 80),
  })
  const existing = await readConversation(env, {
    ownerType,
    ownerKey,
    conversationId: conv.id,
    limit: 28,
  })
  const history = (existing?.messages || []).map((x) => ({
    role: x.role,
    content: clean(x.content, 4000),
  }))
  const route = await routeTool(env, message)
  const data = route.tool === 'none' ? null : await toolData(env, route.tool, message)
  const system = `${CONVERSATION_TONE} You are OTYA AI, the private administrator assistant for OTYA and PeterSmart Link. Work like an operator in a conversational interface: answer normal questions, inspect connected OTYA data and private OTYA knowledge when useful, and present reports directly in the conversation with priorities, counts, risks and recommended next actions. OTYA has one backend control plane. Firebase is a mobile-service provider behind Cloudflare: FCM handles push transport, Remote Config owns client experiment values with Cloudflare fallback, and Firebase identity is linked behind OTYA Auth. Cloudflare remains the safety-config, API, database, file and OTYA-session authority. Never ask for or expose Firebase service-account JSON, API credentials, Worker secrets, passwords, refresh tokens or OTPs. Do not force the admin to open a dashboard when supplied tool data can answer the question. Never pretend a plugin is connected when it is not. Read operations may happen automatically. Any external write action such as sending email, push notifications, publishing Remote Config, deployments, deletion, account changes or infrastructure mutation must require an explicit approval step before execution. If the admin asks for a write action, prepare the exact proposed action and clearly state that approval is required rather than claiming it happened. Use supplied tool data faithfully and mention when data is unavailable.`
  const context = data
    ? `\nRead-only tool used: ${route.tool}\nTool data:\n${JSON.stringify(data).slice(0, 22000)}`
    : ''

  await appendMessage(env, {
    conversationId: conv.id,
    role: 'user',
    content: message,
    channel: 'console',
  })
  const answer = await runAi(env, [
    { role: 'system', content: system },
    ...history,
    { role: 'user', content: `${message}${context}` },
  ])
  await appendMessage(env, {
    conversationId: conv.id,
    role: 'assistant',
    content: answer || 'I could not produce a response.',
    channel: 'console',
  })
  return {
    conversation_id: conv.id,
    answer: answer || 'I could not produce a response.',
    tool: route.tool === 'none' ? null : route.tool,
    tool_reason: route.reason,
    data,
  }
}

export async function handleConsoleAdmin(request, env) {
  if (!internalAuthorized(request, env)) return json({ error: 'Unauthorized' }, 401)
  const url = new URL(request.url)
  try {
    if (url.pathname.endsWith('/plugins') && request.method === 'GET') {
      return json({ ok: true, plugins: await pluginRegistry(env) })
    }
    if (url.pathname.endsWith('/status') && request.method === 'GET') {
      return json({ ok: true, status: await systemSnapshot(env) })
    }
    if (url.pathname.endsWith('/report') && request.method === 'GET') {
      return json({ ok: true, report: await operationalReport(env) })
    }
    if (url.pathname.endsWith('/conversations') && request.method === 'GET') {
      return json({ ok: true, conversations: await listConversations(env, { ownerType, ownerKey, limit: 40 }) })
    }
    if (url.pathname.endsWith('/conversation') && request.method === 'GET') {
      const id = url.searchParams.get('id')
      if (!id) return json({ error: 'id is required' }, 400)
      const conversation = await readConversation(env, {
        ownerType,
        ownerKey,
        conversationId: id,
        limit: 80,
      })
      return conversation
        ? json({ ok: true, conversation })
        : json({ error: 'Conversation not found' }, 404)
    }
    if (url.pathname.endsWith('/conversation/new') && request.method === 'POST') {
      return json({ ok: true, conversation: await newConversation(env, { ownerType, ownerKey }) }, 201)
    }
    if (url.pathname.endsWith('/conversation/archive') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      if (!body.id) return json({ error: 'id is required' }, 400)
      await archiveConversation(env, { ownerType, ownerKey, conversationId: body.id })
      return json({ ok: true })
    }
    if ((url.pathname.endsWith('/chat') || url.pathname.endsWith('/command')) && request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      return json({ ok: true, ...await chat(env, body) })
    }
    return json({ error: 'Not found' }, 404)
  } catch (error) {
    console.error('[ai-console]', error?.message)
    return json({ error: 'Console tool failed', detail: clean(error?.message, 400) }, 500)
  }
}
