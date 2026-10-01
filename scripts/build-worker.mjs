import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const buildEnv={...process.env};
try{process.memoryUsage();}catch(error){if(error.code!=='ENOENT')throw error;buildEnv.NODE_OPTIONS=[buildEnv.NODE_OPTIONS,`--require=${fileURLToPath(new URL('./memory-telemetry.cjs',import.meta.url))}`].filter(Boolean).join(' ');}
const result=spawnSync(process.execPath,['scripts/run-framework.mjs','build'],{env:buildEnv,stdio:'inherit'});
if(result.error)throw result.error;process.exit(result.status??1);
