const assert=require('node:assert/strict');
const {solve,assess}=require('../search.js');
const fs=require('node:fs');
const n=['white','red','blue','purple','yellow','orange','green'];
function oracle(board,adj,memo=new Map()){
 const key=board.join('');if(memo.has(key))return memo.get(key);if(board.every(c=>!c))return true;
 const reach=i=>{const seen=new Set([i]),q=[i];for(const x of q)for(const y of adj[x])if(board[y]===board[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 for(let i=0;i<board.length;i++)for(let j=0;j<board.length;j++)if(board[i]&&board[j]&&!(board[i]&board[j])&&reach(i).some(x=>reach(j).some(y=>adj[x].includes(y)))){
 const t=board.slice();t[i]=0;t[j]=(board[i]|board[j])===7?0:board[i]|board[j];if(oracle(t,adj,memo)){memo.set(key,true);return true;}}
 memo.set(key,false);return false;
}
function check(board,adj,options){let current=board.map(c=>n[c]),history=[],backtracks=0,skipped=0;const search=solve(current,adj,options);let step;
 while(!(step=search.next()).done){const e=step.value;
 if(e.type==='search'){skipped++;continue;}
 if(e.type==='forward'){assert(e.plan.verified);assert.deepEqual(current,e.before);assert.equal(e.after[e.sourceIndex],'white');
 // A visible successor must pass independent occupied-component balance.
 const unseen=new Set(e.after.flatMap((c,i)=>c==='white'?[]:[i]));
 while(unseen.size){const group=[unseen.values().next().value];unseen.delete(group[0]);for(const i of group)for(const j of adj[i])if(unseen.delete(j))group.push(j);
 const counts=[1,2,4].map(bit=>group.reduce((sum,i)=>sum+!!(n.indexOf(e.after[i])&bit),0));assert.equal(counts[0],counts[1]);assert.equal(counts[0],counts[2]);}
 history.push(current);current=e.after;}
 else{assert.fail('Speculative undo is forbidden without supplied history');assert.deepEqual(current,e.after);assert.deepEqual(history.pop(),e.before);current=e.before;backtracks++;}}
 return {result:step.value,backtracks,skipped};
}
let total=0;
for(const adj of [Array.from({length:6},(_,i)=>[i-1,i+1].filter(j=>j>=0&&j<6)),Array.from({length:6},(_,i)=>[(i+1)%6,(i+5)%6]),[[1,2,3,4,5],[0],[0],[0],[0],[0]]]){
 const memo=new Map();for(let code=0;code<729;code++){let v=code,b=[];for(let i=0;i<6;i++){b.push([1,2,4][v%3]);v=Math.floor(v/3);}if([1,2,4].some(c=>b.filter(v=>v===c).length!==2))continue;
 assert.equal(check(b,adj).result==='solved',oracle(b,adj,memo));total++;}}
const data=require('./fixtures.json');assert.equal(check(data.board,data.adj).result,'unsolvable');
// An unrelated, legal mix outside the blue barrier must not disable the
// corner-red proof just because the board now contains an orange tile.
const mixedCounter=data.board.slice();mixedCounter[19]=0;mixedCounter[26]=5;
assert.deepEqual(assess(mixedCounter.map(c=>n[c]),data.adj),{unsolvable:true,reason:{type:'trapped-primary',tile:0,color:'red'}});
assert.deepEqual(solve(mixedCounter.map(c=>n[c]),data.adj).next(),{done:true,value:'unsolvable'});
// Three yellows inside the barrier are enough to pass this necessary check.
// Consuming the extra yellow against a boundary blue reinstates the trap.
const beforeTrap=data.board.slice();beforeTrap[3]=4;beforeTrap[26]=1;
assert.equal(assess(beforeTrap.map(c=>n[c]),data.adj).unsolvable,false);
const afterTrap=beforeTrap.slice();afterTrap[3]=0;afterTrap[4]=6;
assert.equal(assess(afterTrap.map(c=>n[c]),data.adj).reason.type,'trapped-primary');
// Both purple regions individually see a yellow, but it is the SAME yellow.
const sharedBoard=[3,3,4,6,1,4],sharedAdj=[[2],[2],[0,1,3],[2,4,5],[3],[3]];
assert.equal(oracle(sharedBoard,sharedAdj),false);
assert.equal(assess(sharedBoard.map(c=>n[c]),sharedAdj).reason.type,'shared-complement-shortage');
// This fixture used to animate a doomed move before immediately undoing it.
const regression=check(data.backtrack.map(c=>n.indexOf(c)),data.adj);
assert.equal(regression.result,'solved');assert.equal(regression.backtracks,0);
// Balanced and physically connected, with legal moves elsewhere, but the
// orange cannot ever join an orange blob touching blue.
const path=Array.from({length:6},(_,i)=>[i-1,i+1].filter(j=>j>=0&&j<6));
const trapped=[5,3,6,1,2,4];assert.equal(oracle(trapped,path),false);
const rejected=solve(trapped.map(c=>n[c]),path).next();assert(rejected.done);assert.equal(rejected.value,'unsolvable');
// Compare mixed boards as well: the new secondary proof must never discard
// a solution. Exhaust every balanced coloring on a four-cell cycle.
const cycle4=[[1,3],[0,2],[1,3],[0,2]];const mixedMemo=new Map();
for(let code=0;code<2401;code++){
 let v=code,b=[];for(let i=0;i<4;i++){b.push(v%7);v=Math.floor(v/7);}
 const totals=[1,2,4].map(bit=>b.reduce((sum,c)=>sum+!!(c&bit),0));
 if(totals[0]!==totals[1]||totals[0]!==totals[2])continue;
 assert.equal(check(b,cycle4).result==='solved',oracle(b,cycle4,mixedMemo));total++;
}
// Full mixed-color coverage on six-cell graphs protects against unsafe
// shortcuts in the generalized primary and shared-resource checks.
for(const adj of [path,[[1,5],[0,2],[1,3],[2,4],[3,5],[4,0]]]){
 const memo=new Map();
 for(let code=0;code<117649;code++){
  let v=code,b=[];for(let i=0;i<6;i++){b.push(v%7);v=Math.floor(v/7);}
  const totals=[1,2,4].map(bit=>b.reduce((sum,c)=>sum+!!(c&bit),0));
  if(totals[0]!==totals[1]||totals[0]!==totals[2])continue;
  assert.equal(check(b,adj).result==='solved',oracle(b,adj,memo),JSON.stringify(b));total++;
 }
}
console.log(`Passed ${total} exhaustive comparisons; mixed-board traps, shared supplies, and forward/backtrack consistency.`);

// An impossible island must be proved independently of a solvable island.
// The pocket check now catches it before deeper lookahead is necessary.
const island=[4,2,4,0,1,1,2,5,0,6,3,0];
const grid=Array.from({length:12},(_,i)=>[i%4?i-1:-1,i%4<3?i+1:-1,i-4,i+4].filter(j=>j>=0&&j<12));
assert.equal(assess(island.map(c=>n[c]),grid).reason.type,'pocket-supply-conflict');
assert.equal(oracle(island,grid),false);
const joined=[1,1,2,2,4,4,...island];
const joinedAdj=Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>j).filter(j=>j!==i))
 .concat(grid.map(g=>g.map(i=>i+6)));
const proof=solve(joined.map(c=>n[c]),joinedAdj);let checkpoint=proof.next(),silent=0;
while(!checkpoint.done){assert.equal(checkpoint.value.type,'search');silent++;checkpoint=proof.next();}
assert.equal(checkpoint.value,'unsolvable');assert(silent<10);
// Two solvable components replay cached moves on the full board correctly.
const twoAdj=[[1],[0,2],[1],[4],[3,5],[4]];
assert.equal(check([1,2,4,1,2,4],twoAdj).result,'solved');
// Deterministic mixed nine-cell samples exercise nontrivial endgame proofs
// against an independent oracle, including valid solutions through splits.
let seed=1739;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
const grid9=Array.from({length:9},(_,i)=>[i%3?i-1:-1,i%3<2?i+1:-1,i-3,i+3].filter(j=>j>=0&&j<9));
const memo9=new Map();
for(let k=0;k<1000;k++){
 const b=[0,0,0,1,2,4,3,5,6];
 for(let i=b.length-1;i;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
 assert.equal(check(b,grid9).result==='solved',oracle(b,grid9,memo9));
}
console.log('Passed independent-island pruning, cached solution replay, and 1,000 mixed endgame oracle comparisons.');

// Conflicting secondary routes must be proved without exploring moves.
const bottleneck=require('./bottleneck.cjs');
for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]) {
 const rename=b=>b.map(c=>[1,2,4].reduce((v,bit,i)=>v|(c&bit?bits[i]:0),0));
 const good=rename(bottleneck.good),bad=rename(bottleneck.bad),after=rename(bottleneck.after);
 assert.equal(assess(good.map(c=>n[c]),bottleneck.adj).unsolvable,false);
 assert.equal(check(good,bottleneck.adj).result,'solved');
 for(const b of [bad,after]) {
  const assessment=assess(b.map(c=>n[c]),bottleneck.adj);
  assert.equal(assessment.reason.type,'mandatory-color-conflict');
  assert.equal(assessment.reason.tile,26);
  assert.deepEqual(solve(b.map(c=>n[c]),bottleneck.adj).next(),{done:true,value:'unsolvable'});
 }
 const search=solve(good.map(c=>n[c]),bottleneck.adj);let step;
 while(!(step=search.next()).done)if(step.value.type==='forward') {
  assert.equal(assess(step.value.after,bottleneck.adj).unsolvable,false);
  assert.notDeepEqual(step.value.after,after.map(c=>n[c]));
 }
 assert.equal(step.value,'solved');
}
// More graph shapes protect the optimistic blob-transfer assumptions:
// mixed colors, branches, alternate routes, and disconnected components.
for(let k=0;k<1000;k++) {
 const b=[0,0,0,1,2,4,3,5,6];
 for(let i=b.length-1;i;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
 const adj=Array.from({length:9},()=>[]);
 for(let i=0;i<9;i++)for(let j=i+1;j<9;j++)if(random()<0.3){adj[i].push(j);adj[j].push(i);}
 const possible=oracle(b,adj),assessment=assess(b.map(c=>n[c]),adj);
 if(possible)assert.equal(assessment.unsolvable,false,JSON.stringify({b,adj,assessment}));
 assert.equal(check(b,adj).result==='solved',possible);
}
console.log('Passed both pictured boards and unsafe successor under all color permutations; 1,000 additional mixed-graph oracle comparisons.');

// Historical two-move trap; local gate ordering now proves it immediately.
const twoMoveTrap={"board":["blue","yellow","red","orange","yellow","blue","blue","red","blue","red","blue","yellow","yellow","white","red"],"after":["blue","yellow","red","orange","green","blue","blue","red","blue","red","white","yellow","yellow","white","red"],"adj":[[4,10,14],[3,5,13,14],[4,8],[1,4,7,8,9],[0,2,3,5,6,9],[1,4],[4,7,8,9],[3,6,10],[2,3,6],[3,4,6],[0,7],[12,14],[11,14],[1],[0,1,11,12]],"source":10,"target":4};
assert.equal(assess(twoMoveTrap.board,twoMoveTrap.adj).reason.type,'primary-gate-ordering');
// The stronger supply proof now rejects this successor even earlier.
assert.equal(assess(twoMoveTrap.after,twoMoveTrap.adj).reason.type,'trapped-primary');
assert.equal(oracle(twoMoveTrap.board.map(c=>n.indexOf(c)),twoMoveTrap.adj),false);
const lookahead=solve(twoMoveTrap.board,twoMoveTrap.adj);let lookaheadStep,lookaheadChecks=0;
while(!(lookaheadStep=lookahead.next()).done) {
 assert.equal(lookaheadStep.value.type,'search','Two-move dead ends must never animate');
 lookaheadChecks++;
}
assert.equal(lookaheadStep.value,'unsolvable');
console.log('Passed two-move dead-end rejection before any forward move.');

// Four lower-left yellows compete for only two reachable blue components.
const supplyBoard=["white","white","white","white","white","white","blue","white","white","white","white","white","white","red","red","white","white","white","white","white","white","blue","white","white","white","white","white","white","red","white","white","yellow","white","white","white","white","purple","yellow","blue","yellow","white","white","white","white","blue","white","yellow","yellow","white","red","yellow","red","yellow","white","white","blue","red","white","blue","white"];
for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]) {
 const renamed=supplyBoard.map(c=>n[[1,2,4].reduce((v,bit,i)=>v|(n.indexOf(c)&bit?bits[i]:0),0)]);
 assert.equal(assess(renamed,bottleneck.adj).reason.type,'primary-component-shortage');
 assert.deepEqual(solve(renamed,bottleneck.adj).next(),{done:true,value:'unsolvable'});
}
console.log('Passed pictured component shortage with zero search events under all color permutations.');

// The earlier mixed-color endgame is now rejected by a forced clearing,
// without needing the bounded deeper proof that previously caught it.
const deepBoard=['........','.......','........','..R....','R..B....','Y..PY..','.OBORBB.','...GY..']
 .join('').split('').map(c=>({'.':'white',R:'red',B:'blue',Y:'yellow',P:'purple',O:'orange',G:'green'}[c]));
assert.equal(assess(deepBoard,bottleneck.adj).reason.type,'forced-clear-disconnection');
assert.equal(oracle(deepBoard.map(c=>n.indexOf(c)),bottleneck.adj),false);
const deep=solve(deepBoard,bottleneck.adj);let event;
while(!(event=deep.next()).done)assert.equal(event.value.type,'search');
assert.equal(event.value,'unsolvable');
console.log('Passed bounded pre-animation rejection of pictured mixed board.');

// Screenshot: blues (3,8)/(4,7) have just one first-mix red, (4,6).
// Distant reds in the potential purple region cannot supply either blue.
const blueConflict=require('./blue-conflict.json');
for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]) {
 const renamed=blueConflict.board.map(c=>n[[1,2,4].reduce((v,bit,i)=>v|(n.indexOf(c)&bit?bits[i]:0),0)]);
 const result=assess(renamed,blueConflict.adj);
 assert.equal(result.reason.type,'primary-component-shortage');
 assert.equal(result.reason.color,n[bits[1]]);
 // Several shortages can coexist; color ordering selects the first.
 assert.notEqual(result.reason.component,result.reason.color);
 if(bits.join() === '1,2,4')assert.equal(result.reason.component,'red');
 // Zero lookahead ensures structural detection, not exhaustive search.
 assert.deepEqual(solve(renamed,blueConflict.adj,{lookaheadStates:0}).next(),{done:true,value:'unsolvable'});
}
console.log('Passed pictured first-mix supply conflict under all six color permutations without search.');

// An unmixable primary is not a possible secondary bridge. The red at
// (4,2) cannot become orange, leaving two orange anchors with one blue.
const orangeConflict=require('./orange-conflict.json');
for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]) {
 const renamed=orangeConflict.board.map(c=>n[[1,2,4].reduce((v,bit,i)=>v|(n.indexOf(c)&bit?bits[i]:0),0)]);
 assert.deepEqual(assess(renamed,orangeConflict.adj),{
  unsolvable:true,reason:{type:'missing-complement',color:n[bits[0]|bits[2]]}
 });
 assert.deepEqual(solve(renamed,orangeConflict.adj,{lookaheadStates:0}).next(),{done:true,value:'unsolvable'});
}
// A legal mix removes the yellow supply and triggers the cheaper bridge
// proof. The predecessor also has an independent pocket obstruction.
const beforeOrange=[...orangeConflict.board];beforeOrange[16]='red';beforeOrange[17]='yellow';
assert.equal(assess(beforeOrange,orangeConflict.adj).reason.type,'pocket-supply-conflict');
assert(orangeConflict.adj[16].includes(17));
const afterOrange=[...beforeOrange];afterOrange[16]='white';afterOrange[17]='orange';
assert.deepEqual(afterOrange,orangeConflict.board);
assert.equal(assess(afterOrange,orangeConflict.adj).unsolvable,true);
console.log('Passed impossible secondary-bridge regression and legal successor under all color permutations.');

// The forced green/red clearing catches this pictured bridge contradiction.
const disconnected=require('./disconnected-colors.json');
for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]) {
 const renamed=disconnected.board.map(c=>n[[1,2,4].reduce((v,bit,i)=>v|(n.indexOf(c)&bit?bits[i]:0),0)]);
 const assessment=assess(renamed,disconnected.adj);
 assert.deepEqual(assessment.reason,{type:'forced-clear-disconnection',secondary:14,primary:21});
 assert.deepEqual(solve(renamed,disconnected.adj,{lookaheadStates:0}).next(),{done:true,value:'unsolvable'});
}
// Larger mixed graphs exercise shared donor matching against the independent
// oracle, including solvable alternatives which must not be pruned.
let largerSolved=0;
for(let k=0;k<500;k++) {
 const b=[0,0,0,1,1,2,2,4,4,3,5,6];
 for(let i=b.length-1;i;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
 const adj=Array.from({length:12},()=>[]);
 for(let i=0;i<12;i++)for(let j=i+1;j<12;j++)if(random()<0.25){adj[i].push(j);adj[j].push(i);}
 const possible=oracle(b,adj);
 if(possible){largerSolved++;assert.equal(assess(b.map(c=>n[c]),adj).unsolvable,false,JSON.stringify({b,adj}));}
 assert.equal(check(b,adj).result==='solved',possible);
}
assert(largerSolved>0);
console.log('Passed forced pair under all colors and 500 larger mixed-graph oracle comparisons.');

// A tempting disconnection is not forced if another complement is available.
const alternative=[6,1,2,4,1],alternativeAdj=[[1,4],[0,2],[1,3],[2],[0]];
assert.equal(oracle(alternative,alternativeAdj),true);
assert.equal(assess(alternative.map(c=>n[c]),alternativeAdj).unsolvable,false);
assert.equal(check(alternative,alternativeAdj).result,'solved');
// A forced clearing may split the board safely into balanced components.
const safeSplit=[6,1,2,1,4,2,1,4],safeSplitAdj=[[1],[0,2,5],[1,3],[2,4],[3],[1,6],[5,7],[6]];
assert.equal(oracle(safeSplit,safeSplitAdj),true);
assert.equal(assess(safeSplit.map(c=>n[c]),safeSplitAdj).unsolvable,false);
assert.equal(check(safeSplit,safeSplitAdj).result,'solved');
console.log('Passed forced-clear disconnection, alternative complements, and safe balanced splits.');

// The top-left six-cell region cannot build its orange exit without
// consuming a yellow needed to keep its remaining red/yellow tiles linked.
const yellowLink=require('./yellow-link.json');
for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]) {
 const renamed=yellowLink.board.map(c=>n[[1,2,4].reduce((v,bit,i)=>v|(n.indexOf(c)&bit?bits[i]:0),0)]);
 const reason=assess(renamed,yellowLink.adj).reason;
 assert.equal(reason.type,'sealed-region-ordering');
 assert.equal(reason.color,n[bits[0]|bits[2]]);
 assert.deepEqual(solve(renamed,yellowLink.adj,{lookaheadStates:0}).next(),{done:true,value:'unsolvable'});
}
// An independent exact oracle validates the isolated obstruction, and a
// bypass edge makes it solvable: don't reject merely because it has a neck.
const smallCells=[9,10,16,15,23,31,25,32,39];
const smallBoard=smallCells.map(i=>n.indexOf(yellowLink.board[i]));
const smallAdj=smallCells.map(i=>yellowLink.adj[i].filter(j=>smallCells.includes(j)).map(j=>smallCells.indexOf(j)));
assert.equal(oracle(smallBoard,smallAdj),false);
assert.equal(assess(smallBoard.map(c=>n[c]),smallAdj).reason.type,'sealed-region-ordering');
const bypassAdj=smallAdj.map(g=>[...g]);bypassAdj[0].push(4);bypassAdj[4].push(0);
assert.equal(oracle(smallBoard,bypassAdj),true);
assert.equal(assess(smallBoard.map(c=>n[c]),bypassAdj).unsolvable,false);
assert.equal(check(smallBoard,bypassAdj).result,'solved');
console.log('Passed sealed-region ordering under all colors, independent local oracle, and solvable bypass.');

// A possible green bridge cannot spend its blue both as a donor and as
// a surviving connection. Both screenshots must reject without lookahead.
const pocket=require('./pocket-conflict.cjs');
assert.equal(assess(pocket.before,pocket.adj).unsolvable,false);
const pocketSearch=solve(pocket.before,pocket.adj,{lookaheadStates:0});
let pocketStep;
while(!(pocketStep=pocketSearch.next()).done)if(pocketStep.value.type==='forward') {
 assert.notDeepEqual(pocketStep.value.after,pocket.board,'Never animate the move creating this pocket');
 assert.equal(assess(pocketStep.value.after,pocket.adj).unsolvable,false);
}
assert.equal(pocketStep.value,'solved');
for(const board of [pocket.board,pocket.earlier])for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]) {
 const renamed=board.map(c=>n[[1,2,4].reduce((v,bit,i)=>v|(n.indexOf(c)&bit?bits[i]:0),0)]);
 assert.equal(assess(renamed,pocket.adj).reason.type,'pocket-supply-conflict');
 assert.deepEqual(solve(renamed,pocket.adj,{lookaheadStates:0}).next(),{done:true,value:'unsolvable'});
}
// Independent oracle on a balanced extraction of the pictured obstruction.
// Connecting the two yellow blobs supplies a real escape and must be allowed.
const pocketCells=[21,22,29,36,37,44,51,52,50];
const pocketBoard=pocketCells.map(i=>n.indexOf(pocket.board[i]));
const pocketAdj=pocketCells.map(i=>pocket.adj[i].filter(j=>pocketCells.includes(j)).map(j=>pocketCells.indexOf(j)));
assert.equal(oracle(pocketBoard,pocketAdj),false);
assert.equal(assess(pocketBoard.map(c=>n[c]),pocketAdj).reason.type,'pocket-supply-conflict');
const pocketBypass=pocketAdj.map(g=>g.slice());pocketBypass[0].push(5);pocketBypass[5].push(0);
assert.equal(oracle(pocketBoard,pocketBypass),true);
assert.equal(assess(pocketBoard.map(c=>n[c]),pocketBypass).unsolvable,false);
assert.equal(check(pocketBoard,pocketBypass).result,'solved');
// A blob crossing the exit can transfer to/from an interior neighbor using
// its outside members. Clipping that blob would incorrectly reject this.
const crossing=[4,4,2,2,1,1];
assert.equal(oracle(crossing,path),true);
assert.equal(assess(crossing.map(c=>n[c]),path).unsolvable,false);
assert.equal(check(crossing,path).result,'solved');
// Deliberate single-exit graphs stress the new relaxation with all colors,
// including external secondary blobs and same-color transfers across exits.
let pocketSolved=0;
for(let k=0;k<1000;k++) {
 const b=k%2 ? [1,1,2,2,4,4,3,5,6] : [0,0,0,1,2,4,3,5,6];
 for(let i=b.length-1;i;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
 const adj=Array.from({length:9},()=>[]);
 for(let i=0;i<9;i++)for(let j=i+1;j<9;j++)if((j<=4||i>=4)&&random()<0.65){adj[i].push(j);adj[j].push(i);}
 const possible=oracle(b,adj);
 if(possible){pocketSolved++;assert.equal(assess(b.map(c=>n[c]),adj).unsolvable,false,JSON.stringify({b,adj}));}
 assert.equal(check(b,adj).result==='solved',possible);
}
assert(pocketSolved>0);
console.log('Passed both pocket screenshots under all colors, independent obstruction/bypass proofs, and 1,000 single-exit oracle comparisons.');

// The upper reds can reach the lone right-side yellow, but the lower yellow
// blob needs a seven-cell purple bridge in a region with capacity four.
const purpleDistance=require('./purple-distance.cjs');
for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]) {
 const renamed=purpleDistance.board.map(c=>n[[1,2,4].reduce((v,bit,i)=>v|(n.indexOf(c)&bit?bits[i]:0),0)]);
 assert.equal(assess(renamed,purpleDistance.adj).reason.type,'primary-component-shortage');
 for(const lookaheadStates of [0,64,4000])assert.deepEqual(
  solve(renamed,purpleDistance.adj,{lookaheadStates}).next(),{done:true,value:'unsolvable'});
}
console.log('Passed purple-bridge screenshot under all colors with zero, small, and default lookahead budgets.');

// A smaller balanced distance conflict has an independent exhaustive proof.
// Joining the two yellow blobs provides a real escape, so it must be accepted.
const distanceBoard=[4,4,2,4,2,2,1,1,1];
const distanceAdj=[[3,5],[6,8],[6,8],[0],[5,8],[0,4],[1,2,7],[6],[1,2,4]];
assert.equal(oracle(distanceBoard,distanceAdj),false);
assert.equal(assess(distanceBoard.map(c=>n[c]),distanceAdj).reason.type,'primary-component-shortage');
const distanceBypass=distanceAdj.map(g=>g.slice());distanceBypass[0].push(1);distanceBypass[1].push(0);
assert.equal(oracle(distanceBoard,distanceBypass),true);
assert.equal(assess(distanceBoard.map(c=>n[c]),distanceBypass).unsolvable,false);
assert.equal(check(distanceBoard,distanceBypass).result,'solved');
// Existing secondaries must also match against reachable suppliers, rather
// than sharing one nearby yellow and counting unusably distant extras.
const anchored=[3,3,1,2,1,2,4,4,4,4];
const anchoredAdj=[[1,6],[0,2],[1,3],[2,4],[3,5],[4,7],[0],[5,8],[7,9],[8]];
assert.equal(oracle(anchored,anchoredAdj),false);
assert.equal(assess(anchored.map(c=>n[c]),anchoredAdj).reason.type,'shared-complement-shortage');
// Equality is allowed: two available purples suffice for a two-cell bridge.
// Either tile in the linked yellow blob can clear a purple at its far end.
const exactBridge=[3,1,2,4,4],exactBridgeAdj=[[1],[0,2,3],[1],[1,4],[3]];
assert.equal(oracle(exactBridge,exactBridgeAdj),true);
assert.equal(assess(exactBridge.map(c=>n[c]),exactBridgeAdj).unsolvable,false);
assert.equal(check(exactBridge,exactBridgeAdj).result,'solved');
console.log('Passed independent distance conflict, solvable bypass, secondary supply matching, and exact-capacity bridge.');


{
// September 28: structural checks pass, but a 19-tile endgame is impossible.
const endgame=require('./endgame-trap.cjs');
assert.equal(assess(endgame.board,endgame.adj).unsolvable,false);
for(const lookaheadStates of [0,4000]) {
 const search=solve(endgame.board,endgame.adj,{lookaheadStates});let step,checkpoints=0;
 while(!(step=search.next()).done){assert.equal(step.value.type,'search');checkpoints++;}
 assert.equal(step.value,'unsolvable');assert(checkpoints>1);
}
// A reconstructed solvable predecessor can legally enter precisely this trap.
const before=endgame.board.slice();before[19]='red';before[27]='blue';
assert(endgame.adj[19].includes(27));
const trapped=before.slice();trapped[19]='white';trapped[27]='purple';
assert.deepEqual(trapped,endgame.board);
const search=solve(before,endgame.adj);let step,current=before,forward=0;
while(!(step=search.next()).done) {
 const e=step.value;if(e.type==='search')continue;
 assert.equal(e.type,'forward','Proved endgames must never backtrack');
 assert.deepEqual(e.before,current);assert.notDeepEqual(e.after,endgame.board);
 const reach=i=>{const q=[i],seen=new Set(q);for(const x of q)for(const y of endgame.adj[x])if(current[y]===current[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 assert(reach(e.sourceIndex).some(i=>reach(e.targetIndex).some(j=>endgame.adj[i].includes(j))));
 const a=n.indexOf(current[e.sourceIndex]),b=n.indexOf(current[e.targetIndex]);assert(a&&b&&!(a&b));
 const next=current.slice();next[e.sourceIndex]='white';next[e.targetIndex]=(a|b)===7?'white':n[a|b];
 assert.deepEqual(e.after,next);current=next;forward++;
}
assert.equal(step.value,'solved');assert(current.every(c=>c==='white'));assert(forward>0);
console.log('Passed pictured endgame without animation at zero/default lookahead and a solvable predecessor without entering the trap.');

}

{
 // Orange screenshot: four demands compete for only three yellow donors.
 const pictured=require('./stalled-backtracking.cjs');
 for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]) {
  const renamed=pictured.board.map(c=>n[[1,2,4].reduce((v,bit,i)=>v|(n.indexOf(c)&bit?bits[i]:0),0)]);
  const verdict=assess(renamed,pictured.adj);
  assert.equal(verdict.reason.type,'secondary-bridge-supply-conflict');
  assert.equal(verdict.reason.required,4);assert.equal(verdict.reason.available,3);
  assert.equal(verdict.reason.tile,17);
  assert.deepEqual([...verdict.reason.forced].sort((a,b)=>a-b),[25,31,53]);
  for(const lookaheadStates of [0,64,4000])
   assert.deepEqual(solve(renamed,pictured.adj,{lookaheadStates}).next(),{done:true,value:'unsolvable'});
 }
 const {b,adj,bypass}=require('./bridge-supply.cjs');
 assert.equal(assess(b.map(c=>n[c]),adj).reason.type,'secondary-bridge-supply-conflict');
 assert.equal(oracle(b,adj),false);
 const open=adj.map(g=>[...g]);for(const [i,j] of bypass){open[i].push(j);open[j].push(i);}
 assert.equal(oracle(b,open),true);
 assert.equal(assess(b.map(c=>n[c]),open).unsolvable,false);
 assert.equal(check(b,open).result,'solved');
 // Mixed random graphs independently guard reservation propagation and
 // shared bridge accounting, including distant transfers inside blobs.
 let seed=83943;
 const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let test=0;test<1500;test++){
  const board=[5,1,1,1,2,2,2,2,4,4,4],graph=board.map(()=>[]);
  for(let i=0;i<board.length;i++)for(let j=0;j<i;j++)if(rand()<.19){graph[i].push(j);graph[j].push(i);}
  const possible=oracle(board,graph),verdict=assess(board.map(c=>n[c]),graph);
  if(verdict.unsolvable)assert.equal(possible,false,JSON.stringify({board,graph,verdict}));
  else assert.equal(check(board,graph).result==='solved',possible);
 }
 console.log('Passed immediate bridge shortage under all colors/budgets, independent obstruction and solvable bypass, and 1,500 mixed graph comparisons.');
}

require('./strategic.cjs');


require('./bridge-allocation.cjs');
