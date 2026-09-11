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
  // No move creates a primary, and a secondary stays at its cell until
  // clearing. For each secondary, build the regions that could ever contain
  // it. White cells and colors with an overlapping third component can never
  // become part of such a region. Compute each region once per board.
  function secondaryRegions(board, adjacency, allBlobs) {
    const profiles=new Map();
    for (const secondary of [3,5,6]) {
      const complement=7^secondary;
      const bits=[1,2,4].filter(bit=>secondary&bit);
      const allowed=board.flatMap((c,i)=>c && (c&secondary)===c?[i]:[]);
      const byCell=Array(board.length).fill(null),regions=[];
      for (const region of groups(allowed,adjacency)) {
        const anchors=region.filter(i=>board[i]===secondary);
        const regionSet=new Set(region);
        const suppliers=allBlobs.filter(g=>board[g[0]]===complement && g.some(i=>adjacency[i].some(j=>regionSet.has(j))));
        const capacity=Math.min(...bits.map(bit=>region.filter(i=>board[i]&bit).length));
        const distance=Array(board.length).fill(Infinity),queue=[];
        for (const i of region) if (adjacency[i].some(j=>board[j]===complement)) {distance[i]=1;queue.push(i);}
        for (const i of queue) for (const j of adjacency[i]) if (regionSet.has(j) && distance[j]===Infinity) {distance[j]=distance[i]+1;queue.push(j);}
        const profile={anchors,capacity,distance,suppliers:suppliers.flat()};
        regions.push(profile);
        for (const i of region) byCell[i]=profile;
      }
      profiles.set(secondary,{byCell,regions});
    }
    return profiles;
  }
  function trapReason(board, adjacency, allBlobs) {
    const profiles=secondaryRegions(board,adjacency,allBlobs);
    for (const [secondary,{regions}] of profiles) {
      for (const region of regions) {
        if (region.suppliers.length<region.anchors.length) return {type:'missing-complement',color:names[secondary]};
        const tile=region.anchors.find(i=>region.distance[i]>region.capacity);
        if (tile!==undefined) return {type:'trapped-secondary',tile,color:names[secondary],capacity:region.capacity,required:region.distance[tile]};
      }
      // Different secondary regions can compete for the same primary blob.
      // A clearing consumes a distinct primary tile. Maximum matching checks
      // all combinations of competing regions without enumerating subsets.
      const demands=regions.flatMap(r=>r.anchors.map(()=>r.suppliers));
      const matched=new Map();
      function assign(demand,seen) {
        for (const supplier of demands[demand]) {
          if (seen.has(supplier)) continue;
          seen.add(supplier);
          if (!matched.has(supplier)||assign(matched.get(supplier),seen)) {
            matched.set(supplier,demand);return true;
          }
        }
        return false;
      }
      for (let i=0;i<demands.length;i++) if (!assign(i,new Set())) return {type:'shared-complement-shortage',color:names[secondary]};
    }
    const owner=new Map(allBlobs.flatMap(g=>g.map(i=>[i,g])));
    for (const blob of allBlobs) {
      const color=board[blob[0]];
      if (![1,2,4].includes(color)) continue;
      const neighbors=[...new Set(blob.flatMap(i=>adjacency[i]))].filter(i=>board[i] && board[i]!==color);
      const opposite=profiles.get(7^color);
      // Optimistically allow a future complementary secondary at any
      // neighboring cell if its region contains both required components.
      // This may miss an obstruction, but cannot reject a real solution.
      if (neighbors.some(i=>opposite.byCell[i]?.capacity>0)) continue;
      const partners=[...new Set(neighbors.filter(i=>[1,2,4].includes(board[i])).map(i=>owner.get(i)))];
      // Otherwise this particular primary must first mix with a linked
      // primary blob. Its component can end up only at its own cell (when
      // receiving a tile) or somewhere in that partner blob (when moved).
      for (const tile of blob) {
        let escape=false;
        for (const partner of partners) {
          const region=profiles.get(color|board[partner[0]]).byCell[tile];
          if ([tile,...partner].some(i=>region.distance[i]<=region.capacity)) {escape=true;break;}
        }
        if (!escape) return {type:'trapped-primary',tile,color:names[color]};
      }
    }
    return null;
  }
  function rejectionReason(board,adjacency,allBlobs) {
    if (!balancedComponents(board,adjacency)) return {type:'unbalanced-component'};
    return trapReason(board,adjacency,allBlobs);
  }
  function assess(tiles,adjacency) {
    const board=tiles.map(c=>masks[c]);
    const reason=rejectionReason(board,adjacency,blobs(board,adjacency));
    // Passing these necessary conditions is not a proof of solvability.
    return {unsolvable:reason!==null,reason};
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
    const dead=new Set(), winning=new Map();
    const componentBoard=(board,group)=>{
      const isolated=Array(board.length).fill(0);
      for(const i of group)isolated[i]=board[i];
      return isolated;
    };
    const components=board=>groups(board.flatMap((c,i)=>c?[i]:[]),adjacency)
      .sort((a,b)=>a.length-b.length);
    // Exact, silent endgame proof. Unknown (budget exhausted) is distinct
    // from false. Only fully exhausted states enter the dead-state cache.
    // Store a winning first move so animation can follow the proof directly.
    function* prove(board,budget) {
      const key=board.join('');
      if(dead.has(key))return false;
      if(winning.has(key)||board.every(c=>!c))return true;
      if(budget.left--<=0)return null;
      if((budget.left&31)===31)yield {type:'search'};
      const allBlobs=blobs(board,adjacency);
      if(rejectionReason(board,adjacency,allBlobs)){dead.add(key);return false;}
      const parts=components(board);
      if(parts.length>1){
        let unknown=false;
        for(const part of parts){
          const isolated=componentBoard(board,part);
          const result=yield* prove(isolated,budget);
          if(result===false){dead.add(key);return false;}
          if(result===null)unknown=true;
        }
        if(unknown)return null;
        const move=winning.get(componentBoard(board,parts[0]).join(''));
        winning.set(key,move);return true;
      }
      for(const move of moves(board,adjacency,allBlobs)){
        const result=yield* prove(move.next,budget);
        if(result===true){winning.set(key,{source:move.source,target:move.target});return true;}
        if(result===null)return null;
      }
      dead.add(key);return false;
    }
    function* prepare(board) {
      const key=board.join('');
      if(dead.has(key))return null;
      if(board.every(c=>c===0))return {solved:true};
      const allBlobs=blobs(board,adjacency);
      if(rejectionReason(board,adjacency,allBlobs)){dead.add(key);return null;}
      const parts=components(board),budget={left:4000};
      // Empty cells are permanent. Each disconnected component must clear
      // independently, so prove small islands even on a mostly full board.
      for(const part of parts)if(part.length<=12){
        if((yield* prove(componentBoard(board,part),budget))===false){dead.add(key);return null;}
      }
      // Independent moves commute: finish one component before touching the
      // next, eliminating all permutations of their move interleavings.
      const active=parts[0],isolated=componentBoard(board,active);
      const known=winning.get(isolated.join(''));
      let candidates;
      if(known){
        const next=board.slice(),combined=board[known.source]|board[known.target];
        next[known.source]=0;next[known.target]=combined===7?0:combined;
        candidates=[{...known,next}];
      }else{
        const activeSet=new Set(active);
        candidates=moves(isolated,adjacency,allBlobs.filter(g=>activeSet.has(g[0])))
          .map(move=>{const next=board.slice();next[move.source]=move.next[move.source];next[move.target]=move.next[move.target];return {...move,next};});
      }
      if(!candidates.length){dead.add(key);return null;}
      return {key,candidates,solved:false};
    }
    function* visit(board, prepared) {
      if(prepared===undefined)prepared=yield* prepare(board);
      if(!prepared)return false;
      if(prepared.solved)return true;
      for(const move of prepared.candidates){
        // Check the successor before the display changes. These are proofs
        // of failure, not a claim that every remaining candidate is solvable.
        const next=yield* prepare(move.next);
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
  return {solve,assess};
})();
if (typeof module !== 'undefined') module.exports = SplashSearch;
