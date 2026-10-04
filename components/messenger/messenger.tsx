'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowLeft,MessageSquare,Plus,Search,Send,X} from 'lucide-react';
import {normalizeSearch} from '@/lib/company-types';
import type {ChatMessage,ChatPage,Contact,Conversation} from '@/lib/messenger/model';
async function api<T>(url:string,body?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await fetch(url,{signal,cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Zprávy se nepodařilo načíst.');return data;
}
const avatar=(name:string)=>name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase();
const merge=(a:ChatMessage[],b:ChatMessage[])=>Array.from(new Map([...a,...b].map(m=>[m.id,m])).values()).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
const timestamp=(date:string)=>new Date(date).toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'});
export function Messenger({accountId,offersHref}:{accountId:string;offersHref:string}){
  const [access,setAccess]=useState({canSend:false,accepted:false});
  const [conversations,setConversations]=useState<Conversation[]>([]),[selectedId,setSelectedId]=useState('');
  const [messages,setMessages]=useState<ChatMessage[]>([]),[cursor,setCursor]=useState<string|null>(null);
  const [drafts,setDrafts]=useState<Record<string,string>>({}),[search,setSearch]=useState(''),[newChat,setNewChat]=useState(false),[contacts,setContacts]=useState<Contact[]>([]);
  const [loading,setLoading]=useState(true),[chatLoading,setChatLoading]=useState(false),[sending,setSending]=useState(false),[starting,setStarting]=useState(false),[older,setOlder]=useState(false),[error,setError]=useState('');
  const scroller=useRef<HTMLDivElement>(null),stickToBottom=useRef(true),nonce=useRef<{key:string;id:string}|null>(null);
  const selected=conversations.find(c=>c.conversationId===selectedId),draft=drafts[selectedId]??'';
  async function refreshList(){const data=await api<{conversations:Conversation[]}>('/api/messenger/');setConversations(data.conversations);}
  useEffect(()=>{
    const controller=new AbortController();let pending=false;
    const refresh=async()=>{if(pending||document.hidden)return;pending=true;try{const d=await api<{conversations:Conversation[]}>('/api/messenger/',undefined,controller.signal);setConversations(d.conversations);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Zkuste to znovu.');}finally{if(!controller.signal.aborted)setLoading(false);pending=false;}};
    const initialize=async()=>{try{
      const params=new URLSearchParams(window.location.search),contact=params.get('contact');
      if(contact){const result=await api<{conversationId:string}>('/api/messenger/',{action:'start',contactId:contact},controller.signal);setSelectedId(result.conversationId);window.history.replaceState(null,'',window.location.pathname+'?conversation='+encodeURIComponent(result.conversationId));}
      else if(params.get('conversation'))setSelectedId(params.get('conversation')!);
      await refresh();
    }catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Kontakt není dostupný.');setLoading(false);}}};
    void initialize();const timer=setInterval(()=>void refresh(),5000);document.addEventListener('visibilitychange',refresh);
    return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  useEffect(()=>{
    if(!newChat)return;const controller=new AbortController();
    const timer=setTimeout(()=>{void api<{contacts:Contact[]}>('/api/messenger/?scope=contacts&q='+encodeURIComponent(search),undefined,controller.signal).then(r=>setContacts(r.contacts)).catch(e=>{if(!controller.signal.aborted)setError(e.message);});},200);
    return()=>{clearTimeout(timer);controller.abort();};
  },[newChat,search]);
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
  function choose(id:string){setError('');setSelectedId(id);setNewChat(false);window.history.replaceState(null,'',window.location.pathname+'?conversation='+encodeURIComponent(id));}
  async function start(contact:Contact){
    if(starting||sending||older)return;setStarting(true);setError('');
    try{const result=await api<{conversationId:string}>('/api/messenger/',{action:'start',contactId:contact.id});await refreshList();choose(result.conversationId);}catch(e){setError(e instanceof Error?e.message:'Konverzaci se nepodařilo otevřít.');}finally{setStarting(false);}
  }
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
  const shown=conversations.filter(c=>normalizeSearch(c.name+' '+c.city).includes(normalizeSearch(search)));
  return <section aria-label="Messenger" className={'m-messenger '+(selectedId?'has-selection':'')}>
    {error&&<div className="p-error m-chat-error" role="alert">{error}<button className="m-icon-button" aria-label="Zavřít upozornění" onClick={()=>setError('')}><X size={16}/></button></div>}
    <aside className="m-chat-sidebar" aria-label="Kontakty a konverzace">
      <div className="m-chat-list-heading"><div><h2>Zprávy</h2><p>Všechny domluvy na jednom místě.</p></div><button className="m-icon-button" aria-label={newChat?'Zavřít nové kontakty':'Nová konverzace'} onClick={()=>{setNewChat(!newChat);setSearch('');setError('');}}>{newChat?<X size={20}/>:<Plus size={20}/>}</button></div>
      <label className="m-chat-search"><Search size={17}/><span className="sr-only">Hledat kontakt</span><input placeholder={newChat?'Jméno dodavatele nebo město':'Hledat v kontaktech'} value={search} onChange={e=>setSearch(e.target.value)} maxLength={100}/></label>
      <div className="m-chat-contacts">{newChat?<><h3>Nová konverzace</h3><p className="m-chat-hint">Zákaznické konverzace jsou dostupné po přijetí nabídky. Chat odemyká dodavatel za 49 kreditů.</p>{contacts.map(c=><button className="m-chat-contact" key={c.id} disabled={starting} onClick={()=>void start(c)}><span className="m-chat-avatar">{c.avatarUrl?<img src={c.avatarUrl} alt=""/>:avatar(c.name)}</span><span><strong>{c.name}</strong><small>{c.city||'Kontakt na Prospektu'}</small></span><Plus size={17}/></button>)}{!contacts.length&&<p className="m-chat-hint">Žádný kontakt neodpovídá hledání. Zkuste jiné jméno nebo město.</p>}</>:<>{loading&&<p className="m-chat-hint" role="status">Načítání kontaktů…</p>}{shown.map(c=><button className={'m-chat-contact '+(c.conversationId===selectedId?'selected':'')} key={c.conversationId} aria-pressed={c.conversationId===selectedId} onClick={()=>choose(c.conversationId)} disabled={older||sending}><span className="m-chat-avatar">{c.avatarUrl?<img src={c.avatarUrl} alt=""/>:avatar(c.name)}</span><span><strong>{c.name}</strong><small>{c.lastMessage}</small></span><span className="m-chat-contact-meta"><time dateTime={c.updatedAt}>{new Date(c.updatedAt).toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric'})}</time>{c.unread>0&&<b aria-label={c.unread+' nepřečtených zpráv'}>{c.unread}</b>}</span></button>)}{!loading&&!shown.length&&<div className="m-chat-hint"><p>{search?'Žádný kontakt neodpovídá hledání.':'Zatím si s nikým nepíšete.'}</p><button className="m-text-button" onClick={()=>{setNewChat(true);setSearch('');}}>Najít kontakt a napsat →</button></div>}</>}</div>
    </aside>
    <div className="m-chat-main">
      
      {selectedId?<><header className="m-chat-header"><button className="m-icon-button m-chat-back" aria-label="Zpět na kontakty" disabled={sending||older} onClick={()=>{setSelectedId('');window.history.replaceState(null,'',window.location.pathname);}}><ArrowLeft size={20}/></button><span className="m-chat-avatar">{selected?.avatarUrl?<img src={selected.avatarUrl} alt=""/>:avatar(selected?.name??'?')}</span><div><h2>{selected?.name??'Konverzace'}</h2><p>{selected?.city||'Soukromá konverzace'}</p></div></header>
      <div className="m-chat-history" ref={scroller} onScroll={()=>{const el=scroller.current;if(el)stickToBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}}>
        {cursor&&<button className="m-chat-older" disabled={older} onClick={()=>void loadOlder()}>{older?'Načítání…':'Načíst starší zprávy'}</button>}
        {chatLoading&&<p className="m-chat-hint" role="status">Načítání konverzace…</p>}
        {!chatLoading&&access.canSend&&!messages.length&&<div className="m-chat-welcome"><MessageSquare size={32}/><h3>Začněte krátkým pozdravem.</h3><p>Domluvte si podrobnosti, termín nebo se zeptejte na nabídku.</p></div>}
        <div role="log" aria-label="Zprávy v konverzaci" aria-live="polite" aria-relevant="additions">{messages.map((m,i)=>{const day=new Date(m.createdAt).toLocaleDateString('cs-CZ');return <div key={m.id}>{(!i||new Date(messages[i-1].createdAt).toLocaleDateString('cs-CZ')!==day)&&<div className="m-chat-day">{day}</div>}<article className={'m-chat-bubble '+(m.senderAccountId===accountId?'own':'')}><span className="sr-only">{m.senderName}: </span>{m.requestTitle&&<small className="m-chat-context">K poptávce: {m.requestTitle}</small>}<p>{m.body}</p><time dateTime={m.createdAt}>{timestamp(m.createdAt)}</time></article></div>;})}</div>
      </div>
      {!access.canSend?<div className="m-chat-composer"><p>{chatLoading?'Ověřujeme přístup k chatu…':access.accepted?'Nabídka je přijatá. Dodavatel odemkne chat v Nabídkách za 49 kreditů.':'Chat je dostupný po přijetí nabídky zákazníkem a odemknutí dodavatelem.'}</p><a className="p-button p-secondary" href={offersHref}>Přejít do Nabídek</a></div>:<form className="m-chat-composer" onSubmit={e=>void send(e)}><div><label className="sr-only" htmlFor="chat-message">Zpráva</label><textarea id="chat-message" placeholder="Napište zprávu…" value={draft} rows={2} maxLength={5000} onChange={e=>setDrafts(ds=>({...ds,[selectedId]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/><button className="p-button" type="submit" disabled={sending||chatLoading||!draft.trim()} aria-label="Odeslat zprávu"><Send size={18}/><span>{sending?'Odesílání…':'Odeslat'}</span></button></div><small>Enter odešle zprávu · Shift + Enter vytvoří nový řádek</small></form>}</>:<div className="m-chat-welcome"><MessageSquare size={42}/><h2>S kým se chcete domluvit?</h2><p>Vyberte kontakt vlevo nebo začněte novou konverzaci.</p><button className="p-button" onClick={()=>{setNewChat(true);setSearch('');}}><Plus size={17}/> Nová konverzace</button></div>}
    </div>
  </section>;
}
