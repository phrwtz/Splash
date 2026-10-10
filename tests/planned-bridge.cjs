const assert=require('node:assert/strict'),{assess,solve}=require('../search.js');
const {adj}=require('./bottleneck.cjs');
const names=['white','red','blue','purple','yellow','orange','green'];
const board=['.....B..','....GY.','..Y.G...','.YRYGR.','...RYBB.','R.Y.BB.','BRYR.RY.','BRRBRR.']
 .join('').split('').map(c=>({'.':0,R:1,B:2,Y:4,G:6}[c]));
for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
 const tiles=board.map(c=>names[[1,2,4].reduce((v,b,i)=>v|(c&b?bits[i]:0),0)]);
 assert.equal(assess(tiles,adj).reason.type,'bridge-layout-conflict');
 assert.deepEqual(solve(tiles,adj).next(),{done:true,value:'unsolvable'});
}
const fixture=require('./bottleneck.cjs');
const original=fixture.good.map(c=>names[c]),bad=fixture.after.map(c=>names[c]);
const current=bad.slice();current[16]='white';current[26]='green';
const search=solve(current,adj,{history:[{tiles:original},{tiles:bad}]});
let step,events=[];
while(!(step=search.next()).done){
 if(step.value.type!=='search'){
  events.push(step.value);
  if(step.value.type==='forward')assert.notDeepEqual(step.value.after,bad);
 }
}
assert.equal(step.value,'solved');
assert.deepEqual(events.slice(0,2).map(e=>e.type),['backtrack','backtrack']);
assert.deepEqual(events[1].before,original);
console.log('Passed full bridge-layout rejection under all colors and historical multi-undo recovery to a solution.');
