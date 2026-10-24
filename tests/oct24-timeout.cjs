// Original timed-out deals only: no openings, cached solutions, or move hints.
const assert=require('node:assert/strict'),{Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const boards=require('./oct24-timeout-boards.json');
if(!isMainThread){
 const {solve}=require('../search.js'),names=['white','red','blue','purple','yellow','orange','green'];
 const cells=[];for(let r=0;r<8;r++)for(let c=0;c<(r%2?7:8);c++)cells.push([r,c]);
 const adj=cells.map(([r,c])=>cells.flatMap(([s,d],i)=>((2*c+r%2)-(2*d+s%2))**2+3*(r-s)**2===4?[i]:[]));
 const b=workerData,current=b.tiles.slice(),search=solve(b.tiles,adj,{hybrid:true,...JSON.parse(process.env.SPLASH_SEARCH_OPTIONS||'{}')});let moves=0,computeMs=0,step,beam=false,maxStep=0,lastReport=0;
 const blob=i=>{const q=[i],seen=new Set(q);for(const x of q)for(const y of adj[x])if(current[y]===current[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 try{for(;;){const started=performance.now();step=search.next();const elapsed=performance.now()-started;computeMs+=elapsed;maxStep=Math.max(maxStep,elapsed);assert(computeMs<300000,`Board ${b.id}: five-minute computation timeout`);if(step.done)break;const e=step.value;if(computeMs-lastReport>=30000){parentPort.postMessage({progress:true,id:b.id,computeMs:Math.round(computeMs),phase:e.phase,positions:e.positions});lastReport=computeMs;}beam||=e.phase==='beam-planning';if(e.type!=='forward')continue;
 assert(e.plan.verified&&e.plan.continuationVerified);assert.deepEqual(e.before,current);const i=e.sourceIndex,j=e.targetIndex,sc=names.indexOf(current[i]),tc=names.indexOf(current[j]);assert(sc&&tc&&!(sc&tc));const target=new Set(blob(j));assert(blob(i).some(x=>adj[x].some(y=>target.has(y))));current[i]='white';current[j]=names[(sc|tc)===7?0:sc|tc];assert.deepEqual(e.after,current);moves++;}
 assert.equal(step.value,'solved');assert.equal(moves,40);assert(current.every(c=>c==='white'));parentPort.postMessage({id:b.id,moves,computeMs:Math.round(computeMs),maxStep:Math.round(maxStep)});
 }finally{search.return();}
}else{
 const slots=Number(process.env.SPLASH_TEST_JOBS||2);assert(Number.isSafeInteger(slots)&&slots>0&&slots<=8);
 const selected=process.argv[2]?boards.filter(b=>process.argv[2].split(',').map(Number).includes(b.id)):boards;let cursor=0;const results=[];
 async function slot(){while(cursor<selected.length){const board=selected[cursor++];await new Promise((resolve,reject)=>{const w=new Worker(__filename,{workerData:board,resourceLimits:{maxOldGenerationSizeMb:384}});w.on('message',m=>{if(!m.progress)results.push(m);console.log(JSON.stringify(m));});w.on('error',reject);w.on('exit',code=>code?reject(Error(`Worker ${board.id} exited ${code}`)):resolve());});}}
 Promise.all(Array.from({length:slots},slot)).then(()=>{require('node:fs').writeFileSync(process.env.SPLASH_BENCHMARK_OUTPUT||'/tmp/splash-oct24-benchmark.json',JSON.stringify(results,null,2));console.log(`PASS: ${results.length} formerly timed-out boards solved and independently replayed within the five-minute computation budget.`);}).catch(e=>{console.error(e);process.exit(1)});
}
