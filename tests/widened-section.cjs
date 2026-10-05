const rows=['YBBRBYBB','BBYBRBB','RYYBRYRY','YRYRRBB','YYRBYBRB','YBRYBBY','RRYYRYRR','BRRRYYR'];
const board=rows.join('').split('').map(c=>({R:'red',B:'blue',Y:'yellow'}[c]));
const cells=[];for(let r=0;r<8;r++)for(let c=0;c<(r%2?7:8);c++)cells.push([r,c]);
const adj=cells.map(([r,c])=>cells.flatMap(([s,d],i)=>(r===s?Math.abs(c-d)===1:Math.abs(r-s)===1&&(r%2?[c,c+1]:[c-1,c]).includes(d))?[i]:[]));
module.exports={board,adj};

if(require.main===module){
 const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
 function fresh(){const ctx={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(require.resolve('../search.js'),'utf8'),ctx);return ctx.module.exports.solve;}
 const names=['white','red','blue','purple','yellow','orange','green'];
 function blob(b,i){const q=[i],seen=new Set(q);for(const x of q)for(const y of adj[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;}
 const original=board.slice(),start=Date.now(),widths=new Set();
 const g=fresh()(board,adj,{strategyOnly:true,batchGroups:6,sectionEndgameStates:0});
 let s,current=board.map(c=>names.indexOf(c)),moves=0,batches=0;
 while(!(s=g.next()).done){
  const e=s.value;assert(Date.now()-start<60000,'Default planning should solve within 60 seconds');
  if(e.sectionWidth)widths.add(e.sectionWidth);
  assert.equal(e.plansTried||0,0,'Solve before entering group-layout search');
  if(e.type==='batch-ready'){batches++;assert(e.complete);assert.equal(e.groupsCleared,20);}
  if(e.type!=='forward')continue;
  assert(e.plan.verified&&e.plan.continuationVerified);
  assert.deepEqual(Array.from(e.before),current.map(c=>names[c]));
  const a=e.sourceIndex,b=e.targetIndex;
  assert(current[a]&&current[b]&&!(current[a]&current[b]));
  assert(blob(current,a).some(i=>blob(current,b).some(j=>adj[i].includes(j))));
  const mixed=current[a]|current[b];current[a]=0;current[b]=mixed===7?0:mixed;
  assert.deepEqual(Array.from(e.after),current.map(c=>names[c]));moves++;
 }
 assert.equal(s.value,'solved');assert(current.every(c=>!c));assert.equal(moves,40);assert.equal(batches,1);
 assert(widths.has(16)&&widths.has(32));assert.deepEqual(board,original);
 const cancel=fresh()(board,adj,{strategyOnly:true,batchGroups:6,sectionEndgameStates:0});
 do{s=cancel.next();assert(!s.done);assert.equal(s.value.type,'search');}while(s.value.sectionWidth!==16);
 cancel.return();assert.deepEqual(board,original);
 const disabled=fresh()(board,adj,{strategyOnly:true,sectionStates:0,strategyStates:1,localStates:0,layoutLimit:0});
 for(let i=0;i<10;i++){s=disabled.next();assert(!s.done);assert(!s.value.sectionWidth);}disabled.return();
 console.log(JSON.stringify({result:'solved',moves,widths:[...widths],elapsedMs:Date.now()-start}));
 console.log('Passed wider default planning, independent legal replay, cancellation during widening, and disabled section planning.');
}
