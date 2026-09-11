/**
 * Server-side Resend transport for Otya authentication emails.
 */

export interface ResendEmail {
  from: string
  to: string[]
  subject: string
  text: string
  replyTo?: string
}

interface ResendResponse { id?: string; message?: string; name?: string; statusCode?: number }
interface TemplateSelection { id: string; variables: Record<string, string | number> }

const OTYA_SUPPORT_EMAIL = 'support@petersmartlink.com'
const OTYA_LOGO_URL = 'https://petersmartlink.com/otya-app-icon.webp'

function escapeHtml(value: string): string {
  return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')
}

function renderParagraph(line: string): string {
  const safe = escapeHtml(line.trim())
  if (!safe) return '<tr><td style="height:10px;font-size:1px;line-height:1px">&nbsp;</td></tr>'
  const isOtp = /^[A-Z][0-9]{4}$/.test(line.trim())
  if (isOtp) return `<tr><td bgcolor="#EAFBFF" style="background-color:#EAFBFF;padding-top:18px;padding-bottom:18px;padding-left:18px;padding-right:18px;border-radius:16px;border-width:1px;border-style:solid;border-color:#A8EEFF;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:40px;font-weight:800;letter-spacing:8px;color:#0A1020">${safe}</td></tr>`
  const isSignature = line.trim().startsWith('—')
  return `<tr><td style="padding-bottom:12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${isSignature?'#60748C':'#344054'}">${safe}</td></tr>`
}

function renderEmailHtml(subject: string, text: string): string {
  const body = text.split('\n').map(renderParagraph).join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head><body style="margin:0;padding:0;background-color:#F5FAFF;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#F5FAFF" style="background-color:#F5FAFF;padding-top:28px;padding-bottom:28px;padding-left:14px;padding-right:14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin-left:auto;margin-right:auto"><tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding-top:24px;padding-bottom:24px;padding-left:26px;padding-right:26px;border-top-left-radius:22px;border-top-right-radius:22px;border-width:1px;border-style:solid;border-color:#D7E8F8;border-bottom-width:0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle"><img src="${OTYA_LOGO_URL}" alt="Otya" width="46" height="46" border="0" style="display:block;width:46px;height:46px;background-color:transparent" /></td><td style="padding-left:10px;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;font-weight:800;color:#0A1020">Otya</td></tr></table></td></tr><tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding-top:8px;padding-bottom:28px;padding-left:26px;padding-right:26px;border-bottom-left-radius:22px;border-bottom-right-radius:22px;border-width:1px;border-style:solid;border-color:#D7E8F8;border-top-width:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-bottom:20px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:32px;font-weight:800;color:#0A1020">${escapeHtml(subject)}</td></tr>${body}<tr><td style="padding-top:18px;border-top-width:1px;border-top-style:solid;border-top-color:#D7E8F8;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#60748C">This is an automated Otya account or security message. Never share passwords, verification codes or recovery codes.<br/>Need help? <a href="mailto:${OTYA_SUPPORT_EMAIL}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#087EAE;text-decoration:underline">${OTYA_SUPPORT_EMAIL}</a></td></tr></table></td></tr></table></td></tr></table></body></html>`
}

function extractOtp(text: string): string | null { return text.match(/\b[A-Z][0-9]{4}\b/)?.[0] ?? null }
function extractMinutes(text: string, fallback=10): number { const match=text.match(/expires? in\s+(\d+)\s+minutes?/i); const value=match?Number.parseInt(match[1],10):fallback; return Number.isFinite(value)&&value>0?value:fallback }
function extractName(text: string): string { const name=text.match(/\b(?:Hi|Hello|Welcome)\s+([^,\n.!]+)/i)?.[1]?.trim(); if(!name||name.length>80||/^(to|your|the|otya)$/i.test(name))return 'there'; return name }

function selectTemplate(email: ResendEmail): TemplateSelection | null {
  const subject=email.subject.toLowerCase(); const otp=extractOtp(email.text); const name=extractName(email.text)
  // Keep privileged-code instructions and subject intact.
  if (subject.includes('admin')) return null
  if(subject.includes('verification code')&&otp)return{id:'otya-verification-code-1',variables:{NAME:name,CODE:otp,MINUTES:extractMinutes(email.text)}}
  if((subject.includes('password')||subject.includes('reset'))&&otp)return{id:'otya-password-reset-1',variables:{NAME:name,CODE:otp,MINUTES:extractMinutes(email.text)}}
  if(subject.includes('welcome'))return{id:'otya-welcome-1',variables:{NAME:name}}
  if(subject.includes('security')||subject.includes('new login')){
    const ip=email.text.match(/IP address\s*:\s*([^\n]+)/i)?.[1]?.trim(); const time=email.text.match(/Time\s*:\s*([^\n]+)/i)?.[1]?.trim(); const device=email.text.match(/Device\s*:\s*([^\n]+)/i)?.[1]?.trim(); const location=email.text.match(/Location\s*:\s*([^\n]+)/i)?.[1]?.trim(); const message=email.text.split('\n').map(line=>line.trim()).find(line=>/detected|security|login|signed in/i.test(line)&&!/^hi\b/i.test(line))??'We detected security-related activity on your Otya account.'
    return{id:'otya-security-alert-1',variables:{NAME:name,MESSAGE:message,DEVICE:device||'Otya app or web account',LOCATION:location||(ip?`IP ${ip}`:'Unknown location'),TIME:time||'Not provided'}}
  }
  if(subject.includes('service')||subject.includes('notice')||subject.includes('maintenance'))return{id:'otya-service-notice-1',variables:{NAME:name,MESSAGE:email.text.trim(),STATUS:subject.includes('maintenance')?'Maintenance':'Information'}}
  return null
}

class ResendDeliveryError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`Resend email failed (HTTP ${status})`)
    this.status = status
  }
}

async function postEmail(apiKey: string, payload: Record<string, unknown>): Promise<ResendResponse> {
  const controller = new AbortController()
  const deadline = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal,
    })
    let data: ResendResponse = {}
    try { data = await response.json() as ResendResponse } catch {}
    if (!response.ok) throw new ResendDeliveryError(response.status)
    if (!data.id) throw new Error('Resend did not confirm delivery acceptance')
    return data
  } finally {
    clearTimeout(deadline)
  }
}

function fallbackPayload(email:ResendEmail):Record<string,unknown>{return{from:email.from.replaceAll('OTYA','Otya'),to:email.to,subject:email.subject.replaceAll('OTYA','Otya'),text:email.text.replaceAll('OTYA','Otya'),html:renderEmailHtml(email.subject.replaceAll('OTYA','Otya'),email.text.replaceAll('OTYA','Otya')),reply_to:email.replyTo??OTYA_SUPPORT_EMAIL}}

export async function sendResendEmail(apiKey:string|undefined,email:ResendEmail):Promise<string>{
  if(!apiKey)throw new Error('RESEND_API_KEY is not configured')
  const template=selectTemplate(email)
  if (template) {
    try {
      const data = await postEmail(apiKey, {
        from: email.from.replaceAll('OTYA', 'Otya'), to: email.to,
        subject: email.subject.replaceAll('OTYA', 'Otya'),
        template, reply_to: email.replyTo ?? OTYA_SUPPORT_EMAIL,
      })
      return data.id!
    } catch (error) {
      // Retry with HTML only after explicit rejection, never ambiguous failure.
      if (!(error instanceof ResendDeliveryError) || ![400, 404, 422].includes(error.status)) throw error
      console.warn('[auth/email] template rejected; using branded fallback')
    }
  }
  const data=await postEmail(apiKey,fallbackPayload(email));return data.id!
}
