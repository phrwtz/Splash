const rows=['RRYRBRBY','YYRRRBR','RRBRRYYR','BBYRYBB','BRYBYBYB','YRYYBBB','BRRBRBYY','YRYYBBY'];
const board=rows.join('').split('').map(c=>({R:'red',B:'blue',Y:'yellow'}[c]));
const cells=[];for(let r=0;r<8;r++)for(let c=0;c<(r%2?7:8);c++)cells.push([r,c]);
const adj=cells.map(([r,c])=>cells.flatMap(([s,d],i)=>(r===s?Math.abs(c-d)===1:Math.abs(r-s)===1&&(r%2?[c,c+1]:[c-1,c]).includes(d))?[i]:[]));
module.exports={board,adj};

if(require.main===module){
const assert=require('node:assert/strict');
const names=['white','red','blue','purple','yellow','orange','green'];let current=board.map(c=>names.indexOf(c));
function blob(b,i){const q=[i],seen=new Set(q);for(const x of q)for(const y of adj[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;}
const solve=require('../search.js').solve;
const g=solve(board,adj,{strategyOnly:true,batchGroups:6,sectionRestarts:0});let s,moves=[],events=[],last,start=Date.now();
while(!(s=g.next()).done){last=s.value;if(last.type!=='forward')continue;
assert.deepEqual(last.before,current.map(c=>names[c]));const a=last.sourceIndex,b=last.targetIndex;assert(current[a]&&current[b]&&!(current[a]&current[b]));assert(blob(current,a).some(i=>blob(current,b).some(j=>adj[i].includes(j))));const mixed=current[a]|current[b];current[a]=0;current[b]=mixed===7?0:mixed;assert.deepEqual(last.after,current.map(c=>names[c]));moves.push([a,b]);events.push(last);}
assert.equal(s.value,'solved');assert(current.every(c=>!c));assert.equal(moves.length,40);assert(events.some(e=>e.plan.kind==='verified-continuation'));
const tail=events.filter(e=>e.plan.kind==='verified-continuation');
assert(tail.some((e,i)=>i+1<tail.length&&e.after.filter(c=>c==='green').length>=2));
// A verified endgame remains available when playback is stopped and resumed.
const resume=solve(events[30].before,adj,{strategyOnly:true,batchGroups:6,sectionRestarts:0});
let resumed=0;while(!(s=resume.next()).done){assert.equal(s.value.type,'forward');assert(s.value.plan.continuationVerified);resumed++;}
assert.equal(s.value,'solved');assert.equal(resumed,10);
assert.throws(()=>solve(board,adj,{sectionEndgameStates:-1}).next(),RangeError);
console.log('Passed bridge-building endgame, independent legality, default settings, and cached Stop/resume.');console.log({result:s.value,ms:Date.now()-start,moves:moves.length,positions:last.positions});

}
