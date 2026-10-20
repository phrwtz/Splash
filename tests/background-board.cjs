// User-solved board requiring grouped bridge construction.
const rows=['YYBBYBBY','RBRBYYR','RBBBRBYY','YRRBRYB','BRRBBYRR','YBYRRBR','YRRYBYYY','BRYBRRY'];
const board=rows.join('').split('').map(c=>({R:'red',B:'blue',Y:'yellow'}[c]));
const cells=[];for(let r=0;r<8;r++)for(let c=0;c<(r%2?7:8);c++)cells.push([r,c]);
const adj=cells.map(([r,c])=>cells.flatMap(([s,d],i)=>(r===s?Math.abs(c-d)===1:Math.abs(r-s)===1&&(r%2?[c,c+1]:[c-1,c]).includes(d))?[i]:[]));
module.exports={board,adj};
if(require.main===module){
 const assert=require('node:assert/strict');
 const names=['white','red','blue','purple','yellow','orange','green'];
 const fresh=()=>{delete require.cache[require.resolve('../search.js')];return require('../search.js').solve;};
 const original=board.slice();
 assert.equal(board.length,60);
 for(const color of ['red','blue','yellow'])assert.equal(board.filter(c=>c===color).length,20);
 function blob(b,i){const q=[i],seen=new Set(q);for(const x of q)for(const y of adj[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;}
 function run(){
  const g=fresh()(board,adj,{strategyOnly:true,moveTreeSearch:false,batchGroups:6});
  let current=board.map(c=>names.indexOf(c)),s,moves=[],batches=0,endgame=false;
  const start=Date.now();
  try{while(!(s=g.next()).done){
   assert(Date.now()-start<60000,'Find a complete solution within one minute');
   const e=s.value;assert(!['verification','section-endgame','endgame-check','exploration'].includes(e.phase));
   if(e.type==='forward'&&e.plan.cells.length>1){endgame=true;const roles=e.plan.resources.map(r=>r.role);const clearing=roles.indexOf('clear');assert(clearing>=0);assert(roles.slice(clearing).every(r=>r==='clear'),'Finish building the compound group before any clearing');}
   if(e.type==='batch-ready'){batches++;assert(e.complete);assert.equal(e.moveCount,40);}
   if(e.type!=='forward')continue;
   assert(e.plan.verified&&e.plan.continuationVerified);
   assert.deepEqual(e.before,current.map(c=>names[c]));
   const a=e.sourceIndex,t=e.targetIndex;
   assert(current[a]&&current[t]&&!(current[a]&current[t]));
   assert(blob(current,a).some(i=>blob(current,t).some(j=>adj[i].includes(j))));
   const combined=current[a]|current[t];current[a]=0;current[t]=combined===7?0:combined;
   assert.deepEqual(e.after,current.map(c=>names[c]));moves.push([a,t]);
  }}finally{g.return();}
  assert.equal(s.value,'solved');assert(current.every(c=>!c));assert.equal(moves.length,40);
  assert.equal(batches,1);assert(endgame);assert.deepEqual(board,original);
  return {moves,elapsedMs:Date.now()-start};
 }
 const first=run(),second=run();assert.deepEqual(second.moves,first.moves);
 const cancel=fresh()(board,adj,{strategyOnly:true,batchGroups:6});let s;
 do{s=cancel.next();assert(!s.done);assert.equal(s.value.type,'search');}while(!s.value.objective?.cells?.length);
 cancel.return();assert.deepEqual(board,original);
 console.log(JSON.stringify({result:'solved',moves:first.moves.length,elapsedMs:first.elapsedMs,repeatMs:second.elapsedMs}));
 console.log('Passed pictured bridge board without move-tree search, independent legal replay, fresh-run reproducibility, and cancellation.');
}
