const assert=require('node:assert/strict');
const {solve}=require('../search.js');
const fs=require('node:fs');
const n=['white','red','blue','purple','yellow','orange','green'];
function oracle(board,adj,memo=new Map()){
 const key=board.join('');if(memo.has(key))return memo.get(key);if(board.every(c=>!c))return true;
 const reach=i=>{const seen=new Set([i]),q=[i];for(const x of q)for(const y of adj[x])if(board[y]===board[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 for(let i=0;i<board.length;i++)for(let j=0;j<board.length;j++)if(board[i]&&board[j]&&!(board[i]&board[j])&&reach(i).some(x=>reach(j).some(y=>adj[x].includes(y)))){
 const t=board.slice();t[i]=0;t[j]=(board[i]|board[j])===7?0:board[i]|board[j];if(oracle(t,adj,memo)){memo.set(key,true);return true;}}
 memo.set(key,false);return false;
}
function check(board,adj){let current=board.map(c=>n[c]),history=[],backtracks=0;const search=solve(current,adj);let step;
 while(!(step=search.next()).done){const e=step.value;
 if(e.type==='forward'){assert.deepEqual(current,e.before);assert.equal(e.after[e.sourceIndex],'white');history.push(current);current=e.after;}
 else{assert.deepEqual(current,e.after);assert.deepEqual(history.pop(),e.before);current=e.before;backtracks++;}}
 return {result:step.value,backtracks};
}
let total=0;
for(const adj of [Array.from({length:6},(_,i)=>[i-1,i+1].filter(j=>j>=0&&j<6)),Array.from({length:6},(_,i)=>[(i+1)%6,(i+5)%6]),[[1,2,3,4,5],[0],[0],[0],[0],[0]]]){
 const memo=new Map();for(let code=0;code<729;code++){let v=code,b=[];for(let i=0;i<6;i++){b.push([1,2,4][v%3]);v=Math.floor(v/3);}if([1,2,4].some(c=>b.filter(v=>v===c).length!==2))continue;
 assert.equal(check(b,adj).result==='solved',oracle(b,adj,memo));total++;}}
const data=require('./fixtures.json');assert.equal(check(data.board,data.adj).result,'unsolvable');
// Find a small actual-board case that visibly backtracks before success.
const adj=data.adj;let fixture;
for(let code=0;code<729;code++){let v=code,b=Array(60).fill(0);for(let i=0;i<6;i++){b[i]=[1,2,4][v%3];v=Math.floor(v/3);}if([1,2,4].some(c=>b.filter(v=>v===c).length!==2))continue;const r=check(b,adj);if(r.result==='solved'&&r.backtracks){fixture=b.map(c=>n[c]);break;}}
assert(fixture);assert.deepEqual(fixture,data.backtrack);
console.log(`Passed ${total} exhaustive comparisons; forward/backtrack stack consistency; full-board impossibility certificate.`);
