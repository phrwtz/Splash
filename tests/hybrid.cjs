const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../search.js'),'utf8');let now=0;
const ctx={module:{exports:{}},Date:{now:()=>{now+=100;return now;}}};vm.runInNewContext(source,ctx);
const b=['red','blue','yellow'],adj=[[1],[0,2],[1]],g=ctx.module.exports.solve(b,adj,{hybrid:true,restartAfterMs:1,strategyStates:0,sectionStates:0});let step,complete=false,restarts=0,moves=0;
while(!(step=g.next()).done){if(step.value.phase==='complete-search')complete=true;if(step.value.restart)restarts++;if(step.value.type==='forward')moves++;assert.notEqual(step.value.type,'exhaustive-required');}
assert.equal(step.value,'solved');assert(complete);assert.equal(restarts,5);assert.equal(moves,2);assert.deepEqual(b,['red','blue','yellow']);
const bad=ctx.module.exports.solve(['red'],[[]],{hybrid:true,strategicAttempts:0});let end;while(!(end=bad.next()).done){}assert.equal(end.value,'unsolvable');
const cancel=ctx.module.exports.solve(b,adj,{hybrid:true,strategicAttempts:0});assert.equal(cancel.next().value.phase,'complete-search');cancel.return();
console.log('Passed strategic escalation, complete solution/proof, cancellation, and unchanged input.');
