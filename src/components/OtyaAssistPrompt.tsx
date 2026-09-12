'use client'

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { OtyaBrandMark } from './OtyaBrandMark'
import { readChatStream } from '@/lib/chat-stream'

type ChatMessage = { role:'user'|'assistant'; content:string; handoff?:boolean; failed?:boolean }
const prompts=['Find music for tonight','Help with my Otya account','Why has my video got no sound?','Explain something simply']
const thinkingStages=['Waiting for a response…','Still waiting for Next…','This is taking longer than usual…','You can stop and try again.']

export function OtyaAssistPrompt({compact=false}:{compact?:boolean}){
  const [query,setQuery]=useState(''); const [messages,setMessages]=useState<ChatMessage[]>([]); const [loading,setLoading]=useState(false); const [guestId,setGuestId]=useState(''); const [showHandoff,setShowHandoff]=useState(false); const [email,setEmail]=useState(''); const [handoffStatus,setHandoffStatus]=useState(''); const [thinkingStage,setThinkingStage]=useState(0)
  const scrollRef=useRef<HTMLDivElement>(null)
  const requestRef=useRef<AbortController|null>(null)
  const followLatest=useRef(true)
  const [copyStatus,setCopyStatus]=useState('')
  useEffect(()=>()=>requestRef.current?.abort(),[])
  useEffect(()=>{
    let id=''
    try { id=localStorage.getItem('otya_ai_guest')||'' } catch {}
    if(!id){id=crypto.randomUUID()+crypto.randomUUID();try{localStorage.setItem('otya_ai_guest',id)}catch{}}
    setGuestId(id)
  },[])
  useEffect(()=>{
    if(followLatest.current)scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'auto'})
  },[messages,loading])
  useEffect(()=>{if(!loading){setThinkingStage(0);return}const timer=window.setInterval(()=>setThinkingStage(i=>Math.min(i+1,thinkingStages.length-1)),1300);return()=>window.clearInterval(timer)},[loading])
  const lastUserMessage=useMemo(()=>[...messages].reverse().find(m=>m.role==='user')?.content||'',[messages])
  const handoffAvailable=Boolean([...messages].reverse().find(m=>m.role==='assistant')?.handoff)

  function patchLastAssistant(patch:(message:ChatMessage)=>ChatMessage){
    setMessages(current=>{const copy=[...current];const index=copy.length-1;if(index>=0&&copy[index]?.role==='assistant')copy[index]=patch(copy[index]);return copy})
  }

  async function ask(question:string,retry=false){
    const q=question.trim(); if(!q||!guestId||requestRef.current)return
    const previous=retry?messages.slice(0,-2):messages
    const history=previous.filter(m=>!m.failed).slice(-20).map(m=>({role:m.role,content:m.content}))
    const controller=new AbortController();requestRef.current=controller
    const deadline=setTimeout(()=>controller.abort(),45000)
    followLatest.current=true
    setQuery('');setLoading(true);setThinkingStage(0);setShowHandoff(false);setHandoffStatus('')
    setMessages([...previous,{role:'user',content:q},{role:'assistant',content:''}])
    try{
      const response=await fetch('/api/ai/chat',{
        method:'POST',
        headers:{'content-type':'application/json','accept':'text/event-stream'},
        body:JSON.stringify({message:q,history,guest_id:guestId,surface:'website-chat'}),
        signal:controller.signal,
      })
      const type=(response.headers.get('content-type')||'').toLowerCase()
      if(!response.ok){
        const data=await response.json().catch(()=>({})) as {error?:string}
        throw new Error(data.error||'unavailable')
      }

      if(type.includes('text/event-stream')&&response.body){
        const received=await readChatStream(response.body,event=>{
          if(event.type==='delta'&&typeof event.delta==='string')patchLastAssistant(message=>({...message,content:message.content+event.delta}))
          if(event.handoff_available)patchLastAssistant(message=>({...message,handoff:true}))
        })
        if(!received)throw new Error('Empty answer')
      }else{
        const data=await response.json().catch(()=>({})) as {answer?:string;error?:string;handoff_available?:boolean}
        if(data.error||typeof data.answer!=='string'||!data.answer.trim())throw new Error('Answer unavailable')
        patchLastAssistant(message=>({...message,content:data.answer||'I could not answer that yet. Try asking another way.',handoff:Boolean(data.handoff_available)}))
      }
    }catch{
      patchLastAssistant(message=>({...message,content:message.content||'The response did not finish. Please try again when you are ready.',failed:true}))
    }finally{clearTimeout(deadline);if(requestRef.current===controller)requestRef.current=null;setLoading(false)}
  }
  async function submit(event:FormEvent){event.preventDefault();await ask(query)}
  function onComposerKeyDown(event:KeyboardEvent<HTMLTextAreaElement>){if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void ask(query)}}
  function newChat(){if(loading)return;setMessages([]);setQuery('');setShowHandoff(false);setHandoffStatus('')}
  async function retryLast(){if(!lastUserMessage||requestRef.current)return;await ask(lastUserMessage,true)}
  async function copyAnswer(text:string){try{await navigator.clipboard.writeText(text);setCopyStatus('Copied.')}catch{setCopyStatus('Could not copy. Select the answer text to copy it.')}}
  async function requestHandoff(){if(!lastUserMessage||!email.trim()||requestRef.current)return;const controller=new AbortController();requestRef.current=controller;const deadline=setTimeout(()=>controller.abort(),20000);setLoading(true);setHandoffStatus('');try{const response=await fetch('/api/ai/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:lastUserMessage,guest_id:guestId,surface:'website-chat',request_handoff:true,contact_email:email.trim()}),signal:controller.signal});const data=await response.json().catch(()=>({})) as {error?:string;ticket?:string;message?:string};if(!response.ok)throw new Error(data.error||'Could not notify support.');setHandoffStatus(`${data.message||'Otya Support has been notified.'}${data.ticket?` Ticket: ${data.ticket}`:''}`);setShowHandoff(false)}catch{setHandoffStatus('We could not confirm your support request. Please try again later.')}finally{clearTimeout(deadline);if(requestRef.current===controller)requestRef.current=null;setLoading(false)}}

  return <section className={`${compact?'flex-1 min-h-0':'my-6 h-[min(720px,72dvh)]'} flex flex-col overflow-hidden rounded-[28px] border border-black/[.06] dark:border-white/[.08] bg-white/75 dark:bg-white/[.025] shadow-[0_20px_70px_rgba(20,14,38,.07)] backdrop-blur-xl`}>
    <div className="shrink-0 flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-black/[.05] dark:border-white/[.07]">
      <OtyaBrandMark size={32} thinking={loading}/>
      <div className="min-w-0 flex-1"><div className="font-black tracking-[-.025em]">Next</div><div className="text-sm otya-muted">{loading?thinkingStages[thinkingStage]:'Your Otya assistant. Chat naturally and follow up anytime.'}</div></div>
      {loading&&<button type="button" onClick={()=>requestRef.current?.abort()} className="min-h-11 rounded-full px-3 text-sm font-semibold">Stop</button>}
      {messages.length>0&&<button type="button" onClick={newChat} disabled={loading} className="min-h-11 rounded-full border border-black/[.06] dark:border-white/[.08] px-3 text-sm font-black disabled:opacity-50">New chat</button>}
    </div>

    <div ref={scrollRef} onScroll={()=>{const el=scrollRef.current;if(el)followLatest.current=el.scrollHeight-el.scrollTop-el.clientHeight<80}} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5" aria-live="polite">
      {messages.length===0?<div className="mx-auto max-w-2xl pt-4 sm:pt-9">
        <h2 className="text-2xl sm:text-3xl font-black tracking-[-.045em]">How can I help?</h2>
        <p className="mt-2 text-sm leading-6 otya-muted">Music, Otya, your account or an everyday question.</p>
        <div className="mt-7 grid gap-2.5 sm:grid-cols-2">{prompts.map(prompt=><button key={prompt} type="button" onClick={()=>void ask(prompt)} className="min-h-[58px] rounded-2xl border border-black/[.06] dark:border-white/[.08] bg-black/[.018] dark:bg-white/[.018] p-4 text-left text-sm font-bold hover:bg-black/[.03] dark:hover:bg-white/[.035]">{prompt}<span className="float-right opacity-35">→</span></button>)}</div>
      </div>
      :<div className="mx-auto max-w-3xl space-y-6">{messages.map((message,index)=>message.role==='user'?<div key={index} className="ml-auto max-w-[86%] rounded-[22px] rounded-br-md px-4 py-3 whitespace-pre-wrap break-words text-base leading-7 bg-black/[.055] dark:bg-white/[.08]">{message.content}</div>:<div key={index} className="max-w-[96%]"><div className="mb-2.5 flex items-center gap-2"><OtyaBrandMark size={28} thinking={loading&&index===messages.length-1}/><span className="text-xs font-black">Next</span></div><div className="whitespace-pre-wrap break-words text-base leading-7">{message.content||((loading&&index===messages.length-1)?'Thinking…':'')}</div>{message.content&&<div className="mt-2.5 flex flex-wrap gap-2"><button type="button" onClick={()=>void copyAnswer(message.content)} className="min-h-11 rounded-full px-3 text-sm font-black otya-muted">Copy</button>{message.failed&&<span className="w-full text-sm otya-muted">This response was interrupted.</span>}{message.failed&&index===messages.length-1&&<button type="button" onClick={()=>void retryLast()} disabled={loading} className="min-h-11 rounded-full px-3 text-sm font-black">Retry</button>}{message.handoff&&<button type="button" onClick={()=>setShowHandoff(true)} className="min-h-11 rounded-full px-3 text-sm font-black">Contact support</button>}</div>}</div>)}</div>}
    </div>

    {showHandoff&&handoffAvailable&&<div className="shrink-0 mx-3 mb-2 rounded-2xl border border-black/[.06] dark:border-white/[.08] p-3 bg-black/[.018] dark:bg-white/[.018]"><div className="flex flex-col gap-2 sm:flex-row"><input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" aria-label="Your email for support" placeholder="Your email" className="min-h-11 min-w-0 flex-1 rounded-xl border border-black/[.08] dark:border-white/[.10] px-3 text-base outline-none bg-transparent"/><button type="button" disabled={loading||!email.trim()} onClick={()=>void requestHandoff()} className="cosmos-button min-h-11 rounded-xl px-4 text-sm font-black disabled:opacity-50">Send</button></div></div>}
    {copyStatus&&<p role="status" className="mx-4 mb-2 text-sm otya-muted">{copyStatus}</p>}
    {handoffStatus&&<div className="shrink-0 mx-4 mb-2 text-xs otya-muted" aria-live="polite">{handoffStatus}</div>}

    <form onSubmit={submit} className="shrink-0 border-t border-black/[.05] dark:border-white/[.07] p-3 sm:p-4"><div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[20px] border border-black/[.07] dark:border-white/[.09] bg-black/[.018] dark:bg-white/[.018] p-1.5"><textarea value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={onComposerKeyDown} rows={1} placeholder="Message Next" aria-label="Message Next" className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-base outline-none"/><button disabled={loading||!query.trim()||!guestId} aria-label="Send message" className="cosmos-button min-h-11 min-w-11 rounded-[15px] px-3 text-lg font-black disabled:opacity-50">↑</button></div></form>
  </section>
}