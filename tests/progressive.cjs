const assert=require('node:assert/strict');
const {solve}=require('../search.js');
const names=['white','red','blue','purple','yellow','orange','green'];
function oracle(b,adj,memo=new Map()){
 const key=b.join('');if(memo.has(key))return memo.get(key);if(b.every(c=>!c))return true;
 const blob=i=>{const q=[i],seen=new Set(q);for(const x of q)for(const y of adj[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 for(let i=0;i<b.length;i++)for(let j=0;j<b.length;j++)if(b[i]&&b[j]&&!(b[i]&b[j])&&blob(i).some(x=>blob(j).some(y=>adj[x].includes(y)))){
  const next=b.slice();next[i]=0;next[j]=(b[i]|b[j])===7?0:b[i]|b[j];
  if(oracle(next,adj,memo)){memo.set(key,true);return true;}
 }memo.set(key,false);return false;
}
let undos=0,total=0;
function run(b,adj){
 let current=b.map(c=>names[c]),history=[],step;const initial=current.slice();
 const g=solve(current,adj,{progressive:true,strategyStates:0,bridgeStates:0});
 while(!(step=g.next()).done){const e=step.value;if(e.type==='search')continue;
  if(e.type==='backtrack'){assert.deepEqual(current,e.after);assert.deepEqual(history.pop(),e.before);current=e.before;undos++;continue;}
  assert.deepEqual(current,e.before);
  const a=e.sourceIndex,t=e.targetIndex,bits=current.map(c=>names.indexOf(c));
  const blob=i=>{const q=[i],seen=new Set(q);for(const x of q)for(const y of adj[x])if(bits[y]===bits[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
  assert(bits[a]&&bits[t]&&!(bits[a]&bits[t]));assert(blob(a).some(x=>blob(t).some(y=>adj[x].includes(y))));
  const next=bits.slice();next[a]=0;next[t]=(bits[a]|bits[t])===7?0:bits[a]|bits[t];
  assert.deepEqual(e.after,next.map(c=>names[c]));history.push(current);current=e.after;
 }
 assert.equal(step.value==='solved',oracle(b,adj));
 if(step.value==='solved')assert(current.every(c=>c==='white'));else assert.deepEqual(current,initial);
 total++;
}
let seed=417;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
for(let k=0;k<1500;k++){
 const n=6+rand(3),adj=Array.from({length:n},()=>[]);
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(rand(4)===0){adj[i].push(j);adj[j].push(i);}
 run(Array.from({length:n},()=>1+rand(6)),adj);
}
// Every balanced primary coloring on three independent graph shapes.
for(const adj of [Array.from({length:6},(_,i)=>[i-1,i+1].filter(j=>j>=0&&j<6)),Array.from({length:6},(_,i)=>[(i+1)%6,(i+5)%6]),[[1,2,3,4,5],[0],[0],[0],[0],[0]]]){
 for(let code=0;code<729;code++){
  let v=code,b=[];for(let i=0;i<6;i++){b.push([1,2,4][v%3]);v=Math.floor(v/3);}
  if([1,2,4].every(c=>b.filter(x=>x===c).length===2))run(b,adj);
 }
}
// A known hard board must animate within a bounded amount of planning work.
for(const fixture of ['purple-strategy','yellow-bridge','pocket-priority']){
 delete require.cache[require.resolve('../search.js')];const solver=require('../search.js').solve;
 const {board,adj}=require(`./${fixture}.cjs`);const g=solver(board,adj,{progressive:true});let e,last;
 do{e=g.next();assert(!e.done,'Expected a promising move');if(e.value.type==='search')last=e.value;assert((last?.positions||0)<20000,'First animation must have bounded planning work');}while(e.value.type==='search');
 assert.equal(e.value.type,'forward');g.return();
}
// Stopping after a speculative move resumes from that board and legal history.
const {board,adj}=require('./purple-strategy.cjs');const g=solve(board,adj,{progressive:true,strategyStates:0});let first;
do{first=g.next();}while(first.value.type==='search');g.return();
const resumed=solve(first.value.after,adj,{progressive:true,strategyStates:0,history:[{tiles:first.value.before}]});
let next=resumed.next();while(next.value?.type==='search')next=resumed.next();assert(!next.done);resumed.return();
// The historical trap requires an actual speculative reversal. Validate its
// entire visible prefix and exact restoration at the first proved dead end.
{
 const {board,adj}=require('./backtrack-trap.cjs');
 let current=board.slice(),stack=[],step,back=false;
 const g=solve(board,adj,{progressive:true,strategyStates:0});
 for(let checkpoints=0;checkpoints<2000;checkpoints++){
  step=g.next();assert(!step.done);const e=step.value;
  if(e.type==='search')continue;
  if(e.type==='forward'){assert.deepEqual(current,e.before);stack.push(current);current=e.after;}
  else{assert.deepEqual(current,e.after);assert.deepEqual(stack.pop(),e.before);current=e.before;back=true;undos++;break;}
 }
 g.return();assert(back,'Must exercise a real failed speculative branch');
}
console.log(`Passed ${total} progressive oracle comparisons, ${undos} reversible dead-end undos, first-move and resume checks.`);
