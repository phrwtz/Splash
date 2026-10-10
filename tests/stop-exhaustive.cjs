const assert=require('node:assert/strict'),{solve}=require('../search.js');
for(const fixture of ['purple-strategy','yellow-bridge','pocket-priority','retracted-moves']){
 const {board,adj}=require(`./${fixture}.cjs`),original=board.slice();
 const g=solve(board,adj,{progressive:true,stopBeforeExhaustive:true});let s,diagnostic;
 while(!(s=g.next()).done){const e=s.value;
  assert(!['verification','exploration'].includes(e.phase),'Must stop before exact search');
  assert(['search','exhaustive-required'].includes(e.type),'No speculative playback');
  if(e.type==='exhaustive-required'){assert(!diagnostic);diagnostic=e;}
 }
 assert.equal(s.value,'paused');assert(diagnostic);assert.match(diagnostic.message,/not been proved solvable or unsolvable/);
 assert(Number.isSafeInteger(diagnostic.plansTried));assert.deepEqual(board,original);
}
// Established structural proofs and easy strategic solutions still work.
for(const fixture of ['green-exit','eight-pocket']){
 const {board,adj}=require(`./${fixture}.cjs`);
 assert.deepEqual(solve(board,adj,{progressive:true,stopBeforeExhaustive:true}).next(),{done:true,value:'unsolvable'});
}
const g=solve(['red','blue','yellow'],[[1],[0,2],[1]],{progressive:true,stopBeforeExhaustive:true});let s,moves=0;
while(!(s=g.next()).done){assert.notEqual(s.value.type,'exhaustive-required');if(s.value.type==='forward')moves++;}
assert.equal(s.value,'solved');assert.equal(moves,2);
console.log('Passed diagnostic stop before all exact fallback, preserved board, structural proofs, and strategic solutions.');
