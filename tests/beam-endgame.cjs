const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../search.js'),'utf8').replace('const root=Array(14).fill(0);','globalThis.tailForTest=exactTail;const root=Array(14).fill(0);').replace('return {solve,assess,exportProofCache,restoreProofCache}','return {solve,beamSolve,assess,exportProofCache,restoreProofCache}');
const names=['white','red','blue','purple','yellow','orange','green'];let seed=823;
const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
function oracle(initial,adj){const dead=new Set();function visit(b){if(b.every(c=>!c))return true;const key=b.join('');if(dead.has(key))return false;const gs=[],seen=new Set();for(let i=0;i<b.length;i++){if(!b[i]||seen.has(i))continue;const q=[i];seen.add(i);for(const x of q)for(const y of adj[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}gs.push(q);}for(let a=0;a<gs.length;a++)for(let d=a+1;d<gs.length;d++){const g=gs[a],h=gs[d];if((b[g[0]]&b[h[0]])||!g.some(x=>adj[x].some(y=>h.includes(y))))continue;for(const x of g)for(const y of h)for(const [i,j]of [[x,y],[y,x]]){const next=b.slice(),mix=b[i]|b[j];next[i]=0;next[j]=mix===7?0:mix;if(visit(next))return true;}}dead.add(key);return false;}return visit(initial);}
let solved=0,failed=0;
for(let t=0;t<120;t++){
 const size=[3,6,9][t%3],indices=t%2?[0,1,2,3,4,5,6,7,8].slice(0,size):[0,1,29,30,31,32,57,58,59].slice(0,size),adj=Array.from({length:60},()=>[]),b=Array(60).fill(0),colors=Array.from({length:size},(_,i)=>[1,2,4][i%3]);
 for(let i=colors.length-1;i>0;i--){const j=random(i+1);[colors[i],colors[j]]=[colors[j],colors[i]];}
 indices.forEach((x,i)=>{b[x]=colors[i];for(let j=0;j<i;j++)if(i===j+1||random(4)===0){adj[x].push(indices[j]);adj[indices[j]].push(x);}});
 if(t%5===0){b[indices[0]]=3;b[indices[1]]=4;b[indices[2]]=0;}
 const expected=oracle(b,adj),ctx={module:{exports:{}}};vm.runInNewContext(source,ctx);
 const setup=ctx.module.exports.beamSolve(b.map(c=>names[c]),adj,{adaptiveTail:true,width:128,seed:500,clear:30,group:2,noise:150});setup.next();
 const packed=Array(14).fill(0);b.forEach((c,i)=>{if(c)packed[c*2+(i<30?0:1)]|=1<<(i%30);});
 const interrupted=ctx.tailForTest(packed,{left:0},null);assert.equal(interrupted.next().value,undefined);
 const g=ctx.tailForTest(packed,{left:50000},null);let step;while(!(step=g.next()).done)assert.equal(step.value.type,'search');assert.notEqual(step.value,undefined);assert.equal(step.value!==null,expected,`case ${t}`);setup.return();expected?solved++:failed++;
}
console.log(`PASS: bounded beam endgames match 120 independent exhaustive cases (${solved} solvable, ${failed} impossible), including mixed colors, disconnected components, high bitset indices, and zero-budget cache safety.`);
