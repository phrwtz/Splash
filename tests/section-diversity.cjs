const rows=['RBYRRRRR','BBYBYYR','YRBRRRYB','YBYYYRR','BYYBYYYB','RRYYBRY','BBYRBBRR','BRBBYBB'];
const board=rows.join('').split('').map(c=>({R:'red',B:'blue',Y:'yellow'}[c]));
const cells=[];for(let r=0;r<8;r++)for(let c=0;c<(r%2?7:8);c++)cells.push([r,c]);
const adj=cells.map(([r,c])=>cells.flatMap(([s,d],i)=>(r===s?Math.abs(c-d)===1:Math.abs(r-s)===1&&(r%2?[c,c+1]:[c-1,c]).includes(d))?[i]:[]));
module.exports={board,adj};

if(require.main===module){
 const assert=require('node:assert/strict');
 const names=['white','red','blue','purple','yellow','orange','green'];
 function fresh(){delete require.cache[require.resolve('../search.js')];return require('../search.js').solve;}
 function blob(b,i){const q=[i],seen=new Set(q);for(const x of q)for(const y of adj[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;}
 function run(){
  const g=fresh()(board,adj,{strategyOnly:true,batchGroups:6}),seeds=new Set(),moves=[];
  let s,b=board.map(c=>names.indexOf(c)),batches=0;const start=Date.now();
  while(!(s=g.next()).done){
   assert(Date.now()-start<30000,'Ranked retries should solve within 30 seconds');
   const e=s.value;if(e.sectionSeed)seeds.add(e.sectionSeed);
   assert.equal(e.plansTried||0,0,'Find a complete section solution before group layouts');
   if(e.type==='batch-ready'){batches++;assert(e.complete);assert.equal(e.moveCount,40);}
   if(e.type!=='forward')continue;
   assert(e.plan.verified&&e.plan.continuationVerified);assert.deepEqual(e.before,b.map(c=>names[c]));
   const a=e.sourceIndex,t=e.targetIndex;assert(b[a]&&b[t]&&!(b[a]&b[t]));
   assert(blob(b,a).some(i=>blob(b,t).some(j=>adj[i].includes(j))));
   const mixed=b[a]|b[t];b[a]=0;b[t]=mixed===7?0:mixed;
   assert.deepEqual(e.after,b.map(c=>names[c]));moves.push([a,t]);
  }
  assert.equal(s.value,'solved');assert(b.every(c=>!c));assert.equal(moves.length,40);assert.equal(batches,1);assert(seeds.size>0);
  return {moves,seeds:[...seeds],ms:Date.now()-start};
 }
 const snapshot=board.slice(),first=run(),second=run();assert.deepEqual(second.moves,first.moves);assert.deepEqual(second.seeds,first.seeds);assert.deepEqual(board,snapshot);
 const cancelled=fresh()(board,adj,{strategyOnly:true,batchGroups:6});let s;
 do{s=cancelled.next();assert(!s.done);assert.equal(s.value.type,'search');}while(!s.value.sectionSeed);
 cancelled.return();assert.deepEqual(board,snapshot);
 const disabled=fresh()(board,adj,{strategyOnly:true,sectionRestarts:0,sectionStates:1,strategyStates:1,localStates:0,layoutLimit:0});
 for(let i=0;i<20;i++){s=disabled.next();assert(!s.done);assert(!s.value.sectionSeed);}disabled.return();
 const limited=fresh()(board,adj,{sectionStates:1,strategyStates:1,sectionRestarts:16,localStates:0,layoutLimit:0,stopBeforeExhaustive:true});
 while(!(s=limited.next()).done)assert.notEqual(s.value.type,'forward');assert.equal(s.value,'paused');
 assert.throws(()=>fresh()(board,adj,{sectionRestarts:-1}).next(),RangeError);
 console.log(JSON.stringify({result:'solved',moves:first.moves.length,seeds:first.seeds,elapsedMs:first.ms}));
 console.log('Passed diversified default search, independent legal replay, reproducibility, cancellation, disabled retries, and unknown on exhausted budgets.');
}
