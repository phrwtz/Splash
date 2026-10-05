const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const rows=['BBYBBRYR','YYBYBBR','RBYBRBBR','YYBYYRB','BBYRYRBY','BYYRYBR','RRRYRBRY','RRBRRYY'];
const board=rows.join('').split('').map(c=>({B:'blue',R:'red',Y:'yellow'}[c]));
const cells=[];for(let r=0;r<8;r++)for(let c=0;c<(r%2?7:8);c++)cells.push([r,c]);
const adj=cells.map(([r,c])=>cells.flatMap(([s,d],i)=>(r===s?Math.abs(c-d)===1:Math.abs(r-s)===1&&(r%2?[c,c+1]:[c-1,c]).includes(d))?[i]:[]));
module.exports={board,adj};
const names=['white','red','blue','purple','yellow','orange','green'];
function fresh(){const context={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(require.resolve('../search.js'),'utf8'),context);return context.module.exports;}
// Independent legality check: only same-color connectivity and disjoint color
// components, with no calls to solver assessment, scoring, or move generation.
function apply(b,a,e){
 const source=e.sourceIndex,target=e.targetIndex,c=b[source],d=b[target];
 assert(c&&d&&!(c&d));
 const blob=i=>{const q=[i],seen=new Set(q);for(const x of q)for(const y of a[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 assert(blob(source).some(x=>blob(target).some(y=>a[x].includes(y))),'Transfer must link actual blobs');
 const next=b.slice();next[source]=0;next[target]=(c|d)===7?0:c|d;return next;
}
if(require.main===module){
 assert.equal(board.length,60);for(const color of ['red','blue','yellow'])assert.equal(board.filter(c=>c===color).length,20);
 for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
  const permute=c=>[1,2,4].reduce((n,bit,i)=>n|(c&bit?bits[i]:0),0);
  const tiles=board.map(c=>names[permute(names.indexOf(c))]),snapshot=tiles.slice();
  const g=fresh().solve(tiles,adj,{strategyOnly:true,batchGroups:6,sectionEndgameStates:0});
  let s,current=tiles.map(c=>names.indexOf(c)),moves=0,last,comparisons=0,batches=0;const start=Date.now();
  while(!(s=g.next()).done){const e=s.value;
   assert(Date.now()-start<15000,'Challenge must complete within 15 seconds');
   assert(!['verification','exploration'].includes(e.phase));
   if(e.sectionWidth)comparisons++;
   if(e.type==='batch-ready'){batches++;assert(e.complete);assert.equal(e.groupsCleared,20);}
   if(e.type==='forward'){
    assert.deepEqual(Array.from(e.before),current.map(c=>names[c]));
    assert(e.plan.verified&&e.plan.continuationVerified);assert.equal(e.plan.kind,'clear-secondary');
    current=apply(current,adj,e);assert.deepEqual(Array.from(e.after),current.map(c=>names[c]));moves++;
   }
   last=e;
  }
  assert.equal(s.value,'solved');assert.equal(moves,40);assert.equal(batches,1);assert(comparisons);assert(current.every(c=>!c));assert.deepEqual(tiles,snapshot);
  console.log(JSON.stringify({permutation:bits,result:s.value,moves,elapsedMs:Date.now()-start}));
 }
 // This balanced section needs a different earlier clearance: the narrow
 // frontier stalls, while retaining eight alternatives finds a full solution.
 const branching='YYBRBRRYRYYBYYBBYRRYRBBYBRRB'.split('');
 // Explicit 30-cell fixture, including its last red/blue pair.
 const branchTiles=[...branching,'R','B'].map(c=>({R:'red',B:'blue',Y:'yellow'}[c]));
 branchTiles.push(...Array(30).fill('white'));
 const branchOptions={sectionEndgameStates:0,sectionStates:20000,strategyStates:20000,localStates:0,layoutLimit:0,stopBeforeExhaustive:true};
 let narrow=fresh().solve(branchTiles,adj,{...branchOptions,sectionWidth:1}),branchStep;
 while(!(branchStep=narrow.next()).done)assert.notEqual(branchStep.value.type,'forward');
 assert.equal(branchStep.value,'paused');
 const wide=fresh().solve(branchTiles,adj,{...branchOptions,sectionWidth:8});
 let residual=branchTiles.map(c=>names.indexOf(c)),usedWide=false,branchMoves=0;
 while(!(branchStep=wide.next()).done){const e=branchStep.value;if(e.sectionWidth===8)usedWide=true;
  if(e.type==='forward'){residual=apply(residual,adj,e);branchMoves++;assert(e.plan.continuationVerified);}}
 assert.equal(branchStep.value,'solved');assert(usedWide);assert.equal(branchMoves,20);assert(residual.every(c=>!c));
 // A tiny budget is inconclusive and returns to existing group planning.
 const limited=fresh().solve(board,adj,{sectionStates:1,strategyStates:1,localStates:0,layoutLimit:0,stopBeforeExhaustive:true});
 let step;while(!(step=limited.next()).done)assert.notEqual(step.value.type,'forward');assert.equal(step.value,'paused');
 // Cancellation during the new planning pass neither plays nor mutates tiles.
 const cancelled=fresh().solve(board,adj,{strategyOnly:true});let event;
 do{event=cancelled.next();assert(!event.done);assert.equal(event.value.type,'search');}while(!event.value.sectionWidth);
 cancelled.return();assert.deepEqual(board,rows.join('').split('').map(c=>({B:'blue',R:'red',Y:'yellow'}[c])));
 const disabled=fresh().solve(board,adj,{sectionStates:0,strategyStates:1,localStates:0,layoutLimit:0,stopBeforeExhaustive:true});
 while(!(step=disabled.next()).done){assert(!step.value.sectionWidth);assert.notEqual(step.value.type,'forward');}assert.equal(step.value,'paused');
 console.log('Passed challenge permutations, independent replay, full continuation, cancellation, disabled pass, and unknown-on-budget-exhaustion.');
}
