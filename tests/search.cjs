const assert=require('node:assert/strict');
const {solve,assess}=require('../search.js');
const fs=require('node:fs');
const n=['white','red','blue','purple','yellow','orange','green'];
function oracle(board,adj,memo=new Map()){
 const key=board.join('');if(memo.has(key))return memo.get(key);if(board.every(c=>!c))return true;
 const reach=i=>{const seen=new Set([i]),q=[i];for(const x of q)for(const y of adj[x])if(board[y]===board[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 for(let i=0;i<board.length;i++)for(let j=0;j<board.length;j++)if(board[i]&&board[j]&&!(board[i]&board[j])&&reach(i).some(x=>reach(j).some(y=>adj[x].includes(y)))){
 const t=board.slice();t[i]=0;t[j]=(board[i]|board[j])===7?0:board[i]|board[j];if(oracle(t,adj,memo)){memo.set(key,true);return true;}}
 memo.set(key,false);return false;
}
function check(board,adj){let current=board.map(c=>n[c]),history=[],backtracks=0,skipped=0;const search=solve(current,adj);let step;
 while(!(step=search.next()).done){const e=step.value;
 if(e.type==='search'){skipped++;continue;}
 if(e.type==='forward'){assert.deepEqual(current,e.before);assert.equal(e.after[e.sourceIndex],'white');
 // A visible successor must pass independent occupied-component balance.
 const unseen=new Set(e.after.flatMap((c,i)=>c==='white'?[]:[i]));
 while(unseen.size){const group=[unseen.values().next().value];unseen.delete(group[0]);for(const i of group)for(const j of adj[i])if(unseen.delete(j))group.push(j);
 const counts=[1,2,4].map(bit=>group.reduce((sum,i)=>sum+!!(n.indexOf(e.after[i])&bit),0));assert.equal(counts[0],counts[1]);assert.equal(counts[0],counts[2]);}
 history.push(current);current=e.after;}
 else{assert.deepEqual(current,e.after);assert.deepEqual(history.pop(),e.before);current=e.before;backtracks++;}}
 return {result:step.value,backtracks,skipped};
}
let total=0;
for(const adj of [Array.from({length:6},(_,i)=>[i-1,i+1].filter(j=>j>=0&&j<6)),Array.from({length:6},(_,i)=>[(i+1)%6,(i+5)%6]),[[1,2,3,4,5],[0],[0],[0],[0],[0]]]){
 const memo=new Map();for(let code=0;code<729;code++){let v=code,b=[];for(let i=0;i<6;i++){b.push([1,2,4][v%3]);v=Math.floor(v/3);}if([1,2,4].some(c=>b.filter(v=>v===c).length!==2))continue;
 assert.equal(check(b,adj).result==='solved',oracle(b,adj,memo));total++;}}
const data=require('./fixtures.json');assert.equal(check(data.board,data.adj).result,'unsolvable');
// An unrelated, legal mix outside the blue barrier must not disable the
// corner-red proof just because the board now contains an orange tile.
const mixedCounter=data.board.slice();mixedCounter[19]=0;mixedCounter[26]=5;
assert.deepEqual(assess(mixedCounter.map(c=>n[c]),data.adj),{unsolvable:true,reason:{type:'trapped-primary',tile:0,color:'red'}});
assert.deepEqual(solve(mixedCounter.map(c=>n[c]),data.adj).next(),{done:true,value:'unsolvable'});
// Three yellows inside the barrier are enough to pass this necessary check.
// Consuming the extra yellow against a boundary blue reinstates the trap.
const beforeTrap=data.board.slice();beforeTrap[3]=4;beforeTrap[26]=1;
assert.equal(assess(beforeTrap.map(c=>n[c]),data.adj).unsolvable,false);
const afterTrap=beforeTrap.slice();afterTrap[3]=0;afterTrap[4]=6;
assert.equal(assess(afterTrap.map(c=>n[c]),data.adj).reason.type,'trapped-primary');
// Both purple regions individually see a yellow, but it is the SAME yellow.
const sharedBoard=[3,3,4,6,1,4],sharedAdj=[[2],[2],[0,1,3],[2,4,5],[3],[3]];
assert.equal(oracle(sharedBoard,sharedAdj),false);
assert.equal(assess(sharedBoard.map(c=>n[c]),sharedAdj).reason.type,'shared-complement-shortage');
// This fixture used to animate a doomed move before immediately undoing it.
const regression=check(data.backtrack.map(c=>n.indexOf(c)),data.adj);
assert.equal(regression.result,'solved');assert(regression.skipped>0);
// Balanced and physically connected, with legal moves elsewhere, but the
// orange cannot ever join an orange blob touching blue.
const path=Array.from({length:6},(_,i)=>[i-1,i+1].filter(j=>j>=0&&j<6));
const trapped=[5,3,6,1,2,4];assert.equal(oracle(trapped,path),false);
const rejected=solve(trapped.map(c=>n[c]),path).next();assert(rejected.done);assert.equal(rejected.value,'unsolvable');
// Compare mixed boards as well: the new secondary proof must never discard
// a solution. Exhaust every balanced coloring on a four-cell cycle.
const cycle4=[[1,3],[0,2],[1,3],[0,2]];const mixedMemo=new Map();
for(let code=0;code<2401;code++){
 let v=code,b=[];for(let i=0;i<4;i++){b.push(v%7);v=Math.floor(v/7);}
 const totals=[1,2,4].map(bit=>b.reduce((sum,c)=>sum+!!(c&bit),0));
 if(totals[0]!==totals[1]||totals[0]!==totals[2])continue;
 assert.equal(check(b,cycle4).result==='solved',oracle(b,cycle4,mixedMemo));total++;
}
// Full mixed-color coverage on six-cell graphs protects against unsafe
// shortcuts in the generalized primary and shared-resource checks.
for(const adj of [path,[[1,5],[0,2],[1,3],[2,4],[3,5],[4,0]]]){
 const memo=new Map();
 for(let code=0;code<117649;code++){
  let v=code,b=[];for(let i=0;i<6;i++){b.push(v%7);v=Math.floor(v/7);}
  const totals=[1,2,4].map(bit=>b.reduce((sum,c)=>sum+!!(c&bit),0));
  if(totals[0]!==totals[1]||totals[0]!==totals[2])continue;
  assert.equal(check(b,adj).result==='solved',oracle(b,adj,memo),JSON.stringify(b));total++;
 }
}
console.log(`Passed ${total} exhaustive comparisons; mixed-board traps, shared supplies, and forward/backtrack consistency.`);
