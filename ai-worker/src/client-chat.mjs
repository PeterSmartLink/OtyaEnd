import { CONVERSATION_TONE } from './conversation-tone.mjs'
import { appendMessage, getOrCreateConversation, hashIdentity, listConversations, newConversation, readConversation } from './conversations.mjs'
import { providerRequest } from './provider-request.mjs'

const TELEGRAM_API='https://api.telegram.org'
const FALLBACK_GUEST_MODEL='llama-fast'
const FALLBACK_SIGNED_DEFAULT='otya-smart'
const MODELS={
  'llama-fast':{name:'Otya Fast',provider:'Meta',model:'@cf/meta/llama-3.1-8b-instruct-fast',tier:'fast',description:'Fast answers for everyday questions.',costClass:'low'},
  'otya-smart':{name:'Otya Smart',provider:'Z.ai',model:'@cf/zai-org/glm-4.7-flash',tier:'balanced',description:'Balanced general assistant with strong multilingual ability.',costClass:'low'},
  'gemma-4':{name:'Gemma 4 26B',provider:'Google',model:'@cf/google/gemma-4-26b-a4b-it',tier:'balanced',description:'Modern multilingual general assistant.',costClass:'medium'},
  'granite':{name:'Granite 4 Micro',provider:'IBM',model:'@cf/ibm-granite/granite-4.0-h-micro',tier:'fast',description:'Compact fallback model for everyday questions.',costClass:'low'},
  'llama-70b':{name:'Llama 3.3 70B',provider:'Meta',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',tier:'large',description:'Large general-purpose model for detailed answers.',costClass:'high'},
  'gpt-oss-20b':{name:'GPT-OSS 20B',provider:'OpenAI',model:'@cf/openai/gpt-oss-20b',tier:'reasoning',description:'Reasoning model for harder questions.',costClass:'high'},
  'gpt-oss-120b':{name:'GPT-OSS 120B',provider:'OpenAI',model:'@cf/openai/gpt-oss-120b',tier:'reasoning',description:'Large reasoning model for complex questions.',costClass:'high'},
  'nemotron':{name:'Nemotron 120B',provider:'NVIDIA',model:'@cf/nvidia/nemotron-3-120b-a12b',tier:'large',description:'Strong reasoning and agentic model.',costClass:'high'},
  'llama-4-scout':{name:'Llama 4 Scout',provider:'Meta',model:'@cf/meta/llama-4-scout-17b-16e-instruct',tier:'balanced',description:'Modern general assistant model.',costClass:'medium'},
  'qwen3':{name:'Qwen3 30B',provider:'Qwen',model:'@cf/qwen/qwen3-30b-a3b-fp8',tier:'reasoning',description:'Multilingual reasoning and instruction following.',costClass:'high'},
  'sea-lion':{name:'SEA-LION 27B',provider:'AI Singapore',model:'@cf/aisingapore/gemma-sea-lion-v4-27b-it',tier:'balanced',description:'Regional multilingual model.',costClass:'medium'},
}

const clean=(v,max=5000)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max)
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
const aiText=r=>typeof r?.response==='string'?r.response:(typeof r?.choices?.[0]?.message?.content==='string'?r.choices[0].message.content:'')
const parseIds=v=>String(v??'').split(',').map(x=>clean(x,60)).filter(Boolean)
const trustedStoreRequest=(request,env)=>Boolean(env.INTERNAL_SECRET)&&request.headers.get('X-OTYA-Internal-Secret')===env.INTERNAL_SECRET

function configuredPolicy(env){
  const configured=parseIds(env.AI_PUBLIC_MODELS)
  const allowed=configured.length?configured.filter(id=>MODELS[id]):['llama-fast','otya-smart','gemma-4','granite']
  const safeAllowed=allowed.length?allowed:['llama-fast','otya-smart','granite']
  const requestedGuest=clean(env.AI_GUEST_MODEL,60)
  const requestedDefault=clean(env.AI_DEFAULT_MODEL,60)
  const guest=safeAllowed.includes(requestedGuest)?requestedGuest:(safeAllowed.includes(FALLBACK_GUEST_MODEL)?FALLBACK_GUEST_MODEL:safeAllowed[0])
  const signedDefault=safeAllowed.includes(requestedDefault)?requestedDefault:(safeAllowed.includes(FALLBACK_SIGNED_DEFAULT)?FALLBACK_SIGNED_DEFAULT:guest)
  return{allowed:safeAllowed,guest,signedDefault}
}
function publicModels(env){
  const policy=configuredPolicy(env)
  return policy.allowed.map(id=>({id,name:MODELS[id].name,provider:MODELS[id].provider,tier:MODELS[id].tier,description:MODELS[id].description,guest:id===policy.guest,cost_class:MODELS[id].costClass,availability:'managed'}))
}
function resolveModel(env,requested,signedIn){
  const policy=configuredPolicy(env)
  if(!signedIn){const id=policy.guest;return{id,...MODELS[id]}}
  const id=policy.allowed.includes(requested)?requested:policy.signedDefault
  return{id,...MODELS[id]}
}
function fallbackSelections(env,selection){
  const policy=configuredPolicy(env)
  const ids=[selection.id,policy.signedDefault,policy.guest,'granite','llama-fast'].filter((id,index,all)=>MODELS[id]&&policy.allowed.includes(id)&&all.indexOf(id)===index)
  return ids.map(id=>({id,...MODELS[id]}))
}
async function runAi(env,messages,selection){
  if(!env.AI?.run)throw new Error('AI unavailable')
  let lastError=null
  for(const candidate of fallbackSelections(env,selection)){
    try{
      const answer=clean(aiText(await env.AI.run(candidate.model,{messages})),9000)
      if(answer)return{answer,selection:candidate,fallback:candidate.id!==selection.id}
      lastError=new Error(`Empty response from ${candidate.id}`)
    }catch(e){
      lastError=e
      console.warn('[public-ai-model-fallback]',candidate.id,e?.message)
    }
  }
  throw lastError||new Error('AI unavailable')
}

async function publicOtyaContext(env){
  const base=(env.WEBSITE_URL||'https://petersmartlink.com').replace(/\/$/,'')
  const facts=[
    'Otya is an offline-first Android music and video player by PeterSmart Link.',
    'Otya has three permanent top-level destinations: Video, Music and Me. Advanced utilities should appear contextually or under organized Tools/Settings rather than as duplicate top-level screens.',
    'Next is the friendly general assistant inside Otya. It can answer ordinary questions and has extra Otya product context when needed.',
    `Official website: ${base}.`,
    `Official Next page: ${base}/ask.`,
    `Official download page: ${base}/download/otya-player.`,
    `Official support page: ${base}/apps/otya-player/support.`,
    `Official Telegram: ${env.TELEGRAM_CHANNEL_URL||'https://t.me/otyaplayer'}.`,
    'Local playback, media scanning, local search and supported local transfer must keep working without signing in, Firebase or AI.',
    'Otya Music is local-first: songs, albums, artists, folders and playlists come from media already on the Android device.',
    'The built-in Online Music and Jamendo provider integration has been retired. Do not direct users to a Jamendo catalog, provider login, provider download action or Online Music screen.',
    'Global Otya search must not contact a music-provider catalog while the user types. It searches local media/groups/playlists and can offer Otya help; Next is optional when the user explicitly asks.',
    'If Cloudflare, Firebase or Next is unavailable, that must not make local music/video playback or local Search look broken.',
    'New audio and video received or downloaded on the phone should appear in the normal Music or Video library after scanning.',
  ]
  try{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),3500)
    const r=await fetch(`${base}/latest`,{headers:{Accept:'application/json'},signal:controller.signal})
    clearTimeout(timeout)
    if(r.ok){
      const v=await r.json().catch(()=>null)
      if(v&&typeof v==='object'){
        const version=clean(v.version,80),code=Number(v.versionCode||0),date=clean(v.date,80),changelog=clean(v.changelog,700)
        if(version)facts.push(`Current public Otya release: version ${version}${code?` (build ${code})`:''}${date?`, release date ${date}`:''}.`)
        if(changelog)facts.push(`Current release notes: ${changelog}`)
      }
    }
  }catch(e){console.warn('[ai-live-context]',e?.message)}
  return facts.join('\n')
}

async function system(env){
  const live=await publicOtyaContext(env)
  return `${CONVERSATION_TONE} You are Next, a friendly general-purpose AI assistant built into Otya.

GENERAL BEHAVIOR: Answer the user's question directly, whether it is about Otya or a general topic. Be conversational, useful and concise by default. Explain more when the question needs it. Do not pretend you have live web access, current news, private account access, device access, or external tools unless the backend has explicitly supplied that information in the conversation or live context. For time-sensitive facts you cannot verify, say that they may have changed instead of inventing an answer.

OTYA EXPERTISE: When the request concerns Otya, music/video playback, media library, files, Transfer, Converter, Private/vault, Tools, personalization/themes, storage, permissions, updates, downloads, account, security, backup, website, support, or release information, use the live Otya facts below and give product-specific guidance. Preserve Otya's offline-first hierarchy: local media and local Search are primary; Next and account/cloud services are optional enhancements. Online Music/Jamendo is retired and must not be presented as a current Otya feature. Never invent an Otya feature or claim an Otya/device/provider/account action happened unless the backend confirms it.

HUMAN SUPPORT: Use the exact prefix [HANDOFF] on the first line only when the user explicitly asks for a human/support agent, or when an Otya account/support problem genuinely requires a human to continue. Do not use [HANDOFF] merely because a question is unrelated to Otya. Do not claim support has been notified until the backend confirms a handoff request.

SAFETY & PRIVACY: Never request or expose passwords, OTPs, JWTs, API keys, private keys, payment credentials, provider refresh tokens, or admin-only data. Public Next cannot see the private Admin Assistant, admin email, GitHub, Cloudflare, private customer lists, or private support data. Refuse unsafe requests when necessary and offer a safer direction when useful.

LIVE OTYA CONTEXT:\n${live}`
}

async function rate(env,key,limit=45,seconds=60){
  if(!env.KV)return true
  const bucket=Math.floor(Date.now()/(seconds*1000)),k=`ai:client-rate:${key}:${bucket}`,n=Number(await env.KV.get(k)||0)
  if(n>=limit)return false
  await env.KV.put(k,String(n+1),{expirationTtl:seconds*2})
  return true
}
async function modelRate(env,key,selection){return rate(env,`${key}:model:${selection.id}`,['large','reasoning'].includes(selection.tier)?18:45,60)}
const unlimitedStatus=()=>({unlimited:true,limit:null,used:null,remaining:null})

function historyFrom(value){
  if(!Array.isArray(value))return[]
  return value.slice(-20).map(x=>({role:x?.role==='assistant'?'assistant':'user',content:clean(x?.content,3500)})).filter(x=>x.content)
}
function handoffResult(answer){
  const text=clean(answer,9000)
  if(!text.startsWith('[HANDOFF]'))return{answer:text,handoff_available:false}
  return{answer:clean(text.replace(/^\[HANDOFF\]\s*/,'').trim(),9000),handoff_available:true,handoff_label:'Talk to PeterSmart Link support'}
}

async function persistentReply(env,{userId,message,channel,conversationId,selection,forceNew=false}){
  const ownerKey=await hashIdentity(env,`user:${userId}`)
  const conv=forceNew?await newConversation(env,{ownerType:'client',ownerKey,title:message.slice(0,80)}):await getOrCreateConversation(env,{ownerType:'client',ownerKey,conversationId})
  const previous=await readConversation(env,{ownerType:'client',ownerKey,conversationId:conv.id,limit:22})
  const history=(previous?.messages||[]).map(x=>({role:x.role,content:clean(x.content,3500)}))
  await appendMessage(env,{conversationId:conv.id,role:'user',content:message,channel})
  const generated=await runAi(env,[{role:'system',content:await system(env)},...history,{role:'user',content:clean(message,3000)}],selection)
  const result=handoffResult(generated.answer)
  await appendMessage(env,{conversationId:conv.id,role:'assistant',content:result.answer,channel})
  return{conversation_id:conv.id,...result,persisted:true,model:generated.selection.id,model_name:generated.selection.name,model_fallback:generated.fallback}
}
async function temporaryReply(env,{message,history=[],selection}){
  const generated=await runAi(env,[{role:'system',content:await system(env)},...historyFrom(history),{role:'user',content:clean(message,3000)}],selection)
  return{...handoffResult(generated.answer),persisted:false,model:generated.selection.id,model_name:generated.selection.name,model_fallback:generated.fallback}
}

async function sendAdminHandoff(env,{message,email,name,source,userId}){
  if(!env.RESEND_API_KEY)throw new Error('Support email is unavailable')
  const ticket=`OTYA-${Date.now().toString(36).toUpperCase()}`
  const admin=env.ADMIN_REPORT_EMAIL||'petersmartlink@gmail.com'
  const lines=[
    `New Otya support handoff: ${ticket}`,
    '',
    `Source: ${clean(source,80)||'Otya'}`,
    `User: ${clean(name,120)||'Not provided'}`,
    `Email: ${clean(email,180)||'Not provided'}`,
    `Account ID: ${clean(userId,120)||'Guest'}`,
    '',
    'Question:',
    clean(message,3000),
    '',
    'Open the private Otya Admin console to review support and reply through the approved support tools.',
  ]
  const r=await providerRequest('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from:'Otya Support <noreply@petersmartlink.com>',
      to:[admin],
      reply_to:clean(email,180)||'support@petersmartlink.com',
      subject:`Otya support handoff · ${ticket}`,
      text:lines.join('\n'),
    }),
  })
  if(!r.ok)throw new Error(`Support email failed (${r.status})`)
  return ticket
}

async function telegram(env,method,body){
  if(!env.TELEGRAM_BOT_TOKEN)throw new Error('Telegram unavailable')
  const r=await providerRequest(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  if(!r.ok)throw new Error('Telegram send failed')
}

export async function handleSharedTelegram(request,env){
  const url=new URL(request.url)
  if(!url.pathname.endsWith('/webhook'))return null
  if(request.method!=='POST')return json({error:'Method not allowed'},405)
  if(!env.TELEGRAM_WEBHOOK_SECRET)return json({error:'Telegram webhook unavailable'},503)
  if((request.headers.get('X-Telegram-Bot-Api-Secret-Token')||'')!==env.TELEGRAM_WEBHOOK_SECRET)return json({error:'Unauthorized'},401)
  const update=await request.json().catch(()=>null),m=update?.message,chatId=m?.chat?.id,sender=m?.from?.id??chatId,text=clean(m?.text,3000)
  if(!chatId||m?.chat?.type!=='private'||!text)return json({ok:true})
  const key=await hashIdentity(env,`telegram:${sender}`)
  if(!(await rate(env,key,45,60))){await telegram(env,'sendMessage',{chat_id:chatId,text:'Too many messages at once. Please wait a moment.'});return json({ok:true,rate_limited:true})}
  const selection=resolveModel(env,null,false)
  let answer
  if(text==='/start')answer='Welcome to Next by Otya. Ask me a general question or ask about Otya playback, local music, files, Transfer, account, updates and troubleshooting.'
  else if(text==='/download')answer=`Official Otya download: ${(env.WEBSITE_URL||'https://petersmartlink.com').replace(/\/$/,'')}/download/otya-player`
  else if(text==='/privacy')answer='Never send passwords, OTPs, payment details or secret keys here.'
  else{
    try{
      const result=await temporaryReply(env,{message:text,selection})
      answer=result.handoff_available?`${result.answer}\n\nFor human Otya help, use the official support page: ${(env.WEBSITE_URL||'https://petersmartlink.com').replace(/\/$/,'')}/apps/otya-player/support`:result.answer
    }catch(e){console.error('[telegram-shared]',e?.message);answer='Next is unavailable right now. Please try again shortly.'}
  }
  await telegram(env,'sendMessage',{chat_id:chatId,text:clean(answer,3500),disable_web_page_preview:true})
  return json({ok:true})
}

export async function handlePublicChat(request,env){
  const url=new URL(request.url)
  const trusted=trustedStoreRequest(request,env)
  const userId=trusted?clean(request.headers.get('X-OTYA-User-ID'),120):''
  const signedIn=trusted&&request.headers.get('X-OTYA-Persist-Chat')==='1'&&Boolean(userId)
  const ownerKey=signedIn?await hashIdentity(env,`user:${userId}`):null
  const policy=configuredPolicy(env)

  if(request.method==='GET'){
    if(url.searchParams.get('quota')==='1')return json({ok:true,signed_in:signedIn,quota:unlimitedStatus()})
    if(url.searchParams.get('models')==='1'){
      const models=publicModels(env)
      return json({ok:true,signed_in:signedIn,guest_model:policy.guest,default_model:policy.signedDefault,models:signedIn?models:models.filter(m=>m.id===policy.guest),quota:unlimitedStatus(),catalog:'managed'})
    }
    if(!signedIn)return json({error:'Sign in to load saved conversations'},401)
    if(url.searchParams.get('list')==='1')return json({ok:true,conversations:await listConversations(env,{ownerType:'client',ownerKey,limit:40})})
    const id=clean(url.searchParams.get('conversation_id'),80)
    if(!id)return json({error:'conversation_id is required'},400)
    const conversation=await readConversation(env,{ownerType:'client',ownerKey,conversationId:id,limit:100})
    return conversation?json({ok:true,conversation,persisted:true}):json({error:'Conversation not found'},404)
  }

  if(request.method!=='POST')return json({error:'Method not allowed'},405)
  const body=await request.json().catch(()=>({}))
  const message=clean(body.message,3000)
  if(!message)return json({error:'message is required'},400)

  if(body.request_handoff===true){
    try{
      const ticket=await sendAdminHandoff(env,{message,email:body.contact_email,name:body.contact_name,source:body.surface||body.channel||'web',userId})
      return json({ok:true,handoff_sent:true,ticket,message:'PeterSmart Link support has been notified.'})
    }catch(e){
      console.error('[support-handoff]',e?.message)
      return json({error:'Could not notify support right now. Please use support@petersmartlink.com.',code:'HANDOFF_FAILED'},503)
    }
  }

  const guest=clean(body.guest_id,120),ip=request.headers.get('CF-Connecting-IP')||'unknown'
  const rateIdentity=signedIn?`user:${userId}`:`guest:${guest||ip}`
  const rateKey=await hashIdentity(env,`${rateIdentity}:${ip}`)
  if(!(await rate(env,rateKey,signedIn?60:45,60)))return json({error:'Too many messages at once. Please wait a moment.',code:'AI_RATE_LIMIT'},429)

  const selection=resolveModel(env,clean(body.model,60),signedIn)
  if(!(await modelRate(env,rateKey,selection)))return json({error:'This model is receiving too many requests at once. Please wait a moment.',code:'AI_RATE_LIMIT'},429)

  try{
    const result=signedIn
      ?await persistentReply(env,{userId,message,channel:clean(body.channel,20)||'web',conversationId:clean(body.conversation_id,80),selection,forceNew:body.new_chat===true})
      :await temporaryReply(env,{message,history:body.history,selection})
    return json({ok:true,...result,scope:'general',quota:unlimitedStatus()})
  }catch(e){
    console.error('[public-ai]',selection.id,e?.message)
    return json({error:'Next is unavailable right now. Please try again shortly.'},503)
  }
}
