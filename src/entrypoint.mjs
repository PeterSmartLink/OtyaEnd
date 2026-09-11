import worker from './queue-worker.mjs'
import { recordRuntimeOperationalEvent } from './lib/operational-events.mjs'
export { OtyaReleaseWorkflow } from './release-workflow.mjs'

const HEALTH_CHECK_CRON = '*/5 * * * *'
const HEALTH_INCIDENT_KEY = 'monitor:health:incident:v2'
const HEALTH_PATHS = ['/', '/download/otya-player', '/api/version', '/latest']
const OTYA_NOREPLY_EMAIL = 'noreply@petersmartlink.com'
const ACCESS_COOKIE = '__Secure-otya_access'
const ADMIN_COOKIE = 'otya_admin_session'
const UPSTREAM_TIMEOUT_MS = 8000
const SERVICE_HEALTH_TIMEOUT_MS = 5000

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
function cookieValue(request,name){const cookie=request.headers.get('cookie')||'';return cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1)||''}
function timingSafeEqual(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
function b64url(bytes){let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
function fromB64url(value){const base64=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');return Uint8Array.from(atob(base64),c=>c.charCodeAt(0))}
async function sign(value,secret){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));return b64url(new Uint8Array(mac))}

async function authenticateUser(request,env){
  const bearer=request.headers.get('Authorization')||''
  const cookieToken=cookieValue(request,ACCESS_COOKIE)
  const authorization=bearer.startsWith('Bearer ')?bearer:(cookieToken?`Bearer ${cookieToken}`:'')
  if(!authorization||!env.AUTH?.fetch)return null
  try{
    const verifyUrl=new URL('/auth/verify',request.url)
    const verifyRequest=new Request(verifyUrl,{method:'GET',headers:{Authorization:authorization}})
    const response=await env.AUTH.fetch(verifyRequest)
    const data=await response.json().catch(()=>({}))
    if(!response.ok||data?.ok!==true||!data?.user_id||!data?.email)return null
    return {id:String(data.user_id),email:String(data.email).toLowerCase()}
  }catch{return null}
}

function adminEmails(env){
  return new Set(String(env.ADMIN_EMAILS||env.ADMIN_REPORT_EMAIL||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))
}
function isAdminUser(user,env){return Boolean(user?.email)&&adminEmails(env).has(user.email.toLowerCase())}
async function hasElevatedAdminSession(request,env){
  const secret=String(env.ADMIN_SESSION_SECRET||'').trim()
  const raw=cookieValue(request,ADMIN_COOKIE)
  if(!secret||!raw)return false
  const [encoded,signature]=raw.split('.')
  if(!encoded||!signature)return false
  const expected=await sign(encoded,secret)
  if(!timingSafeEqual(signature,expected))return false
  try{
    const payload=JSON.parse(new TextDecoder().decode(fromB64url(encoded)))
    const email=typeof payload?.email==='string'?payload.email.toLowerCase():''
    return Boolean(email)
      && adminEmails(env).has(email)
      && payload?.mfa===true
      && typeof payload?.exp==='number'
      && payload.exp>Math.floor(Date.now()/1000)
  }catch{return false}
}

function createResendEmailAdapter(env){return{async send(message){if(!env.RESEND_API_KEY)throw new Error('RESEND_API_KEY is not configured');const to=Array.isArray(message?.to)?message.to.map(r=>r.email).filter(Boolean):[];if(!to.length)throw new Error('Invalid email envelope');const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:`OTYA <${OTYA_NOREPLY_EMAIL}>`,to,subject:message.subject,text:message.text}),signal:AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)});const data=await response.json().catch(()=>({}));if(!response.ok||!data.id)throw new Error(`Resend email failed: ${data.message??data.name??`HTTP ${response.status}`}`)}}}
function withProductionAdapters(env){return{...env,EMAIL:createResendEmailAdapter(env)}}
function analyticsPath(pathname){if(pathname.startsWith('/auth/'))return'/auth/*';if(pathname.startsWith('/apk/'))return'/apk/*';if(pathname.startsWith('/api/admin/'))return'/api/admin/*';if(pathname.startsWith('/api/telegram/'))return'/api/telegram/*';if(pathname.startsWith('/api/ai/'))return'/api/ai/*';if(pathname.startsWith('/api/'))return'/api/*';return pathname==='/'?'/':'/other'}
function writeRequestAnalytics(env,request,response,startedAt){if(!env.OTYA_ANALYTICS?.writeDataPoint)return;try{const url=new URL(request.url);env.OTYA_ANALYTICS.writeDataPoint({blobs:['request',request.method,analyticsPath(url.pathname),request.cf?.colo??'unknown'],doubles:[response.status,Date.now()-startedAt],indexes:[analyticsPath(url.pathname)]})}catch{}}
async function readHealthIncident(env){try{return await env.KV?.get?.(HEALTH_INCIDENT_KEY)??null}catch{return null}}
async function writeHealthIncident(env,value){try{await env.KV?.put?.(HEALTH_INCIDENT_KEY,value,{expirationTtl:86400})}catch{}}
async function clearHealthIncident(env){try{await env.KV?.delete?.(HEALTH_INCIDENT_KEY)}catch{}}
async function sendHealthEmail(env,subject,text){try{await env.EMAIL.send({from:{email:OTYA_NOREPLY_EMAIL,name:'OTYA Backend'},to:[{email:env.ADMIN_REPORT_EMAIL||'petersmartlink@gmail.com'}],subject,text})}catch(error){console.error('[health] Could not send Resend health notification:',error?.message??error)}}

async function checkPrivateService(name,binding,request,healthyStatuses){
  const startedAt=Date.now()
  if(!binding?.fetch)return{path:`service:${name}`,status:0,latency:0,ok:false,error:'binding unavailable'}
  try{
    const response=await binding.fetch(request)
    const ok=healthyStatuses.has(response.status)
    try{await response.body?.cancel?.()}catch{}
    return{path:`service:${name}`,status:response.status,latency:Date.now()-startedAt,ok}
  }catch(error){
    return{path:`service:${name}`,status:0,latency:Date.now()-startedAt,ok:false,error:error?.message??'service request failed'}
  }
}

async function runProductionHealthCheck(env,ctx){
  const baseUrl=env.WEBSITE_URL||'https://petersmartlink.com'
  const results=[]
  for(const path of HEALTH_PATHS){
    const startedAt=Date.now()
    try{
      const request=new Request(new URL(path,baseUrl),{method:'GET',headers:{'User-Agent':'OTYA-Internal-HealthCheck/3.0'},signal:AbortSignal.timeout(SERVICE_HEALTH_TIMEOUT_MS)})
      const response=await worker.fetch(request,env,ctx)
      const ok=response.status>=200&&response.status<400
      results.push({path,status:response.status,latency:Date.now()-startedAt,ok})
      try{await response.body?.cancel?.()}catch{}
    }catch(error){
      results.push({path,status:0,latency:Date.now()-startedAt,ok:false,error:error?.message??'request failed'})
    }
  }

  results.push(await checkPrivateService(
    'otya-auth',
    env.AUTH,
    new Request('https://otya-auth/auth/me',{method:'GET',signal:AbortSignal.timeout(SERVICE_HEALTH_TIMEOUT_MS)}),
    new Set([401]),
  ))
  results.push(await checkPrivateService(
    'otya-next',
    env.AI_SUPPORT,
    new Request('https://otya-next/health',{method:'GET',signal:AbortSignal.timeout(SERVICE_HEALTH_TIMEOUT_MS)}),
    new Set([200]),
  ))

  const down=results.filter(r=>!r.ok)
  const previousIncident=await readHealthIncident(env)
  if(!down.length){
    if(previousIncident){
      await clearHealthIncident(env)
      await recordRuntimeOperationalEvent(env,{
        component:'health',
        eventType:'production_health_recovered',
        status:'healthy',
        severity:'info',
        details:{surfaces:results.map(({path,status,latency})=>({path,status,latency}))},
      })
      await sendHealthEmail(env,'[OTYA Backend] Production services recovered',['OTYA production health has recovered.','',...results.map(r=>`${r.path} — ${r.status} (${r.latency}ms)`),'',`Checked at: ${new Date().toISOString()}`].join('\n'))
    }
    return
  }
  const signature=JSON.stringify(down.map(({path,status})=>[path,status]))
  if(signature===previousIncident)return
  await writeHealthIncident(env,signature)
  await recordRuntimeOperationalEvent(env,{
    component:'health',
    eventType:'production_health_incident',
    status:'unhealthy',
    severity:'critical',
    details:{surfaces:down.map(({path,status,latency,error})=>({path,status,latency,error:error??null}))},
  })
  await sendHealthEmail(env,`[OTYA Backend] ${down.length} production surface(s) unhealthy`,['OTYA production health alert','',...down.map(r=>`${r.path} — status ${r.status}, latency ${r.latency}ms${r.error?` (${r.error})`:''}`),'',`Checked at: ${new Date().toISOString()}`].join('\n'))
}

async function forwardClientAi(request,env){
  if(!env.AI_SUPPORT?.fetch)return json({error:'AI service unavailable'},503)
  const user=await authenticateUser(request,env)
  const headers=new Headers(request.headers)
  headers.delete('X-OTYA-Internal-Secret')
  headers.delete('X-OTYA-User-ID')
  headers.delete('X-OTYA-User-Email')
  headers.delete('X-OTYA-Persist-Chat')
  if(user&&env.INTERNAL_SECRET){
    headers.set('X-OTYA-Internal-Secret',env.INTERNAL_SECRET)
    headers.set('X-OTYA-User-ID',user.id)
    headers.set('X-OTYA-User-Email',user.email)
    headers.set('X-OTYA-Persist-Chat','1')
  }else{
    headers.delete('Authorization')
  }
  return env.AI_SUPPORT.fetch(new Request(request,{headers}))
}

async function forwardAdminAi(request,env){
  const user=await authenticateUser(request,env)
  if(!user)return json({error:'Sign in required'},401)
  if(!isAdminUser(user,env))return json({error:'Administrator access required'},403)
  if(!await hasElevatedAdminSession(request,env))return json({error:'Elevated administrator verification required'},403)
  if(!env.AI_SUPPORT?.fetch)return json({error:'AI support service unavailable'},503)
  if(!env.INTERNAL_SECRET)return json({error:'AI admin channel is not configured'},503)
  const headers=new Headers(request.headers)
  headers.set('X-OTYA-Internal-Secret',env.INTERNAL_SECRET)
  headers.set('X-OTYA-Admin-ID',user.id)
  headers.set('X-OTYA-Admin-Email',user.email)
  return env.AI_SUPPORT.fetch(new Request(request,{headers}))
}

async function authorizeReleaseWorkflow(request,env){
  const user=await authenticateUser(request,env)
  if(!user)return {ok:false,response:json({error:'Sign in required'},401)}
  if(!isAdminUser(user,env))return {ok:false,response:json({error:'Administrator access required'},403)}
  if(!await hasElevatedAdminSession(request,env))return {ok:false,response:json({error:'Elevated administrator verification required'},403)}
  return {ok:true,user}
}

export default {
 ...worker,
 async fetch(request,env,ctx){
  const runtimeEnv=withProductionAdapters(env);const startedAt=Date.now();const url=new URL(request.url);let response
  if(url.pathname.startsWith('/api/ai/chat')){
    response=await forwardClientAi(request,runtimeEnv)
    writeRequestAnalytics(runtimeEnv,request,response,startedAt);return response
  }
  if(url.pathname==='/api/ai/oauth/google/callback'){
    if(!runtimeEnv.AI_SUPPORT?.fetch)response=json({error:'AI support service unavailable'},503)
    else if(!runtimeEnv.INTERNAL_SECRET)response=json({error:'AI connector channel is not configured'},503)
    else{const headers=new Headers(request.headers);headers.set('X-OTYA-Internal-Secret',runtimeEnv.INTERNAL_SECRET);response=await runtimeEnv.AI_SUPPORT.fetch(new Request(request,{headers}))}
    writeRequestAnalytics(runtimeEnv,request,response,startedAt);return response
  }
  if(url.pathname.startsWith('/api/admin/ai/')){
    response=await forwardAdminAi(request,runtimeEnv)
    writeRequestAnalytics(runtimeEnv,request,response,startedAt);return response
  }
  if(url.pathname.startsWith('/api/telegram/')){response=runtimeEnv.AI_SUPPORT?.fetch?await runtimeEnv.AI_SUPPORT.fetch(request):json({error:'AI support service unavailable'},503);writeRequestAnalytics(runtimeEnv,request,response,startedAt);return response}
  if(url.pathname==='/api/admin/release-workflow'&&request.method==='POST'){
    const auth=await authorizeReleaseWorkflow(request,runtimeEnv)
    if(!auth.ok)response=auth.response
    else if(!runtimeEnv.OTYA_RELEASE_WORKFLOW?.create)response=json({error:'Release workflow binding unavailable'},503)
    else{try{const params=await request.json();const instance=await runtimeEnv.OTYA_RELEASE_WORKFLOW.create({params});response=json({ok:true,instanceId:instance.id,status:'queued'},202)}catch(error){response=json({error:'Could not start release workflow',detail:error instanceof Error?error.message:'Invalid request'},400)}}
    writeRequestAnalytics(runtimeEnv,request,response,startedAt);return response
  }
  if(url.pathname==='/api/admin/release-workflow/status'&&request.method==='GET'){
    const auth=await authorizeReleaseWorkflow(request,runtimeEnv)
    if(!auth.ok)response=auth.response
    else if(!runtimeEnv.OTYA_RELEASE_WORKFLOW?.get)response=json({error:'Release workflow binding unavailable'},503)
    else{const id=url.searchParams.get('id');if(!id)response=json({error:'id is required'},400);else{try{const instance=await runtimeEnv.OTYA_RELEASE_WORKFLOW.get(id);response=json({ok:true,instanceId:id,workflow:await instance.status()})}catch{response=json({error:'Workflow instance not found'},404)}}}
    writeRequestAnalytics(runtimeEnv,request,response,startedAt);return response
  }
  if(url.pathname==='/auth'||url.pathname.startsWith('/auth/')){response=runtimeEnv.AUTH?.fetch?await runtimeEnv.AUTH.fetch(request):json({error:'Authentication service unavailable'},503);writeRequestAnalytics(runtimeEnv,request,response,startedAt);return response}
  response=await worker.fetch(request,runtimeEnv,ctx);writeRequestAnalytics(runtimeEnv,request,response,startedAt);return response
 },
 async queue(batch,env,ctx){return worker.queue(batch,withProductionAdapters(env),ctx)},
 async scheduled(event,env,ctx){const runtimeEnv=withProductionAdapters(env);if(event.cron===HEALTH_CHECK_CRON)return runProductionHealthCheck(runtimeEnv,ctx);return worker.scheduled(event,runtimeEnv,ctx)}
}
