import { CONVERSATION_TONE } from './conversation-tone.mjs'
const TELEGRAM_API = 'https://api.telegram.org'
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast'
const TELEGRAM_RATE_LIMIT = 20
const TELEGRAM_RATE_WINDOW_SECS = 60

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
const clean = (value, max = 3500) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
const aiText = (r) => typeof r?.response === 'string' ? r.response : (typeof r?.choices?.[0]?.message?.content === 'string' ? r.choices[0].message.content : '')
const parseJson = (text) => { try { const m = String(text).match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null } catch { return null } }

async function runAi(env, messages, model = DEFAULT_MODEL) {
  if (!env.AI?.run) throw new Error('AI binding unavailable')
  return clean(aiText(await env.AI.run(model, { messages })))
}

async function telegram(env, method, body) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const res = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.ok === false) throw new Error(`Telegram ${method} failed`)
  return data
}

async function telegramRateAllowed(env, identity) {
  if (!env.KV || identity == null) return true
  const bucket = Math.floor(Date.now() / (TELEGRAM_RATE_WINDOW_SECS * 1000))
  const key = `telegram:rate:${identity}:${bucket}`
  const current = Number.parseInt((await env.KV.get(key)) || '0', 10) || 0
  if (current >= TELEGRAM_RATE_LIMIT) return false
  await env.KV.put(key, String(current + 1), { expirationTtl: TELEGRAM_RATE_WINDOW_SECS * 2 })
  return true
}

async function answerSupport(env, text) {
  const system = `${CONVERSATION_TONE} You are OTYA Support, the official AI assistant for OTYA Player. Help with playback, downloads, account access, verification, updates, privacy, Terms and troubleshooting. Be concise and accurate. Never request or reveal passwords, OTPs, JWTs, API keys, bot tokens, secrets, payment credentials or private backend configuration. Never claim an account action happened unless an approved backend action confirms it. Account-specific or destructive actions require verified identity. Do not invent outages, account state, releases or policy facts. Official channel: ${env.TELEGRAM_CHANNEL_URL || 'https://t.me/otyaplayer'}. Human support: support@petersmartlink.com.`
  return await runAi(env, [{ role: 'system', content: system }, { role: 'user', content: clean(text, 2000) }], env.OTYA_AI_MODEL || DEFAULT_MODEL)
}

async function handleTelegram(request, env) {
  const url = new URL(request.url)
  if (url.pathname.endsWith('/status') && request.method === 'GET') {
    return json({ ok: true, service: 'otya-ai', bot: '@OtyaPlayerBot', channel: env.TELEGRAM_CHANNEL_URL || 'https://t.me/otyaplayer', ai: Boolean(env.AI?.run) })
  }
  if (!url.pathname.endsWith('/webhook')) return json({ error: 'Not found' }, 404)
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!env.TELEGRAM_WEBHOOK_SECRET) return json({ error: 'Telegram webhook is not configured' }, 503)
  if ((request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '') !== env.TELEGRAM_WEBHOOK_SECRET) return json({ error: 'Unauthorized' }, 401)

  let update
  try { update = await request.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const message = update?.message
  const chatId = message?.chat?.id
  const chatType = message?.chat?.type
  const senderId = message?.from?.id ?? chatId
  const text = clean(message?.text, 2000)

  // OTYA's public Telegram channel is only an entry point. Support and AI
  // conversations are intentionally private so groups/channels cannot consume
  // AI quota or expose user support questions to other people.
  if (!chatId || chatType !== 'private' || !text) return json({ ok: true })

  if (!(await telegramRateAllowed(env, senderId))) {
    await telegram(env, 'sendMessage', {
      chat_id: chatId,
      text: 'Please give me a moment to catch up, then try again.',
      disable_web_page_preview: true,
    })
    return json({ ok: true, rate_limited: true })
  }

  let reply
  if (text === '/start') reply = 'Welcome to OTYA Support. Ask me about OTYA Player, playback, accounts, updates, privacy or troubleshooting. Never send passwords or verification codes here.'
  else if (text === '/help') reply = 'OTYA Support can help with playback, downloads, account access, email verification, updates, privacy and troubleshooting. Commands: /download, /channel, /privacy. For account-specific help contact support@petersmartlink.com.'
  else if (text === '/download') reply = 'Download OTYA Player from the official page: https://petersmartlink.com/download/otya-player'
  else if (text === '/privacy') reply = 'Never send passwords, OTPs or secret keys to this bot. For account-specific requests use the OTYA app or support@petersmartlink.com.'
  else if (text === '/channel') reply = `Official OTYA channel: ${env.TELEGRAM_CHANNEL_URL || 'https://t.me/otyaplayer'}`
  else {
    try { reply = await answerSupport(env, text) }
    catch (e) {
      console.error('[telegram] AI failed:', e?.message)
      reply = 'I cannot answer that reliably right now. Please contact support@petersmartlink.com.'
    }
  }

  await telegram(env, 'sendMessage', { chat_id: chatId, text: clean(reply) || 'Please contact support@petersmartlink.com.', disable_web_page_preview: true })
  return json({ ok: true })
}

async function categorizeFeedback(msg, env) {
  const description = clean(msg.description, 1200)
  if (!msg.feedbackId || !description) return
  let sentiment = 'NEUTRAL', category = 'complaint'
  try {
    const r = await env.AI.run('@cf/huggingface/distilbert-sst-2-int8', { text: description.slice(0, 512) })
    const top = Array.isArray(r) ? [...r].sort((a,b) => b.score-a.score)[0] : null
    if (top) sentiment = top.label === 'POSITIVE' ? 'POSITIVE' : 'NEGATIVE'
  } catch (e) { console.error('[ai] sentiment failed:', e?.message) }
  try {
    const out = parseJson(await runAi(env, [{ role:'system', content:'Classify feedback as exactly one of bug, feature_request, complaint, praise, crash_report. Return JSON {"category":"value"} only.' }, { role:'user', content:description }]))
    if (['bug','feature_request','complaint','praise','crash_report'].includes(out?.category)) category = out.category
  } catch (e) { console.error('[ai] category failed:', e?.message) }
  await env.DB.prepare('UPDATE feedback SET category = ?, sentiment = ?, ai_processed = 1 WHERE id = ?').bind(category, sentiment, msg.feedbackId).run()
}

async function moderateFeedback(msg, env) {
  if (!msg.feedbackId || !msg.description) return
  let flagged = 0
  try {
    const out = parseJson(await runAi(env, [{ role:'system', content:'Moderate user feedback for spam, threats, harassment, hate or unsafe content. Return JSON only: {"flagged":true|false}.' }, { role:'user', content:clean(msg.description,1200) }]))
    flagged = out?.flagged === true ? 1 : 0
  } catch (e) { console.error('[ai] moderation failed:', e?.message) }
  try { await env.DB.prepare('UPDATE feedback SET ai_flagged = ? WHERE id = ?').bind(flagged, msg.feedbackId).run() } catch (e) { console.warn('[ai] ai_flagged column unavailable:', e?.message) }
}

function canonicalCrashText(msg) {
  return [msg.errorType, msg.description, msg.stackTrace]
    .filter(Boolean)
    .map(value => clean(value, 4000).toLowerCase())
    .join('\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '<uuid>')
    .replace(/0x[0-9a-f]+/gi, '0x<address>')
    .replace(/:\d+:\d+/g, ':<line>:<column>')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

async function deterministicCrashGroup(msg) {
  const canonical = canonicalCrashText(msg) || 'unknown-crash'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return `crash-${hex.slice(0, 32)}`
}

async function processCrash(msg, env) {
  if (!msg.crashId) return
  const text = clean([msg.errorType,msg.description,msg.stackTrace].filter(Boolean).join('\n'), 1400)
  // A deterministic local fingerprint keeps identical crashes grouped even
  // when Vectorize is absent, delayed, or temporarily unavailable.
  let groupId = await deterministicCrashGroup(msg)
  if (env.VECTORIZE?.query && text) {
    try {
      const embedding = await env.AI.run('@cf/baai/bge-small-en-v1.5', { text:[text] })
      const vector = embedding?.data?.[0]
      if (Array.isArray(vector)) {
        const match = (await env.VECTORIZE.query(vector,{topK:3}))?.matches?.[0]
        if (match?.score > 0.85) groupId = String(match.metadata?.groupId ?? match.id)
        await env.VECTORIZE.upsert([{id:String(msg.crashId),values:vector,metadata:{groupId,errorType:msg.errorType??'unknown'}}])
      }
    } catch (e) { console.error('[ai] crash vector failed:', e?.message) }
  }
  await env.DB.prepare('UPDATE crash_reports SET group_id = ?, ai_processed = 1 WHERE id = ?').bind(groupId,msg.crashId).run()
}

async function generateChangelog(msg, env) {
  if (!msg.tag) return
  const commits = Array.isArray(msg.commits) ? msg.commits.slice(0,50) : []
  let changelog = commits.map(c=>`- ${clean(c,300)}`).join('\n') || '- No changes recorded.'
  try { const r = await runAi(env,[{role:'system',content:'Convert git commit messages into a concise user-facing Markdown changelog grouped under Bug Fixes, New Features and Improvements. Do not invent changes.'},{role:'user',content:commits.join('\n')}]); if(r.length>20) changelog=r } catch(e){ console.error('[ai] changelog failed:',e?.message) }
  await env.DB.prepare('UPDATE releases SET changelog = ? WHERE tag = ?').bind(changelog,msg.tag).run()
}

async function analyzeAnomaly(msg, env) {
  const { results=[] } = await env.DB.prepare("SELECT strftime('%Y-%m-%d %H:00', created_at) hour, COUNT(*) count FROM downloads WHERE created_at >= datetime('now','-24 hours') GROUP BY hour ORDER BY hour").all()
  if (!results.length) return
  try { const out=parseJson(await runAi(env,[{role:'system',content:'Analyze hourly download counts for abnormal spikes or bot patterns. Return JSON only: {"anomaly":true|false,"reason":"brief"}.'},{role:'user',content:results.map(x=>`${x.hour}: ${x.count}`).join('\n')} ])); if(out?.anomaly) console.warn('[ai] download anomaly:',clean(out.reason,500)) } catch(e){ console.error('[ai] anomaly failed:',e?.message) }
}

async function smartReply(msg, env) {
  if (!msg.feedbackId || !msg.description) return
  const reply = await runAi(env,[{role:'system',content:'Draft a concise, empathetic OTYA support reply. Never claim a fix or account action unless provided. Never request passwords or OTPs.'},{role:'user',content:clean(msg.description,1200)}])
  try { await env.DB.prepare('UPDATE feedback SET ai_suggested_reply = ? WHERE id = ?').bind(reply,msg.feedbackId).run() } catch(e){ console.warn('[ai] suggested reply column unavailable:',e?.message) }
}

async function predictChurn(msg, env) {
  if (!msg.userId) return
  const summary = clean(msg.summary || msg.signals || '', 1600)
  if (!summary) return
  const out=parseJson(await runAi(env,[{role:'system',content:'Estimate churn risk from supplied non-sensitive product usage signals. Return JSON only: {"risk":"low|medium|high","reason":"brief"}.'},{role:'user',content:summary}]))
  if(out) try { await env.KV.put(`ai:churn:${msg.userId}`,JSON.stringify({risk:out.risk,reason:clean(out.reason,300),updated_at:new Date().toISOString()}),{expirationTtl:604800}) } catch(e){ console.error('[ai] churn store failed:',e?.message) }
}

async function sendUpdateNotification(msg, env) {
  if (!env.PUSH_QUEUE?.send) return
  await env.PUSH_QUEUE.send({ title:`OTYA Player ${clean(msg.version,40)||'update'} is available`, body:clean(msg.changelog,220)||'A new version of OTYA Player is ready to download.', url:'https://petersmartlink.com/download/otya-player', ...(msg.deviceId?{deviceId:msg.deviceId}:{}) })
}

async function handleAiMessage(msg, env) {
  switch(msg?.type){
    case 'categorize_feedback': return categorizeFeedback(msg,env)
    case 'moderate_feedback': return moderateFeedback(msg,env)
    case 'process_crash': return processCrash(msg,env)
    case 'generate_changelog': return generateChangelog(msg,env)
    case 'analyze_anomaly': return analyzeAnomaly(msg,env)
    case 'generate_smart_reply': return smartReply(msg,env)
    case 'predict_churn': return predictChurn(msg,env)
    case 'send_update_notification': return sendUpdateNotification(msg,env)
    default: console.warn('[ai-queue] unknown message type:',msg?.type)
  }
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url)
    if(url.pathname==='/' || url.pathname==='/health') return json({ok:true,service:'otya-ai',ai:Boolean(env.AI?.run)})
    if(url.pathname.startsWith('/api/telegram/')) return handleTelegram(request,env)
    return json({error:'Not found'},404)
  },
  async queue(batch,env){ for(const message of batch.messages){ try{ await handleAiMessage(message.body,env); message.ack() }catch(e){ console.error('[ai-queue] failed:',e?.message??e); message.retry() } } }
}
