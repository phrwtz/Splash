const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let now=0,variants=[],closed=0;
const src=fs.readFileSync(require.resolve('../search.js'),'utf8').replace('  // Restart strategic planning',`  solveAttempt=function*(tiles,adj,options){
    variants.push(options.planningVariant);
    try{
      if(options.planningVariant===0){now+=5;yield {type:'search',phase:'planning',tiles};while(true){now+=5;yield {type:'search',phase:'planning',tiles};}}
      yield {type:'forward',before:tiles,after:['white','white','white']};
      return 'solved';
    }finally{closed++;}
  };
  // Restart strategic planning`);
const ctx={module:{exports:{}},Date:{now:()=>now},variants};Object.defineProperty(ctx,'now',{get:()=>now,set:v=>now=v});Object.defineProperty(ctx,'closed',{get:()=>closed,set:v=>closed=v});vm.runInNewContext(src,ctx);
const g=ctx.module.exports.solve(['red','blue','yellow'],[[1],[0,2],[1]],{moveTreeSearch:false,restartAfterMs:20});
assert.equal(g.next().value.type,'search');now+=100000; // A presentation pause is outside next(), so it is excluded.
assert.equal(g.next().value.type,'search');assert.equal(g.next().value.type,'search');assert.equal(g.next().value.restart,1);assert.equal(g.next().value.type,'forward');assert.equal(g.next().value,'solved');assert.deepEqual(variants,[0,1]);assert.equal(closed,2);
now=0;variants.length=0;const cancel=ctx.module.exports.solve(['red'],[[]],{moveTreeSearch:false,restartAfterMs:10});cancel.next();cancel.return();assert.equal(closed,3);
console.log('Passed bounded restart, changed planning variant, excluded display pauses, iterator cleanup, completion, and cancellation.');
