/* Complete Splash search. Heuristics order moves; only proved obstructions prune.
 * Events are forward moves, backtracks, or silent search checkpoints. No timer or DOM
 * dependencies: the player owns the wall-clock limit and animation scheduling.
 */
const SplashSearch = (() => {
  const masks = {white:0,red:1,blue:2,purple:3,yellow:4,orange:5,green:6};
  const names = ['white','red','blue','purple','yellow','orange','green'];
  function groups(vertices, adjacency) {
    const unseen = new Set(vertices), result = [];
    while (unseen.size) {
      const first = unseen.values().next().value, group = [first]; unseen.delete(first);
      for (const i of group) for (const j of adjacency[i]) if (unseen.delete(j)) group.push(j);
      result.push(group);
    }
    return result;
  }
  function blobs(board, adjacency) {
    const out = [];
    for (let c=1;c<7;c++) out.push(...groups(board.flatMap((v,i)=>v===c?[i]:[]),adjacency));
    return out;
  }
  function balancedComponents(board, adjacency) {
    for (const group of groups(board.flatMap((c,i)=>c?[i]:[]),adjacency)) {
      const totals = [1,2,4].map(bit=>group.reduce((n,i)=>n+!!(board[i]&bit),0));
      if (totals[0]!==totals[1] || totals[0]!==totals[2]) return false;
    }
    return true;
  }
  // A singleton primary needing an orange-like connection longer than the
  // entire enclosed region can supply. Primary blobs never grow, and a
  // secondary cannot relocate before clearing. See the counterexample proof.
  function trappedPrimary(board, adjacency, allBlobs) {
    if (board.some(c=>c && ![1,2,4].includes(c))) return false;
    const owner = new Map(allBlobs.flatMap(g=>g.map(i=>[i,g])));
    for (let center=0;center<board.length;center++) {
      const color=board[center];
      if (!color || owner.get(center).length!==1) continue;
      const near=adjacency[center].filter(j=>board[j]);
      const neighborColors=new Set(near.map(j=>board[j]));
      if (neighborColors.size!==1) continue;
      const partner=[...neighborColors][0];
      if (partner===color) continue;
      const third=7^color^partner;
      const partners=[...new Set(near.flatMap(j=>owner.get(j)))];
      if (partners.some(j=>adjacency[j].some(k=>board[k]===third))) continue;
      const region=groups(board.flatMap((c,i)=>c===color||c===partner?[i]:[]),adjacency).find(g=>g.includes(center));
      const capacity=Math.min(region.filter(i=>board[i]===color).length,region.filter(i=>board[i]===partner).length);
      const distance=Array(board.length).fill(Infinity), queue=[];
      board.forEach((c,i)=>{if(c===third){distance[i]=0;queue.push(i);}});
      for(const i of queue) for(const j of adjacency[i]) if(distance[j]===Infinity){distance[j]=distance[i]+1;queue.push(j);}
      if(Math.min(...[center,...partners].map(i=>distance[i]))>capacity) return true;
    }
    return false;
  }
  // A secondary can only connect through cells that still could acquire
  // that same secondary. Other secondaries and white cells cannot help.
  function trappedSecondary(board, adjacency, allBlobs) {
    for (const secondary of [3,5,6]) {
      if (!board.includes(secondary)) continue;
      const complement=7^secondary;
      const bits=[1,2,4].filter(bit=>secondary&bit);
      const allowed=board.flatMap((c,i)=>c && (c&secondary)===c?[i]:[]);
      for (const region of groups(allowed,adjacency)) {
        const anchors=region.filter(i=>board[i]===secondary);
        if (!anchors.length) continue;
        const regionSet=new Set(region);
        const suppliers=allBlobs.filter(g=>board[g[0]]===complement && g.some(i=>adjacency[i].some(j=>regionSet.has(j))));
        if (suppliers.reduce((sum,g)=>sum+g.length,0)<anchors.length) return true;
        const capacity=Math.min(...bits.map(bit=>region.filter(i=>board[i]&bit).length));
        const distance=Array(board.length).fill(Infinity),queue=[];
        for (const i of region) if (adjacency[i].some(j=>board[j]===complement)) {distance[i]=1;queue.push(i);}
        for (const i of queue) for (const j of adjacency[i]) if (regionSet.has(j) && distance[j]===Infinity) {distance[j]=distance[i]+1;queue.push(j);}
        if (anchors.some(i=>distance[i]>capacity)) return true;
      }
    }
    return false;
  }
  function moves(board, adjacency, allBlobs) {
    const owner=new Map(allBlobs.flatMap((g,k)=>g.map(i=>[i,k]))), links=new Set(), result=[];
    board.forEach((c,i)=>{if(c)for(const j of adjacency[i])if(board[j] && !(c&board[j])){
      const a=owner.get(i),b=owner.get(j);links.add(a<b?`${a},${b}`:`${b},${a}`);
    }});
    for(const link of links){const [a,b]=link.split(',').map(Number);
      for(const i of allBlobs[a])for(const j of allBlobs[b]){
        const combined=board[i]|board[j];
        const add=(source,target)=>{
          const next=board.slice();next[source]=0;next[target]=combined===7?0:combined;
          let score=combined===7?100000:0;
          if(combined!==7 && adjacency[target].some(k=>board[k]===(7^combined)))score+=10000;
          // Prefer a compact remainder, but keep every legal alternative.
          next.forEach((c,k)=>{if(c){const degree=adjacency[k].filter(v=>next[v]).length;score+=degree*degree-(degree===1?15:degree===0?100:0);}});
          result.push({source,target,next,score});
        };
        add(i,j);if(combined!==7)add(j,i);
      }
    }
    return result.sort((a,b)=>b.score-a.score);
  }
  function* solve(tiles, adjacency) {
    const dead=new Set();
    function prepare(board) {
      const key=board.join('');
      if(dead.has(key))return null;
      if(board.every(c=>c===0))return {solved:true};
      const allBlobs=blobs(board,adjacency);
      if(!balancedComponents(board,adjacency)||trappedPrimary(board,adjacency,allBlobs)||trappedSecondary(board,adjacency,allBlobs)){dead.add(key);return null;}
      const candidates=moves(board,adjacency,allBlobs);
      if(!candidates.length){dead.add(key);return null;}
      return {key,candidates,solved:false};
    }
    function* visit(board, prepared=prepare(board)) {
      if(!prepared)return false;
      if(prepared.solved)return true;
      for(const move of prepared.candidates){
        // Check the successor before the display changes. These are proofs
        // of failure, not a claim that every remaining candidate is solvable.
        const next=prepare(move.next);
        if(!next){
          // Give the player a chance to process Stop and the deadline even
          // when many candidates are rejected without any animation.
          yield {type:'search'};
          continue;
        }
        yield {type:'forward',sourceIndex:move.source,targetIndex:move.target,before:board.map(c=>names[c]),after:move.next.map(c=>names[c])};
        if(yield* visit(move.next,next))return true;
        yield {type:'backtrack',sourceIndex:move.source,targetIndex:move.target,before:board.map(c=>names[c]),after:move.next.map(c=>names[c])};
      }
      dead.add(prepared.key);return false;
    }
    return (yield* visit(tiles.map(c=>masks[c])))?'solved':'unsolvable';
  }
  return {solve};
})();
if (typeof module !== 'undefined') module.exports = SplashSearch;
