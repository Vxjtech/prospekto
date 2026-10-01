"""Prepare and resume the authorized Prospekto import; never prints contact records or credentials."""
import argparse,concurrent.futures,getpass,hashlib,json,pathlib,sqlite3,time,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('source');parser.add_argument('--prepare-only',action='store_true');args=parser.parse_args()
source=pathlib.Path(args.source)
expected='c73730438864deab6a8543d197513932fccce52a14e04f034e469451a7a4dee4'
with source.open('rb') as f:
 if hashlib.file_digest(f,'sha256').hexdigest()!=expected:raise SystemExit('The source checksum does not match the approved attachment.')
work=ROOT/'.sites-runtime/catalog-import';work.mkdir(parents=True,exist_ok=True)
category_ids={'Auto, moto':'auto-moto','Reality':'reality','Služby, obchod, prodej':'sluzby-obchod-prodej','Úřady, správa':'urady-sprava','Vzdělání, jazyky':'vzdelani-jazyky','Zahrada, zemědělství, zvířata':'zahrada-zemedelstvi-zvirata','Finance, ekonomika, právo':'finance-ekonomika-pravo','Restaurace, ubytování':'restaurace-ubytovani','Stavebnictví':'stavebnictvi','Výpočetní technika, internet':'vypocetni-technika-internet','Zábava, kultura':'zabava-kultura','Zdravotnictví, zdravotní služby a technika':'zdravotnictvi'}
c=sqlite3.connect('file:'+str(source)+'?mode=ro',uri=True)
categories={}
for key,name in c.execute('SELECT DISTINCT source_key,name FROM company_categories ORDER BY source_key,name'):
 categories.setdefault(key,[]).append(category_ids[name])
files=[];chunk=[];total=0

def save_chunk(rows):
 number=len(files);raw=json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode()
 payload={'action':'batch','chunk':number,'hash':hashlib.sha256(raw).hexdigest(),'rows':rows}
 path=work/f'batch-{number:03}.json';path.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
 files.append(path)
for key,name,phones,emails,websites,ico,url,fetched in c.execute('SELECT source_key,name,phones,emails,websites,ico,detail_url,fetched_at FROM companies ORDER BY source_key'):
 chunk.append({'id':key,'name':name,'phones':json.loads(phones),'emails':json.loads(emails),'websites':json.loads(websites),'ico':ico,'categories':categories[key],'sourceUrl':url,'fetchedAt':fetched});total+=1
 if len(chunk)==1000:save_chunk(chunk);chunk=[]
if chunk:save_chunk(chunk)
assert total==245828 and len(files)==246
print(f'Prepared {total} companies in {len(files)} resumable batches.',flush=True)
if args.prepare_only:raise SystemExit(0)
credentials=json.loads(getpass.getpass('Ready for import credentials (hidden JSON): '))
url='https://prospekto.vvlcek07.chatgpt.site/api/catalog-import/'
headers={'OAI-Sites-Authorization':'Bearer '+credentials['service'],'Authorization':'Bearer '+credentials['import'],'User-Agent':'Prospekto-Database-Import/1.0','Content-Type':'application/json'}
def request(payload=None):
 for attempt in range(5):
  try:
   req=urllib.request.Request(url,data=payload,headers=headers)
   with urllib.request.urlopen(req,timeout=75) as response:return json.load(response)
  except urllib.error.HTTPError as e:
   body=e.read(500).decode(errors='replace')
   if e.code not in [429,500,502,503,504] or attempt==4:raise RuntimeError(f'Import HTTP {e.code}: {body}')
  except (TimeoutError,urllib.error.URLError):
   if attempt==4:raise
  time.sleep(min(2**attempt,10))
status=request()
if (status.get('meta') or {}).get('ready'):
 print('Import is already complete:',status['meta']['total'],flush=True);raise SystemExit(0)
done={row['id']:row['hash'] for row in status['chunks']}
pending=[]
for path in files:
 data=json.loads(path.read_text())
 if data['chunk'] in done:
  assert done[data['chunk']]==data['hash'],'Previously imported batch checksum mismatch'
 else:pending.append(path)
print(f'Resuming: {len(done)} complete, {len(pending)} remaining.',flush=True)
start=time.monotonic()
def upload(path):return request(path.read_bytes())
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 futures={pool.submit(upload,path):path for path in pending}
 completed=len(done)
 for future in concurrent.futures.as_completed(futures):
  future.result();completed+=1
  if completed%5==0 or completed==len(files):print(f'Imported {completed}/{len(files)} batches ({time.monotonic()-start:.0f}s).',flush=True)
print('Finalizing import…',flush=True)
print(json.dumps(request(json.dumps({'action':'finish'}).encode())),flush=True)
