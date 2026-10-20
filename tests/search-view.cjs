const assert=require('node:assert/strict'),{solve}=require('../search.js');
const {board,adj}=require('./early-endgame-two.cjs');
const original=board.slice(),g=solve(board,adj,{moveTreeSearch:false,sectionStates:12000,strategyStates:12000,sectionRestarts:0});
let changed=false,group=false,first;
try{
 for(let i=0;i<3000;i++){
  const s=g.next();if(s.done)break;const e=s.value;if(e.type!=='search')continue;
  assert.equal(e.tiles.length,60);assert(e.tiles.every(c=>['white','red','blue','yellow','purple','orange','green'].includes(c)));
  if(!first)first={event:e,tiles:e.tiles.slice()};
  if(e.tiles.some((c,i)=>c!==board[i]))changed=true;
  if(e.objective?.cells.length)group=true;
  if(changed&&group)break;
 }
}finally{g.return();}
assert(changed);assert(group);assert.deepEqual(first.event.tiles,first.tiles);assert.deepEqual(board,original);
console.log('Passed actual planner snapshots, group objectives, retained snapshot stability, and unchanged input tiles.');
