'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowLeft,MessageSquare,Send,X} from 'lucide-react';
import type {ChatMessage,ChatPage,Conversation} from '@/lib/messenger/model';
type ReviewRequest={requestId:string;title:string};
async function api<T>(url:string,body?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await fetch(url,{signal,cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Zprávy se nepodařilo načíst.');return data;
}
const merge=(a:ChatMessage[],b:ChatMessage[])=>Array.from(new Map([...a,...b].map(m=>[m.id,m])).values()).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
const timestamp=(date:string)=>new Date(date).toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'});
export function Messenger({offersHref,incomingOffersHref,reviewRequests=[],reviewTarget='provider',onReview}:{offersHref:string;incomingOffersHref?:string;reviewRequests?:ReviewRequest[];reviewTarget?:'provider'|'customer';onReview:(review:{requestId:string;rating:number;body:string})=>Promise<boolean>}){
  const [access,setAccess]=useState({canSend:false,accepted:false});
  const [conversations,setConversations]=useState<Conversation[]>([]),[selectedId,setSelectedId]=useState('');
  const [messages,setMessages]=useState<ChatMessage[]>([]),[cursor,setCursor]=useState<string|null>(null);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [reviewDrafts,setReviewDrafts]=useState<Record<string,{rating:number;body:string}>>({});
  const [reviewSubmitting,setReviewSubmitting]=useState('');
  const [loading,setLoading]=useState(true),[chatLoading,setChatLoading]=useState(false),[sending,setSending]=useState(false),[older,setOlder]=useState(false),[error,setError]=useState('');
  const scroller=useRef<HTMLDivElement>(null),stickToBottom=useRef(true),nonce=useRef<{key:string;id:string}|null>(null);
  const draft=drafts[selectedId]??'';
  async function refreshList(){const data=await api<{conversations:Conversation[]}>('/api/messenger/');setConversations(data.conversations);}
  useEffect(()=>{
    const controller=new AbortController();let pending=false;
    const refresh=async()=>{if(pending||document.hidden)return;pending=true;try{const d=await api<{conversations:Conversation[]}>('/api/messenger/',undefined,controller.signal);setConversations(d.conversations);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Zkuste to znovu.');}finally{if(!controller.signal.aborted)setLoading(false);pending=false;}};
    const initialize=async()=>{try{
      const params=new URLSearchParams(window.location.search),offerId=params.get('offer');
      if(offerId){const result=await api<{conversationId:string}>('/api/messenger/',{action:'start',offerId},controller.signal);setSelectedId(result.conversationId);window.history.replaceState(null,'',window.location.pathname+'?conversation='+encodeURIComponent(result.conversationId));}
      else if(params.has('contact'))throw new Error('Chaty jsou dostupné pouze ke konkrétní zakázce.');
      else if(params.get('conversation'))setSelectedId(params.get('conversation')!);
      await refresh();
    }catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Kontakt není dostupný.');setLoading(false);}}};
    void initialize();const timer=setInterval(()=>void refresh(),5000);document.addEventListener('visibilitychange',refresh);
    return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  useEffect(()=>{
    setMessages([]);setAccess({canSend:false,accepted:false});setCursor(null);stickToBottom.current=true;setChatLoading(!!selectedId);
    if(!selectedId)return;const controller=new AbortController();let initial=true,pending=false,lastRead='';
    const refresh=async()=>{if(pending||document.hidden)return;pending=true;try{
      const page=await api<ChatPage>('/api/messenger/?conversationId='+encodeURIComponent(selectedId),undefined,controller.signal);
      setAccess({canSend:page.canSend,accepted:page.accepted});setMessages(previous=>merge(previous,page.items));if(initial){setCursor(page.nextCursor);initial=false;}setChatLoading(false);
      const latest=page.items.at(-1);
      if(latest&&latest.id!==lastRead&&!document.hidden){await api('/api/messenger/',{action:'read',conversationId:selectedId,messageId:latest.id},controller.signal);lastRead=latest.id;setConversations(cs=>cs.map(c=>c.conversationId===selectedId?{...c,unread:0}:c));}
    }catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Zkuste to znovu.');setChatLoading(false);}}finally{pending=false;}};
    void refresh();const timer=setInterval(()=>void refresh(),4000);document.addEventListener('visibilitychange',refresh);
    return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[selectedId]);
  useEffect(()=>{if(stickToBottom.current&&scroller.current)scroller.current.scrollTop=scroller.current.scrollHeight;},[messages]);
  function choose(id:string){setError('');setSelectedId(id);window.history.replaceState(null,'',window.location.pathname+'?conversation='+encodeURIComponent(id));}
  async function loadOlder(){
    if(!cursor||older)return;setOlder(true);const id=selectedId,element=scroller.current,previousHeight=element?.scrollHeight??0;
    try{const page=await api<ChatPage>('/api/messenger/?conversationId='+encodeURIComponent(id)+'&before='+encodeURIComponent(cursor));stickToBottom.current=false;setMessages(ms=>merge(page.items,ms));setCursor(page.nextCursor);requestAnimationFrame(()=>{if(element)element.scrollTop+=element.scrollHeight-previousHeight;});}catch(e){setError(e instanceof Error?e.message:'Starší zprávy se nepodařilo načíst.');}finally{setOlder(false);}
  }
  async function send(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const body=draft.trim(),id=selectedId;if(!body||sending||!access.canSend)return;setSending(true);setError('');
    const key=id+'|'+body;if(nonce.current?.key!==key)nonce.current={key,id:crypto.randomUUID()};
    try{await api('/api/messenger/',{action:'send',conversationId:id,body,clientId:nonce.current.id});
      setDrafts(ds=>({...ds,[id]:ds[id]===draft?'':ds[id]}));nonce.current=null;stickToBottom.current=true;
      const page=await api<ChatPage>('/api/messenger/?conversationId='+encodeURIComponent(id));setMessages(ms=>merge(ms,page.items));await refreshList();
    }catch(e){setError(e instanceof Error?e.message:'Zpráva se neodeslala. Text zůstává připravený k opakování.');}finally{setSending(false);}
  }
  async function submitReview(event:FormEvent<HTMLFormElement>,request:ReviewRequest){
    event.preventDefault();const draft=reviewDrafts[request.requestId]??{rating:5,body:''};
    if(reviewSubmitting)return;setReviewSubmitting(request.requestId);
    try{if(await onReview({requestId:request.requestId,...draft}))setReviewDrafts(ds=>({...ds,[request.requestId]:{rating:5,body:''}}));}
    finally{setReviewSubmitting('');}
  }
  const selected=conversations.find(c=>c.conversationId===selectedId);
  const selectedReviews=reviewRequests.filter(request=>request.requestId===selected?.requestId);
  return <section aria-label="Messenger" className={'m-messenger '+(selectedId?'has-selection':'')}>
    {error&&<div className="p-error m-chat-error" role="alert">{error}<button className="m-icon-button" aria-label="Zavřít upozornění" onClick={()=>setError('')}><X size={16}/></button></div>}
    <aside className="m-chat-sidebar" aria-label="Zakázky s chatem">
      <div className="m-chat-list-heading"><div><h2>Chaty k zakázkám</h2><p>Každá zakázka má vlastní konverzaci.</p></div></div>
      <div className="m-chat-contacts">{loading&&<p className="m-chat-hint" role="status">Načítání chatů…</p>}{conversations.map(conversation=><button className={'m-chat-contact '+(conversation.conversationId===selectedId?'selected':'')} key={conversation.conversationId} aria-pressed={conversation.conversationId===selectedId} onClick={()=>choose(conversation.conversationId)} disabled={older||sending}><span className="m-chat-request-photo">{conversation.requestPhoto?<img src={conversation.requestPhoto} alt=""/>:<span aria-hidden="true"/>}</span><span><strong>{conversation.requestTitle}</strong><small>{conversation.lastMessage}</small></span><span className="m-chat-contact-meta"><time dateTime={conversation.updatedAt}>{new Date(conversation.updatedAt).toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric'})}</time>{conversation.unread>0&&<b aria-label={conversation.unread+' nepřečtených zpráv'}>{conversation.unread}</b>}</span></button>)}{!loading&&!conversations.length&&<p className="m-chat-hint">Zatím nemáte odemčený chat k žádné zakázce. Chat otevřete u přijaté nabídky po jeho odemknutí.</p>}</div>
    </aside>
    <div className="m-chat-main">
      
      {selectedId?<><header className="m-chat-header"><button className="m-icon-button m-chat-back" aria-label="Zpět na zakázky" disabled={sending||older} onClick={()=>{setSelectedId('');window.history.replaceState(null,'',window.location.pathname);}}><ArrowLeft size={20}/></button><span className="m-chat-request-photo m-chat-header-photo">{selected?.requestPhoto?<img src={selected.requestPhoto} alt=""/>:<span aria-hidden="true"/>}</span><div><h2>{selected?.requestTitle??'Zakázka'}</h2></div></header>
      <div className="m-chat-history" ref={scroller} onScroll={()=>{const el=scroller.current;if(el)stickToBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}}>
        {cursor&&<button className="m-chat-older" disabled={older} onClick={()=>void loadOlder()}>{older?'Načítání…':'Načíst starší zprávy'}</button>}
        {chatLoading&&<p className="m-chat-hint" role="status">Načítání konverzace…</p>}
        {!chatLoading&&access.canSend&&!messages.length&&<div className="m-chat-welcome"><MessageSquare size={32}/><h3>Začněte krátkým pozdravem.</h3><p>Domluvte si podrobnosti, termín nebo se zeptejte na nabídku.</p></div>}
        <div role="log" aria-label="Zprávy v konverzaci" aria-live="polite" aria-relevant="additions">{messages.map((m,i)=>{const day=new Date(m.createdAt).toLocaleDateString('cs-CZ');return <div key={m.id}>{(!i||new Date(messages[i-1].createdAt).toLocaleDateString('cs-CZ')!==day)&&<div className="m-chat-day">{day}</div>}<article className={'m-chat-bubble '+(m.isOwn?'own':'')}><p>{m.body}</p><time dateTime={m.createdAt}>{timestamp(m.createdAt)}</time></article></div>;})}</div>
      </div>
      {!!selectedReviews.length&&<section className="m-chat-review-list" aria-label="Ohodnotit dokončenou zakázku"><h3>{reviewTarget==='customer'?'Ohodnoťte zákazníka':'Zakázka je dokončená? Napište recenzi'}</h3>{selectedReviews.map(request=>{const draft=reviewDrafts[request.requestId]??{rating:5,body:''};return <form className="m-chat-review-card" key={request.requestId} onSubmit={event=>void submitReview(event,request)}><strong>{request.title}</strong><label htmlFor={`review-rating-${request.requestId}`}>Hodnocení</label><select id={`review-rating-${request.requestId}`} value={draft.rating} onChange={event=>setReviewDrafts(ds=>({...ds,[request.requestId]:{...draft,rating:Number(event.target.value)}}))}>{[5,4,3,2,1].map(rating=><option value={rating} key={rating}>{rating} z 5</option>)}</select><label htmlFor={`review-body-${request.requestId}`}>{reviewTarget==='customer'?'Zkušenost se zákazníkem':'Vaše zkušenost'}</label><textarea id={`review-body-${request.requestId}`} value={draft.body} minLength={3} maxLength={3000} required rows={2} onChange={event=>setReviewDrafts(ds=>({...ds,[request.requestId]:{...draft,body:event.target.value}}))}/><button className="p-button p-secondary" type="submit" disabled={reviewSubmitting===request.requestId}>{reviewSubmitting===request.requestId?'Odesílám…':'Odeslat recenzi'}</button></form>;})}</section>}
      {!access.canSend?<div className="m-chat-composer"><p>{chatLoading?'Ověřujeme přístup k chatu…':'Tento chat není dostupný. Vyberte konkrétní zakázku z přijaté nabídky.'}</p><a className="p-button p-secondary" href={offersHref}>{incomingOffersHref?'Moje odeslané nabídky':'Přejít do Nabídek'}</a>{incomingOffersHref&&<a className="p-button p-secondary" href={incomingOffersHref}>Moje poptávky</a>}</div>:<form className="m-chat-composer" onSubmit={e=>void send(e)}><div><label className="sr-only" htmlFor="chat-message">Zpráva</label><textarea id="chat-message" placeholder="Napište zprávu…" value={draft} rows={2} maxLength={5000} onChange={e=>setDrafts(ds=>({...ds,[selectedId]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/><button className="p-button" type="submit" disabled={sending||chatLoading||!draft.trim()} aria-label="Odeslat zprávu"><Send size={18}/><span>{sending?'Odesílání…':'Odeslat'}</span></button></div><small>Enter odešle zprávu · Shift + Enter vytvoří nový řádek</small></form>}</>:<div className="m-chat-welcome"><MessageSquare size={42}/><h2>Chaty ke konkrétním zakázkám</h2><p>Otevřete přijatou nabídku a odemkněte chat pro danou zakázku.</p></div>}
    </div>
  </section>;
}
