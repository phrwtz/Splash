const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {board,adj}=require('./interacting-bridge-board.cjs');
const source=fs.readFileSync(require.resolve('../search.js'),'utf8').replace(
  'function* exact(b,budget=null,sleep=[]) {',
  'function* exact(b,budget=null,sleep=[]) {throw Error("Auto Play must never enter individual-move search");');
function fresh(){const context={module:{exports:{}}};vm.runInNewContext(source,context);return context.module.exports;}
const names=['white','red','blue','purple','yellow','orange','green'];
function replay(deal,graph,options={}){
 const initial=deal.slice(),search=fresh().solve(deal,graph,{hybrid:true,beamSearch:false,diagnosticSearch:false,...options});
 let b=deal.map(c=>names.indexOf(c)),step,moves=0,largestBridge=0,interleaved=false,start=Date.now();
 const blob=i=>{const q=[i],seen=new Set(q);for(const x of q)for(const y of graph[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 try{while(!(step=search.next()).done){
  assert(Date.now()-start<60000,'Find a verified continuation within one minute');
  const e=step.value;assert(!['verification','complete-search','section-endgame','endgame-check','exploration'].includes(e.phase));
  if(e.type!=='forward')continue;
  assert(e.plan.verified&&e.plan.continuationVerified,'Only complete verified solutions may play');
  assert.deepEqual(Array.from(e.before),b.map(c=>names[c]));
  const i=e.sourceIndex,j=e.targetIndex;assert(b[i]&&b[j]&&!(b[i]&b[j]));
  const target=new Set(blob(j));assert(blob(i).some(x=>graph[x].some(y=>target.has(y))));
  const mixed=b[i]|b[j];b[i]=0;b[j]=mixed===7?0:mixed;
  assert.deepEqual(Array.from(e.after),b.map(c=>names[c]));moves++;
  largestBridge=Math.max(largestBridge,e.plan.cells.length);
  if(e.plan.resources.some(r=>r.role==='helper'&&r.step===e.plan.step)&&e.before.includes(e.plan.color))interleaved=true;
 }}finally{search.return();}
 assert.equal(step.value,'solved');assert(b.every(c=>!c));assert.deepEqual(deal,initial);
 return {moves,largestBridge,interleaved,elapsedMs:Date.now()-start};
}
const result=replay(board,adj);assert.equal(result.moves,40);assert(result.largestBridge>6);
console.log('PASS: unscripted 1,000-minute screenshot, legal independent replay, large bridge, no exact search:',result);
// This explicit long job also protects against introducing a new bridge-size
// cap: seven receivers must stay connected until the yellow supply can clear.
const n=7,primary=Array(n).fill('red').concat(Array(n).fill('blue'),Array(n).fill('yellow'));
const graph=primary.map(()=>[]),link=(i,j)=>{graph[i].push(j);graph[j].push(i);};
for(let k=0;k<n-1;k++){link(k,k+1);link(n+k,n+k+1);link(2*n+k,2*n+k+1);}
link(n-1,n);link(0,2*n);
assert.equal(replay(primary,graph).moves,14);
const cancel=fresh().solve(board,adj,{hybrid:true,beamSearch:false,diagnosticSearch:false,quickPlanMs:0});assert.equal(cancel.next().value.phase,'bridge-planning');cancel.return();assert.deepEqual(board,require('./interacting-bridge-board.cjs').board);
console.log('PASS: seven-cell construction, cancellation, and unchanged input.');

// A general mixed-color job, separate from the screenshot: a helper clearance
// runs while a different-color bridge remains occupied.
const mixed={board:['red','yellow','blue','yellow','blue','blue','red','red','yellow','yellow','blue','red'],adj:[[1,5],[0,2,10],[1,3],[2,4],[3,5],[0,4,6,7],[5,7,9],[5,6,8],[7,9,11],[6,8,10],[1,9,11],[8,10]]};
const interleaved=replay(mixed.board,mixed.adj,{quickPlanMs:0});assert.equal(interleaved.moves,8);assert(interleaved.interleaved);
const bad=fresh().solve(['red'],[[]],{hybrid:true});let step;while(!(step=bad.next()).done){}assert.equal(step.value,'unsolvable');
console.log('PASS: other-color clearance while a bridge remains active, and structural impossibility handling.');

// The same challenge under changed color identities and board orientation
// must be discovered again, rather than matching a stored board or opening.
const rotate={red:'blue',blue:'yellow',yellow:'red'};
assert.equal(replay(board.map(c=>rotate[c]),adj).moves,40);
const reflected=require('./interacting-bridge-board.cjs').rows.map(row=>[...row].reverse().join('')).join('').split('').map(c=>({R:'red',B:'blue',Y:'yellow'}[c]));
assert.equal(replay(reflected,adj).moves,40);
console.log('PASS: color-rotated and reflected challenge boards, with fresh guarded solvers and independent replay.');
