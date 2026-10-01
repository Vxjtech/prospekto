import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1'};
// Some restricted Linux hosts do not expose /proc for optional RSS telemetry.
// Use V8/getrusage counters only when that diagnostic API is unavailable.
try{process.memoryUsage();}catch(error){
  if(error.code!=='ENOENT')throw error;
  const preload=fileURLToPath(new URL('./memory-telemetry.cjs',import.meta.url));
  env.NODE_OPTIONS=[env.NODE_OPTIONS,`--require=${preload}`].filter(Boolean).join(' ');
}
const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],{env,stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
