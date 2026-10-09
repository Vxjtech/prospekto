'use client';
import {useRef,useState} from 'react';
import {ImagePlus,X} from 'lucide-react';

export function RequestPhotos({photos,onChange,onError,onUploadingChange}:{photos:string[];onChange:(photos:string[])=>void;onError:(message:string)=>void;onUploadingChange:(uploading:boolean)=>void}) {
  const [uploading,setUploading]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  async function upload(files:FileList|null) {
    if(!files?.length)return;
    const selected=Array.from(files);
    if(selected.length>5-photos.length){onError('K jedné poptávce můžete přidat nejvýše 5 fotografií.');return;}
    if(selected.some(file=>file.size>2*1024*1024)){onError('Každá fotografie může mít nejvýše 2 MB.');return;}
    setUploading(true);onUploadingChange(true);onError('');
    const uploaded:string[]=[];
    try {
      for(const file of selected) {
        const response=await fetch('/api/media/',{method:'POST',headers:{'Content-Type':file.type,'X-Media-Purpose':'request'},body:file});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||'Fotografii se nepodařilo nahrát.');
        uploaded.push(result.url as string);
      }
      onChange([...photos,...uploaded]);
    } catch(error) {
      if(uploaded.length)onChange([...photos,...uploaded]);
      onError(error instanceof Error?error.message:'Fotografii se nepodařilo nahrát.');
    } finally {
      setUploading(false);onUploadingChange(false);
    }
  }
  return <div className="m-request-photos">
    <div className="m-request-photos-controls">
      <div><strong>Fotografie k poptávce</strong><small>{photos.length}/5 · JPG, PNG nebo WebP · do 2 MB/kus</small></div>
      <button type="button" className="p-button p-secondary" disabled={uploading||photos.length>=5} onClick={()=>input.current?.click()}>
        <ImagePlus size={17}/>{photos.length?'Přidat další fotografie':'Přidat fotografie'}
      </button>
      <input ref={input} className="m-request-photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading||photos.length>=5} aria-label="Vybrat fotografie k poptávce" onChange={event=>{void upload(event.target.files);event.currentTarget.value='';}}/>
    </div>
    {uploading&&<p role="status">Nahrávám fotografie…</p>}
    {!!photos.length&&<div className="m-request-photo-list">{photos.map((url,index)=><figure key={url}>
      <img src={url} alt={`Fotografie k poptávce ${index+1}`}/>
      <button type="button" aria-label={`Odebrat fotografii ${index+1}`} disabled={uploading} onClick={()=>onChange(photos.filter(photo=>photo!==url))}><X size={15}/></button>
    </figure>)}</div>}
  </div>;
}
