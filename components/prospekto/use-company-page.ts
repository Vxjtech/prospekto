'use client';
import {useEffect,useRef,useState} from 'react';
import type {CompanyPage,PublicCompany} from '@/lib/company-types';
export function useCompanyPage<T extends PublicCompany>(endpoint:string,params:URLSearchParams,initial:CompanyPage<T>,initialQueryKey?:string){
 const key=endpoint+'?'+params.toString();const loaded=useRef(initialQueryKey??key);
 const[data,setData]=useState(initial),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(key===loaded.current&&attempt===0){setLoading(false);setError(null);return;}
  const controller=new AbortController();setLoading(true);setError(null);
  const timer=setTimeout(async()=>{try{const response=await fetch(key,{signal:controller.signal,credentials:'same-origin',cache:'no-store'});const result=await response.json() as CompanyPage<T>&{error?:string};if(!response.ok)throw new Error(result.error||'Databázi se nepodařilo načíst.');if(!controller.signal.aborted){setData(result);loaded.current=key;setLoading(false);}}catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Databázi se nepodařilo načíst.');setLoading(false);}}},250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[key,attempt]);
 return {data,loading,error,retry:()=>setAttempt(value=>value+1)};
}
