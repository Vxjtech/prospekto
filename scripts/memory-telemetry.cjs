const v8=require('node:v8');
const original=process.memoryUsage;
try{original();}catch(error){
  if(error.code!=='ENOENT')throw error;
  const rss=()=>process.resourceUsage().maxRSS*1024;
  process.memoryUsage=()=>{const heap=v8.getHeapStatistics();return {rss:rss(),heapTotal:heap.total_heap_size,heapUsed:heap.used_heap_size,external:heap.external_memory,arrayBuffers:0};};
  process.memoryUsage.rss=rss;
}
