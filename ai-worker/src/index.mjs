const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast'

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
})
const clean = (value, max = 3500) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
const aiText = (r) => typeof r?.response === 'string'
  ? r.response
  : (typeof r?.choices?.[0]?.message?.content === 'string' ? r.choices[0].message.content : '')
const parseJson = (text) => {
  try {
    const match = String(text).match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : null
  } catch {
    return null
  }
}

async function runAi(env, messages, model = DEFAULT_MODEL) {
  if (!env.AI?.run) throw new Error('AI binding unavailable')
  return clean(aiText(await env.AI.run(model, { messages })))
}

async function categorizeFeedback(msg, env) {
  const description = clean(msg.description, 1200)
  if (!msg.feedbackId || !description) return
  let sentiment = 'NEUTRAL'
  let category = 'complaint'
  try {
    const result = await env.AI.run('@cf/huggingface/distilbert-sst-2-int8', { text: description.slice(0, 512) })
    const top = Array.isArray(result) ? [...result].sort((a, b) => b.score - a.score)[0] : null
    if (top) sentiment = top.label === 'POSITIVE' ? 'POSITIVE' : 'NEGATIVE'
  } catch (error) {
    console.error('[ai] sentiment failed:', error?.message)
  }
  try {
    const output = parseJson(await runAi(env, [
      {
        role: 'system',
        content: 'Classify feedback as exactly one of bug, feature_request, complaint, praise, crash_report. Return JSON {"category":"value"} only.',
      },
      { role: 'user', content: description },
    ]))
    if (['bug', 'feature_request', 'complaint', 'praise', 'crash_report'].includes(output?.category)) {
      category = output.category
    }
  } catch (error) {
    console.error('[ai] category failed:', error?.message)
  }
  await env.DB.prepare(
    'UPDATE feedback SET category = ?, sentiment = ?, ai_processed = 1 WHERE id = ?',
  ).bind(category, sentiment, msg.feedbackId).run()
}

async function moderateFeedback(msg, env) {
  if (!msg.feedbackId || !msg.description) return
  let flagged = 0
  try {
    const output = parseJson(await runAi(env, [
      {
        role: 'system',
        content: 'Moderate user feedback for spam, threats, harassment, hate or unsafe content. Return JSON only: {"flagged":true|false}.',
      },
      { role: 'user', content: clean(msg.description, 1200) },
    ]))
    flagged = output?.flagged === true ? 1 : 0
  } catch (error) {
    console.error('[ai] moderation failed:', error?.message)
  }
  try {
    await env.DB.prepare('UPDATE feedback SET ai_flagged = ? WHERE id = ?')
      .bind(flagged, msg.feedbackId).run()
  } catch (error) {
    console.warn('[ai] ai_flagged column unavailable:', error?.message)
  }
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
  const text = clean(
    [msg.errorType, msg.description, msg.stackTrace].filter(Boolean).join('\n'),
    1400,
  )
  // A deterministic local fingerprint keeps identical crashes grouped even
  // when Vectorize is absent, delayed, or temporarily unavailable.
  let groupId = await deterministicCrashGroup(msg)
  if (env.VECTORIZE?.query && text) {
    try {
      const embedding = await env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [text] })
      const vector = embedding?.data?.[0]
      if (Array.isArray(vector)) {
        const match = (await env.VECTORIZE.query(vector, { topK: 3 }))?.matches?.[0]
        if (match?.score > 0.85) groupId = String(match.metadata?.groupId ?? match.id)
        await env.VECTORIZE.upsert([{
          id: String(msg.crashId),
          values: vector,
          metadata: { groupId, errorType: msg.errorType ?? 'unknown' },
        }])
      }
    } catch (error) {
      console.error('[ai] crash vector failed:', error?.message)
    }
  }
  await env.DB.prepare(
    'UPDATE crash_reports SET group_id = ?, ai_processed = 1 WHERE id = ?',
  ).bind(groupId, msg.crashId).run()
}

async function generateChangelog(msg, env) {
  if (!msg.tag) return
  const commits = Array.isArray(msg.commits) ? msg.commits.slice(0, 50) : []
  let changelog = commits.map(commit => `- ${clean(commit, 300)}`).join('\n') || '- No changes recorded.'
  try {
    const result = await runAi(env, [
      {
        role: 'system',
        content: 'Convert git commit messages into a concise user-facing Markdown changelog grouped under Bug Fixes, New Features and Improvements. Do not invent changes.',
      },
      { role: 'user', content: commits.join('\n') },
    ])
    if (result.length > 20) changelog = result
  } catch (error) {
    console.error('[ai] changelog failed:', error?.message)
  }
  await env.DB.prepare('UPDATE releases SET changelog = ? WHERE tag = ?')
    .bind(changelog, msg.tag).run()
}

async function analyzeAnomaly(_msg, env) {
  const { results = [] } = await env.DB.prepare(
    "SELECT strftime('%Y-%m-%d %H:00', created_at) hour, COUNT(*) count FROM downloads WHERE created_at >= datetime('now','-24 hours') GROUP BY hour ORDER BY hour",
  ).all()
  if (!results.length) return
  try {
    const output = parseJson(await runAi(env, [
      {
        role: 'system',
        content: 'Analyze hourly download counts for abnormal spikes or bot patterns. Return JSON only: {"anomaly":true|false,"reason":"brief"}.',
      },
      { role: 'user', content: results.map(row => `${row.hour}: ${row.count}`).join('\n') },
    ]))
    if (output?.anomaly) console.warn('[ai] download anomaly:', clean(output.reason, 500))
  } catch (error) {
    console.error('[ai] anomaly failed:', error?.message)
  }
}

async function smartReply(msg, env) {
  if (!msg.feedbackId || !msg.description) return
  const reply = await runAi(env, [
    {
      role: 'system',
      content: 'Draft a concise, empathetic Otya support reply. Never claim a fix or account action unless provided. Never request passwords or OTPs.',
    },
    { role: 'user', content: clean(msg.description, 1200) },
  ])
  try {
    await env.DB.prepare('UPDATE feedback SET ai_suggested_reply = ? WHERE id = ?')
      .bind(reply, msg.feedbackId).run()
  } catch (error) {
    console.warn('[ai] suggested reply column unavailable:', error?.message)
  }
}

async function predictChurn(msg, env) {
  if (!msg.userId) return
  const summary = clean(msg.summary || msg.signals || '', 1600)
  if (!summary) return
  const output = parseJson(await runAi(env, [
    {
      role: 'system',
      content: 'Estimate churn risk from supplied non-sensitive product usage signals. Return JSON only: {"risk":"low|medium|high","reason":"brief"}.',
    },
    { role: 'user', content: summary },
  ]))
  if (!output) return
  try {
    await env.KV.put(`ai:churn:${msg.userId}`, JSON.stringify({
      risk: output.risk,
      reason: clean(output.reason, 300),
      updated_at: new Date().toISOString(),
    }), { expirationTtl: 604800 })
  } catch (error) {
    console.error('[ai] churn store failed:', error?.message)
  }
}

async function handleAiMessage(msg, env) {
  switch (msg?.type) {
    case 'categorize_feedback': return categorizeFeedback(msg, env)
    case 'moderate_feedback': return moderateFeedback(msg, env)
    case 'process_crash': return processCrash(msg, env)
    case 'generate_changelog': return generateChangelog(msg, env)
    case 'analyze_anomaly': return analyzeAnomaly(msg, env)
    case 'generate_smart_reply': return smartReply(msg, env)
    case 'predict_churn': return predictChurn(msg, env)
    default:
      console.warn('[ai-queue] unknown message type:', msg?.type)
      return undefined
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'otya-ai', ai: Boolean(env.AI?.run) })
    }
    return json({ error: 'Not found' }, 404)
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await handleAiMessage(message.body, env)
        message.ack()
      } catch (error) {
        console.error('[ai-queue] failed:', error?.message ?? error)
        message.retry()
      }
    }
  },
}
