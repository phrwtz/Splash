/* Resource-aware plan search. Auto Play shares offline beam and diagnostic
 * strategies alongside group and interacting-bridge planning; the caller owns its deadline.
 * Events are forward moves, backtracks, or silent search checkpoints. No timer or DOM
 * dependencies: the player owns the wall-clock limit and animation scheduling.
 */
function createSplashSearch() {
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
  function secondaryRegions(board, adjacency, allBlobs, reservations=new Map()) {
    const profiles=new Map();
    for (const secondary of [3,5,6]) {
      const complement=7^secondary;
      const bits=[1,2,4].filter(bit=>secondary&bit);
      // A primary cell can become this secondary only by receiving its
      // other primary component from an already linked blob. Primary blobs
      // only shrink, so a missing link can never appear later.
      const canMix=new Set();
      for(const blob of allBlobs) {
        const color=board[blob[0]],other=secondary^color;
        if(bits.includes(color) && blob.some(i=>adjacency[i].some(j=>board[j]===other)))
          for(const i of blob)canMix.add(i);
      }
      const allowed=board.flatMap((c,i)=>c===secondary || canMix.has(i)?[i]:[]);
      const byCell=Array(board.length).fill(null),regions=[];
      // A reserved cell must become its specified secondary, so it can
      // neither host another secondary nor donate its original primary.
      // Keep each ORIGINAL region together: primary blobs can transfer
      // across a reserved cell before it converts. Splitting the region
      // here would underestimate those transfers and available material.
      for (const original of groups(allowed,adjacency)) {
        const region=original.filter(i=>!reservations.has(i)||reservations.get(i).secondary===secondary);
        if(!region.length)continue;
        const anchors=region.filter(i=>board[i]===secondary);
        // Future mandatory bridge cells also need distinct complementary
        // primaries to clear. Count those obligations before building them.
        const obligations=region.filter(i=>board[i]===secondary || reservations.get(i)?.secondary===secondary);
        const regionSet=new Set(region);
        const suppliers=allBlobs.filter(g=>board[g[0]]===complement && g.some(i=>adjacency[i].some(j=>regionSet.has(j))));
        const capacity=Math.min(...bits.map(bit=>region.filter(i=>board[i]&bit).length));
        const distance=Array(board.length).fill(Infinity),queue=[];
        for (const i of region) if (adjacency[i].some(j=>board[j]===complement)) {distance[i]=1;queue.push(i);}
        for (const i of queue) for (const j of adjacency[i]) if (regionSet.has(j) && distance[j]===Infinity) {distance[j]=distance[i]+1;queue.push(j);}
        // Keep whole blob boundaries for reachability: a donor can transfer
        // through a reserved primary before that primary changes color.
        // The reserved tile itself cannot also supply a clearing elsewhere.
        const profile={cells:region,anchors,obligations,capacity,distance,suppliers:suppliers.flat().filter(i=>!reservations.has(i)),supplierBlobs:suppliers};
        regions.push(profile);
        for (const i of region) byCell[i]=profile;
      }
      profiles.set(secondary,{byCell,regions});
    }
    return profiles;
  }
  // Being in the same possible-secondary region is not enough: a bridge
  // to a particular supplier needs one secondary tile at every step. There
  // cannot be more such tiles than the region's component capacity, even
  // over time, because a cleared cell never becomes colored again.
  function reachableSuppliers(region,start,adjacency) {
    if(!region.supplierDistances) {
      const cells=new Set(region.cells);
      region.supplierDistances=region.supplierBlobs.map(blob=>{
        const boundary=new Set(blob),distance=Array(adjacency.length).fill(Infinity),queue=[];
        for(const i of region.cells)if(adjacency[i].some(j=>boundary.has(j))){distance[i]=1;queue.push(i);}
        for(const i of queue)for(const j of adjacency[i])if(cells.has(j)&&distance[j]===Infinity){distance[j]=distance[i]+1;queue.push(j);}
        return {blob,distance};
      });
    }
    return region.supplierDistances.filter(({distance})=>distance[start]<=region.capacity).flatMap(({blob})=>blob.filter(i=>region.suppliers.includes(i)));
  }
  function trapReason(board, adjacency, allBlobs, profiles) {
    for (const [secondary,{regions}] of profiles) {
      for (const region of regions) {
        if (region.suppliers.length<region.obligations.length) return {type:'missing-complement',color:names[secondary]};
        const tile=region.anchors.find(i=>region.distance[i]>region.capacity);
        if (tile!==undefined) return {type:'trapped-secondary',tile,color:names[secondary],capacity:region.capacity,required:region.distance[tile]};
      }
      // Different secondary regions can compete for the same primary blob.
      // A clearing consumes a distinct primary tile. Maximum matching checks
      // all combinations of competing regions without enumerating subsets.
      const demands=regions.flatMap(r=>r.obligations.map(i=>reachableSuppliers(r,i,adjacency)));
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
          if (region && [tile,...partner].some(i=>region.distance[i]<=region.capacity)) {escape=true;break;}
        }
        if (!escape) return {type:'trapped-primary',tile,color:names[color]};
      }
    }
    return null;
  }
  // A secondary never moves or changes color. If every optimistic route
  // for clearing a tile needs a particular cell in that secondary color,
  // reserve it. Conflicting reservations prove impossibility, even if the
  // routes would be attempted at different times (white is permanent).
  function mandatoryColorReason(board, adjacency, allBlobs, profiles, reservations=new Map(), planning=null) {
    const owner=new Map(allBlobs.flatMap(g=>g.map(i=>[i,g])));
    const reachCache=new Map(), resourceDemands=new Map();
    function reachesBoundary(secondary, blocked) {
      const key=`${secondary}:${blocked}`;
      if(reachCache.has(key))return reachCache.get(key);
      const {byCell}=profiles.get(secondary),seen=new Set(),queue=[];
      for(let i=0;i<board.length;i++) {
        if(i!==blocked && byCell[i] && byCell[i].distance[i]===1) {
          seen.add(i);queue.push(i);
        }
      }
      for(const i of queue)for(const j of adjacency[i]) {
        if(j!==blocked && byCell[j] && !seen.has(j)){seen.add(j);queue.push(j);}
      }
      reachCache.set(key,seen);return seen;
    }
    for(let tile=0;tile<board.length;tile++) {
      const color=board[tile];if(!color)continue;
      const routes=new Map();
      function add(secondary, starts, direct=false, partner=[]) {
        const {byCell}=profiles.get(secondary);
        if(reservations.has(tile)) {
          if(direct||reservations.get(tile).secondary!==secondary)return;
          starts=starts.filter(i=>i===tile);
        }
        const possible=starts.filter(i=>byCell[i] && (direct
          ? byCell[i].capacity>0
          : byCell[i].distance[i]<=byCell[i].capacity));
        if(!possible.length)return;
        if(!routes.has(secondary))routes.set(secondary,{starts:new Set(),direct,partners:new Set()});
        for(const i of possible)routes.get(secondary).starts.add(i);
        for(const i of partner)routes.get(secondary).partners.add(i);
      }
      if([3,5,6].includes(color))add(color,[tile]);
      else {
        const blob=owner.get(tile);
        const neighbors=[...new Set(blob.flatMap(i=>adjacency[i]))]
          .filter(i=>board[i] && board[i]!==color);
        // Allow a future complementary secondary beside ANY surviving
        // member of the primary blob. This is deliberately optimistic.
        add(7^color,neighbors,true);
        const partners=new Set(neighbors.filter(i=>[1,2,4].includes(board[i])).map(i=>owner.get(i)));
        for(const partner of partners)add(color|board[partner[0]],[tile,...partner],false,partner);
      }
      // Each primary needs one DISTINCT unit of each missing component.
      // Union supplies across all optimistic routes, including direct clears
      // against future secondaries. Checking routes individually would allow
      // several tiles to spend the same scarce component repeatedly.
      if([1,2,4].includes(color))for(const bit of [1,2,4].filter(b=>b!==color)) {
        const supplies=new Set();
        for(const [secondary,route] of routes)for(const start of route.starts) {
          const region=profiles.get(secondary).byCell[start];
          // Primaries never grow or acquire new same-color links. A first
          // mix must consume a tile from an already linked partner blob,
          // not a distant primary in the potential secondary region.
          const possible=(secondary&bit)
            ? (route.direct ? region.cells.filter(i=>board[i]&bit) : route.partners)
            : reachableSuppliers(region,start,adjacency);
          for(const i of possible)supplies.add(i);
        }
        const key=`${color}:${bit}`;
        if(!resourceDemands.has(key))resourceDemands.set(key,{color,bit,demands:[]});
        resourceDemands.get(key).demands.push({tile,supplies:[...supplies]});
      }
      // Alternative secondary colors do not force a specific color here.
      if(routes.size!==1)continue;
      const [secondary,route]=routes.entries().next().value;
      const starts=[...route.starts];
      const candidates=route.direct ? (starts.length===1?starts:[])
        : board.flatMap((_,i)=>profiles.get(secondary).byCell[i]?[i]:[]);
      for(const cell of candidates) {
        if(!route.direct && starts.some(i=>reachesBoundary(secondary,cell).has(i)))continue;
        const previous=reservations.get(cell);
        if(previous && previous.secondary!==secondary)return {
          type:'mandatory-color-conflict',tile:cell,
          colors:[names[previous.secondary],names[secondary]],
          witnesses:[previous.tile,tile]
        };
        if(!reservations.has(cell))reservations.set(cell,{secondary,tile});
      }
    }
    // Hall's condition via matching catches shortages shared by several
    // blobs too. Match each missing component separately: accepting a board
    // is optimistic, while a failed matching is a proof of impossibility.
    if(planning)planning.resourceDemands=resourceDemands;
    for(const {color,bit,demands} of resourceDemands.values()) {
      const matched=new Map();
      function assign(index,seen) {
        for(const supplier of demands[index].supplies) {
          if(seen.has(supplier))continue;
          seen.add(supplier);
          if(!matched.has(supplier)||assign(matched.get(supplier),seen)) {
            matched.set(supplier,index);return true;
          }
        }
        return false;
      }
      for(let i=0;i<demands.length;i++)if(!assign(i,new Set()))return {
        type:'primary-component-shortage',color:names[color],component:names[bit],
        tiles:demands.map(d=>d.tile)
      };
    }
    const bridgeShortage=bridgeSupplyReason(board,adjacency,profiles,resourceDemands);
    if(bridgeShortage)return bridgeShortage;
    // Required secondary bridges must coexist: clearing a bridge leaves
    // permanent white. Their primary cells cannot also be sacrificed as
    // donors to build another required bridge cell, even at a different time.
    const bridgeDemands=new Map();
    for(const [tile,{secondary}] of reservations) {
      const color=board[tile];
      if(![1,2,4].includes(color))continue;
      const needed=secondary^color,blob=owner.get(tile);
      const partners=new Set(blob.flatMap(i=>adjacency[i])
        .filter(i=>board[i]===needed).map(i=>owner.get(i)));
      const supplies=[...partners].flat().filter(i=>!reservations.has(i));
      if(!bridgeDemands.has(needed))bridgeDemands.set(needed,[]);
      bridgeDemands.get(needed).push({tile,supplies});
    }
    for(const [component,demands] of bridgeDemands) {
      const matched=new Map();
      function assign(index,seen) {
        for(const supplier of demands[index].supplies) {
          if(seen.has(supplier))continue;
          seen.add(supplier);
          if(!matched.has(supplier)||assign(matched.get(supplier),seen)) {
            matched.set(supplier,index);return true;
          }
        }
        return false;
      }
      for(let i=0;i<demands.length;i++)if(!assign(i,new Set()))return {
        type:'mandatory-mix-shortage',component:names[component],
        tiles:demands.map(d=>d.tile)
      };
    }
    return sealedRegionReason(board,adjacency,profiles,reservations,owner);
  }
  // A bridge and unrelated primaries must share a finite pool of donors.
  // Count primaries already forced to spend that pool, then find the cheapest
  // secondary path, charging only additional primary receivers on that path.
  // Every such receiver needs a distinct donor from the region's pool.
  // Existing secondaries and cells already holding the supplied component
  // cost zero (optimistically); counted primaries cost zero to avoid double
  // charging. Dijkstra finds a lower bound, not a sequence of game moves.
  // Test each anchor separately: summing paths could double-count bridges.
  function bridgeSupplyReason(board,adjacency,profiles,resourceDemands) {
    for(const [secondary,{regions}] of profiles)for(const region of regions) {
      if(!region.anchors.length)continue;
      for(const component of [1,2,4].filter(bit=>secondary&bit)) {
        const other=secondary^component;
        const supplies=new Set(region.cells.filter(i=>board[i]===component));
        const forced=new Set((resourceDemands.get(`${other}:${component}`)?.demands||[])
          .filter(d=>d.supplies.length && d.supplies.every(i=>supplies.has(i))).map(d=>d.tile));
        if(!forced.size)continue;
        const cells=new Set(region.cells);
        for(const anchor of region.anchors) {
          const distance=new Map([[anchor,0]]),pending=new Set([anchor]);
          let extra=Infinity;
          while(pending.size) {
            let tile;for(const i of pending)if(tile===undefined||distance.get(i)<distance.get(tile))tile=i;
            pending.delete(tile);
            const cost=distance.get(tile);
            if(region.distance[tile]===1){extra=cost;break;}
            for(const next of adjacency[tile])if(cells.has(next)) {
              const nextCost=cost+(board[next]===other&&!forced.has(next)?1:0);
              if(nextCost<(distance.get(next)??Infinity)){distance.set(next,nextCost);pending.add(next);}
            }
          }
          if(forced.size+extra>supplies.size)return {
            type:'secondary-bridge-supply-conflict',tile:anchor,color:names[secondary],
            component:names[component],supplies:[...supplies],
            forced:[...forced],required:forced.size+extra,available:supplies.size
          };
        }
      }
    }
    return null;
  }
  // Exact local ordering with deliberately unlimited external complements.
  // Only inspect small regions whose primary interactions with the outside
  // are blocked by mandatory secondary cells. Other regions remain untouched.
  function sealedRegionReason(board,adjacency,profiles,reservations,owner) {
    for(const [secondary,{regions}] of profiles)for(const region of regions) {
      if(region.cells.length>10 || !region.cells.some(i=>reservations.get(i)?.secondary===secondary))continue;
      const cells=new Set(region.cells),complement=7^secondary;
      let sealed=true;
      for(const i of cells)if(board[i]!==secondary) {
        // A primary blob spanning the boundary could transfer material out.
        if(owner.get(i).some(j=>!cells.has(j))){sealed=false;break;}
        if(adjacency[i].some(j=>!cells.has(j)&&board[j]&&!(board[i]&board[j])) &&
          !(reservations.get(i)?.secondary===secondary && owner.get(i).length===1)) {
          sealed=false;break;
        }
      }
      if(!sealed)continue;
      const boundary=new Set(region.cells.filter(i=>adjacency[i].some(j=>!cells.has(j)&&board[j]===complement)));
      const initial=board.map((c,i)=>cells.has(i)?c:0),dead=new Set();let budget=2000;
      function visit(local) {
        if(local.every(c=>!c))return true;
        const key=local.join('');if(dead.has(key))return false;
        if(budget--<=0)return null;
        const localBlobs=blobs(local,adjacency);
        // An outside complement may clear any member of a linked secondary
        // blob. Treat it as inexhaustible, so failure remains a sound proof.
        for(const blob of localBlobs)if(local[blob[0]]===secondary && blob.some(i=>boundary.has(i))) {
          for(const i of blob){const next=local.slice();next[i]=0;const result=visit(next);if(result!==false)return result;}
        }
        for(const move of moves(local,adjacency,localBlobs)) {
          if(reservations.has(move.source))continue;
          const result=visit(move.next);if(result!==false)return result;
        }
        dead.add(key);return false;
      }
      if(visit(initial)===false)return {type:'sealed-region-ordering',color:names[secondary],tiles:region.cells};
    }
    return null;
  }
  function forcedClearReason(board,adjacency,profiles) {
    for(const {regions} of profiles.values())for(const region of regions) {
      // Use the entire possible secondary region, not just today's adjacent
      // cells. One anchor and one possible complementary primary force a pair.
      // That primary is a singleton blob (otherwise all its cells are supplies).
      // Neither cell can be spent elsewhere in a solution; no other clearing
      // can use the secondary as a bridge because it has no other supplier.
      // The forced clearing therefore commutes with all other successful moves.
      if(region.anchors.length!==1 || region.suppliers.length!==1 || region.supplierBlobs.some(g=>g.length!==1))continue;
      const secondary=region.anchors[0],primary=region.suppliers[0];
      // Only use a pair that can clear now. A hypothetical later connection
      // could require other moves before the removal becomes legal.
      if(!adjacency[secondary].includes(primary))continue;
      const after=board.slice();after[secondary]=0;after[primary]=0;
      if(!balancedComponents(after,adjacency))return {
        type:'forced-clear-disconnection',secondary,primary
      };
    }
    return null;
  }
  // A pocket with a single exit must be able to clear its interior even
  // with unlimited help outside that exit. Keep actual local mixing and
  // connectivity: a bridge tile cannot simultaneously be spent as a donor.
  function pocketReason(board,adjacency,profiles) {
    const occupied=board.flatMap((c,i)=>c?[i]:[]);
    let budget=2000;
    for(const component of groups(occupied,adjacency))for(const exit of component) {
      const parts=groups(component.filter(i=>i!==exit),adjacency);
      if(parts.length<2)continue;
      for(const inside of parts) {
        // Include eight-cell pockets; the October 4 upper-blue obstruction
        // needs both its two-cell blob and the complete approach to the exit.
        if(inside.length<2 || inside.length>8)continue;
        const cells=[...inside,exit],included=new Set(cells);
        const outside=adjacency[exit].filter(i=>board[i]&&!included.has(i));
        const colors=new Set(outside.map(i=>board[i]));
        for(const secondary of [3,5,6])if(outside.some(i=>profiles.get(secondary).byCell[i]))colors.add(secondary);
        const localAdj=cells.map(i=>adjacency[i].filter(j=>included.has(j)).map(j=>cells.indexOf(j)));
        const dead=new Set(),portal=cells.length-1;
        function visit(local) {
          // The exit itself need not clear: the real outside may handle it.
          if(local.slice(0,portal).every(c=>!c))return true;
          const key=local.join('');if(dead.has(key))return false;
          if(budget--<=0)return null;
          const localBlobs=blobs(local,localAdj);
          const linked=localBlobs.find(g=>g.includes(portal));
          if(linked) {
            const color=local[portal];
            // An outside same-color connection may lead to distant donors
            // or receivers. Grant all of them, so no real escape is lost.
            const supplies=colors.has(color)?[1,2,3,4,5,6]:[...colors];
            for(const other of supplies)if(!(color&other))for(const i of linked) {
              const next=local.slice();next[i]=0;
              let result=visit(next);if(result!==false)return result;
              const combined=color|other;
              if(combined!==7){next[i]=combined;result=visit(next);if(result!==false)return result;}
            }
            // A blob extending outside also supplies/receives its own color
            // across any link on its inside portion, not just at the exit.
            if(colors.has(color))for(const blob of localBlobs) {
              const other=local[blob[0]];
              if((color&other) || !blob.some(i=>localAdj[i].some(j=>linked.includes(j))))continue;
              for(const i of blob) {
                const next=local.slice();next[i]=0;
                let result=visit(next);if(result!==false)return result;
                const combined=color|other;
                if(combined!==7){next[i]=combined;result=visit(next);if(result!==false)return result;}
              }
            }
          }
          for(const move of moves(local,localAdj,localBlobs)) {
            const result=visit(move.next);if(result!==false)return result;
          }
          dead.add(key);return false;
        }
        if(visit(cells.map(i=>board[i]))===false)return {type:'pocket-supply-conflict',exit,tiles:inside};
        if(budget<=0)return null;
      }
    }
    return null;
  }
  // Solve a relaxed bridge subproblem by choosing the cells that will EVER
  // become this secondary. This ignores move order and permits original blob
  // transfers throughout, so it overestimates possibilities. Every surviving
  // layout must fund its mixes and clear every bridge cell with a distinct
  // complementary primary. If even this relaxation fails, no play can work.
  function bridgeLayoutReason(board,adjacency,allBlobs,profiles,reservations,resourceDemands) {
    const owner=new Map(allBlobs.flatMap(g=>g.map(i=>[i,g])));
    const match=demands=>{
      const used=new Map();
      function assign(k,seen){for(const i of demands[k]){if(seen.has(i))continue;seen.add(i);if(!used.has(i)||assign(used.get(i),seen)){used.set(i,k);return true;}}return false;}
      return demands.every((_,k)=>assign(k,new Set()));
    };
    for(const [color,{regions}] of profiles)for(const region of regions) {
      const variables=region.cells.filter(i=>board[i]!==color);
      // Even one existing secondary can require an unfundable bridge.
      if(!region.anchors.length || variables.length>10)continue;
      const mandatory=variables.filter(i=>reservations.get(i)?.secondary===color);
      const donors=new Map(variables.map(i=>[i,[...new Set(owner.get(i).flatMap(j=>adjacency[j]))]
        .filter(j=>board[j]===(color^board[i])).flatMap(j=>owner.get(j))]));
      const forced=[];
      for(const i of variables){
        const c=board[i],neighbors=[...new Set(owner.get(i).flatMap(j=>adjacency[j]))];
        // Optimistically allow any alternative secondary route. Only impose
        // a clause when this primary must be spent in the selected color.
        const direct=profiles.get(7^c);
        if(neighbors.some(j=>direct.byCell[j]?.capacity>0))continue;
        if(neighbors.some(j=>[1,2,4].includes(board[j])&&board[j]!==c&&(board[j]|c)!==color))continue;
        forced.push([i,...donors.get(i)]);
      }
      let feasible=false, budget=10000;
      for(let mask=0;mask<2**variables.length;mask++){
        const chosen=new Set([...region.anchors,...variables.filter((_,k)=>mask&(1<<k))]);
        if(mandatory.some(i=>!chosen.has(i))||forced.some(clause=>!clause.some(i=>chosen.has(i))))continue;
        const mixing=[...chosen].filter(i=>board[i]!==color).map(i=>donors.get(i).filter(j=>!chosen.has(j)&&!reservations.has(j)));
        if(!match(mixing))continue;
        const demands=[];
        for(const component of groups([...chosen],adjacency)){
          const cells=new Set(component);
          const supplies=region.supplierBlobs.filter(g=>g.some(i=>adjacency[i].some(j=>cells.has(j))))
            .flat().filter(i=>region.suppliers.includes(i));
          for(const i of component)demands.push(supplies);
        }
        if(!match(demands))continue;
        // A red spent clearing this green layout cannot also clear a blue
        // or yellow elsewhere. Try donor assignments for the corridor and
        // match the remaining obligations against the SAME red resources.
        const consumed=new Set(chosen);
        function fund(k) {
          if(--budget<0)return true; // Unknown remains possible.
          if(k===mixing.length) {
            for(const component of [1,2,4].filter(c=>color&c)) {
              const others=(resourceDemands.get(`${component}:${7^color}`)?.demands||[])
                .filter(d=>!consumed.has(d.tile)).map(d=>d.supplies);
              if(!match([...demands,...others]))return false;
            }
            return true;
          }
          for(const donor of mixing[k])if(!consumed.has(donor)) {
            consumed.add(donor);const possible=fund(k+1);consumed.delete(donor);
            if(possible)return true;
          }
          return false;
        }
        if(fund(0)){feasible=true;break;}
      }
      if(!feasible)return {type:'bridge-layout-conflict',color:names[color],tiles:region.cells};
    }
    return null;
  }
  // A primary blob behind a singleton primary gate needs more than one
  // clearing through that gate. If its missing third color has at most one
  // adjacent donor, making the complementary secondary consumes that donor:
  // it cannot ALSO become a bridge extending the gate's clearing capacity.
  function primaryGateReason(board,adjacency,allBlobs) {
    const owner=new Map(allBlobs.flatMap(g=>g.map(i=>[i,g])));
    for(const blob of allBlobs) {
      const color=board[blob[0]];
      if(![1,2,4].includes(color)||blob.length<2)continue;
      const members=new Set(blob);
      const boundary=[...new Set(blob.flatMap(i=>adjacency[i]))].filter(i=>board[i]&&!members.has(i));
      if(boundary.length!==1)continue;
      const gate=boundary[0],gateColor=board[gate];
      if(![1,2,4].includes(gateColor)||owner.get(gate).length!==1)continue;
      const third=7^(color|gateColor),neighbors=adjacency[gate].filter(i=>board[i]);
      // Existing secondaries could extend a future clearing blob. Leave such
      // positions to the general analysis rather than excluding an escape.
      if(neighbors.some(i=>board[i]!==color&&board[i]!==third))continue;
      const donors=new Set(neighbors.filter(i=>board[i]===third).flatMap(i=>owner.get(i)));
      if(donors.size<=1)return {type:'single-gate-shortage',tiles:blob,gate,required:blob.length,available:1};
    }
    return null;
  }
  // Primaries with a sole secondary exit must all clear through its blob.
  // Every secondary cell ever used by that blob belongs to a connected
  // layout rooted at the exit. Its original primary receivers cannot also
  // donate to build that layout, even if their clearing times differ.
  // Enumerate small connected layouts with optimistic original-blob access;
  // exhausted enumeration proves a capacity bound, budget exhaustion does not.
  function secondaryArmReason(board,adjacency,allBlobs,profiles) {
    const owner=new Map(allBlobs.flatMap(g=>g.map(i=>[i,g])));
    for(const blob of allBlobs) {
      const primary=board[blob[0]];
      if(![1,2,4].includes(primary)||blob.length<2)continue;
      const members=new Set(blob);
      const boundary=[...new Set(blob.flatMap(i=>adjacency[i]))].filter(i=>board[i]&&!members.has(i));
      if(boundary.length!==1||board[boundary[0]]!==(7^primary))continue;
      const gate=boundary[0],color=board[gate],region=profiles.get(color).byCell[gate];
      if(!region)continue;
      const allowed=new Set(region.cells),queue=[owner.get(gate)],seen=new Set();
      let budget=256,capacity=0,unknown=false;
      while(queue.length) {
        if(budget--<=0){unknown=true;break;}
        const cells=[...new Set(queue.pop())].sort((a,b)=>a-b),key=cells.join(',');
        if(seen.has(key))continue;seen.add(key);
        const chosen=new Set(cells),demands=cells.filter(i=>board[i]!==color).map(i=>{
          const needed=color^board[i];
          return [...new Set(owner.get(i).flatMap(j=>adjacency[j])
            .filter(j=>board[j]===needed).flatMap(j=>owner.get(j)))].filter(j=>!chosen.has(j));
        });
        const assigned=new Map();
        function assign(k,visited){for(const donor of demands[k]){
          if(visited.has(donor))continue;visited.add(donor);
          if(!assigned.has(donor)||assign(assigned.get(donor),visited)){assigned.set(donor,k);return true;}
        }return false;}
        if(!demands.every((_,k)=>assign(k,new Set())))continue;
        capacity=Math.max(capacity,cells.length);
        if(capacity>=blob.length){unknown=true;break;}
        for(const next of new Set(cells.flatMap(i=>adjacency[i])))
          if(allowed.has(next)&&!chosen.has(next))queue.push([...cells,next]);
      }
      if(!unknown)return {type:'secondary-arm-capacity',tiles:blob,gate,color:names[color],required:blob.length,available:capacity};
    }
    return null;
  }
  // A lone edge between different primaries can carry its missing component
  // only after BOTH endpoints join the secondary made of those primaries.
  // If one side lacks that third component, it must reach that spanning blob.
  // Before then every cross-edge mix consumes one original tile of the far
  // endpoint's primary blob and reduces (near endpoint color - far color)
  // by one. Local clears preserve that difference. A shortage in that finite
  // donor/receiver blob therefore proves the connection cannot do its job.
  function narrowConnectionReason(board,adjacency,allBlobs) {
    const primary=c=>c===1||c===2||c===4;
    const owner=new Map(allBlobs.flatMap(g=>g.map(i=>[i,g])));
    for(let a=0;a<board.length;a++)if(primary(board[a]))for(const b of adjacency[a]){
      if(b<=a||!primary(board[b])||board[a]===board[b])continue;
      const side=[a],seen=new Set(side);
      for(const i of side)for(const j of adjacency[i])if(board[j]&&
        !((i===a&&j===b)||(i===b&&j===a))&&!seen.has(j)){seen.add(j);side.push(j);}
      if(seen.has(b))continue; // Alternate route: this edge is not a bottleneck.
      const other=[b],outside=new Set(other);
      for(const i of other)for(const j of adjacency[i])if(board[j]&&!seen.has(j)&&!outside.has(j)){outside.add(j);other.push(j);}
      for(const [near,far,cells] of [[a,b,side],[b,a,other]]){
        const x=board[near],y=board[far],third=7^(x|y);
        const count=bit=>cells.reduce((n,i)=>n+!!(board[i]&bit),0);
        const nx=count(x),ny=count(y),nt=count(third);
        if(nt>=Math.min(nx,ny))continue;
        const required=nx-ny,available=owner.get(far).length;
        if(required>available)return {type:'narrow-connection-capacity',connection:[near,far],
          color:names[x],third:names[third],totals:[nx,ny,nt],required,available,tiles:cells};
      }
    }
    return null;
  }
  // Check the actual ordering around a primary gate, with unlimited external
  // help. Original blobs are included whole: converting a contact must really
  // sever its donor access. External possible secondary regions may connect
  // matching local secondaries, deliberately overestimating future access.
  function primaryGateOrderingReason(board,adjacency,allBlobs,profiles) {
    const primary=c=>c===1||c===2||c===4;
    const owner=new Map(allBlobs.flatMap(g=>g.map(i=>[i,g])));
    for(const target of allBlobs){
      const color=board[target[0]];if(!primary(color)||target.length<2)continue;
      const members=new Set(target),boundary=[...new Set(target.flatMap(i=>adjacency[i]))].filter(i=>board[i]&&!members.has(i));
      if(boundary.length!==1||!primary(board[boundary[0]]))continue;
      const gate=boundary[0],gateBlob=owner.get(gate),third=7^(color|board[gate]);
      const donors=[...new Set(gateBlob.flatMap(i=>adjacency[i]).filter(i=>board[i]===third).map(i=>owner.get(i)))];
      const cells=[...new Set([...target,...gateBlob,...donors.flat()])];
      if(cells.length>9)continue;
      const included=new Set(cells),localAdj=cells.map(i=>adjacency[i].filter(j=>included.has(j)).map(j=>cells.indexOf(j)));
      const outside=cells.map(i=>adjacency[i].filter(j=>board[j]&&!included.has(j)));
      const options=outside.map(neighbors=>{
        const colors=new Set(neighbors.map(i=>board[i]));
        for(const secondary of [3,5,6])if(neighbors.some(i=>profiles.get(secondary).byCell[i]))colors.add(secondary);
        return colors;
      });
      const contacts=new Map([3,5,6].map(c=>[c,outside.map(ns=>new Set(ns.map(i=>profiles.get(c).byCell[i]).filter(Boolean)))]));
      let budget=8192;const dead=new Set(),targets=target.map(i=>cells.indexOf(i));
      function visit(local){
        if(targets.every(i=>!local[i]))return true;
        const key=local.join('');if(dead.has(key))return false;
        if(budget--<=0)return null;
        const links=localAdj.map(ns=>ns.slice());
        for(let i=0;i<cells.length;i++)if(contacts.has(local[i]))for(let j=i+1;j<cells.length;j++)
          if(local[j]===local[i]&&[...contacts.get(local[i])[i]].some(r=>contacts.get(local[i])[j].has(r))){links[i].push(j);links[j].push(i);}
        const localBlobs=blobs(local,links);
        for(const blob of localBlobs){
          const c=local[blob[0]],available=new Set(blob.flatMap(i=>[...options[i]]));
          if(!primary(c)&&available.has(c)){
            available.add(7^c);
            // An exterior extension can receive a complementary local
            // primary, clearing that primary without consuming our bridge.
            for(const otherBlob of localBlobs)if(!(c&local[otherBlob[0]])&&
              otherBlob.some(i=>links[i].some(j=>blob.includes(j))))for(const i of otherBlob){
              const next=local.slice();next[i]=0;const result=visit(next);if(result!==false)return result;
            }
          }
          for(const other of available)if(!(c&other))for(const i of blob){
            const next=local.slice();next[i]=0;
            let result=visit(next);if(result!==false)return result;
            const combined=c|other;
            if(primary(other)&&combined!==7){next[i]=combined;result=visit(next);if(result!==false)return result;}
          }
        }
        for(const move of moves(local,links,localBlobs)){const result=visit(move.next);if(result!==false)return result;}
        dead.add(key);return false;
      }
      if(visit(cells.map(i=>board[i]))===false)return {type:'primary-gate-ordering',tiles:target,gate,contacts:cells};
    }
    return null;
  }
  function rejectionReason(board,adjacency,allBlobs,reservations=new Map()) {
    if (!balancedComponents(board,adjacency)) return {type:'unbalanced-component'};
    // Propagate necessary colors to a fixed point, never guessing a move.
    // Each repeat reserves at least one more cell, so at most board.length
    // repeats are possible. Incompatible reservations exclude those cells
    // from other secondary paths and from their component capacities.
    for(;;) {
      const size=reservations.size;
      const profiles=secondaryRegions(board,adjacency,allBlobs,reservations),planning={};
      const reason=secondaryArmReason(board,adjacency,allBlobs,profiles) ||
        trapReason(board,adjacency,allBlobs,profiles) ||
        forcedClearReason(board,adjacency,profiles) ||
        mandatoryColorReason(board,adjacency,allBlobs,profiles,reservations,planning) ||
        pocketReason(board,adjacency,profiles);
      if(reason)return reason;
      if(reservations.size===size){
        const obstruction=primaryGateReason(board,adjacency,allBlobs) ||
        bridgeLayoutReason(board,adjacency,allBlobs,profiles,reservations,planning.resourceDemands) ||
        narrowConnectionReason(board,adjacency,allBlobs) ||
        primaryGateOrderingReason(board,adjacency,allBlobs,profiles);
        if(obstruction)return obstruction;
        // Every winning first move must preserve balance in each occupied
        // component. Reject the parent if no legal move can do so.
        if(board.some(Boolean)&&board.filter(Boolean).length<=32&&
          !moves(board,adjacency,allBlobs).some(move=>balancedComponents(move.next,adjacency)))
          return {type:'no-balanced-successor'};
        return null;
      }
    }
  }
  function assess(tiles,adjacency) {
    const board=tiles.map(c=>masks[c]);
    const reason=rejectionReason(board,adjacency,blobs(board,adjacency));
    // Passing these necessary conditions is not a proof of solvability.
    return {unsolvable:reason!==null,reason};
  }
  function moves(board, adjacency, allBlobs) {
    const owner=new Map(allBlobs.flatMap((g,k)=>g.map(i=>[i,k]))), links=new Set(), result=[];
    // Occupancy changes only at removed cells. Reuse the base degree score
    // and update those cells and their neighbors instead of rescanning the board.
    const degree=board.map((c,i)=>c?adjacency[i].reduce((n,j)=>n+(board[j]?1:0),0):0);
    const contribution=d=>d*d-(d===1?15:d===0?100:0);
    const base=board.reduce((n,c,i)=>n+(c?contribution(degree[i]):0),0),scores=new Map();
    function remainderScore(source,target,clear){
      const key=clear?board.length+Math.min(source,target)*board.length+Math.max(source,target):source;
      if(scores.has(key))return scores.get(key);
      const removed=clear?[source,target]:[source],affected=new Set(removed.flatMap(i=>[i,...adjacency[i]]));
      let score=base;
      for(const i of affected)if(board[i]){
        score-=contribution(degree[i]);
        if(!removed.includes(i))score+=contribution(degree[i]-removed.reduce((n,j)=>n+(adjacency[i].includes(j)?1:0),0));
      }
      scores.set(key,score);return score;
    }
    board.forEach((c,i)=>{if(c)for(const j of adjacency[i])if(board[j] && !(c&board[j])){
      const a=owner.get(i),b=owner.get(j);links.add(a<b?`${a},${b}`:`${b},${a}`);
    }});
    for(const link of links){const [a,b]=link.split(',').map(Number);
      for(const i of allBlobs[a])for(const j of allBlobs[b]){
        const combined=board[i]|board[j];
        const add=(source,target)=>{
          const next=board.slice();next[source]=0;next[target]=combined===7?0:combined;
          // Internal enumeration order only. The planner must validate a
          // complete job and continuation before any move can be displayed.
          let score=combined===7?100000:0;
          if(combined!==7 && adjacency[target].some(k=>board[k]===(7^combined)))score+=10000;
          // Prefer a compact remainder, but keep every legal alternative.
          score+=remainderScore(source,target,combined===7);
          result.push({source,target,next,score});
        };
        add(i,j);if(combined!==7)add(j,i);
      }
    }
    return result.sort((a,b)=>b.score-a.score);
  }
  // One verified continuation survives Stop/Start. Reuse requires the exact
  // board and graph, so edits or a different deal cannot inherit stale plans.
  let continuation=null;
  // Only context-independent failure proofs enter this cache. Retain it across
  // Stop/Start; sleep-set-relative failures remain local and are never saved.
  // A different graph or cache limit replaces the retained memory.
  let proofMemory=null;
  // Strategic search has two distinct layers. A bounded planner searches whole
  // clearing jobs, including their actual donor assignments and execution order.
  // If its vocabulary/budget is insufficient, complete search stays silent.
  // Verified mode waits for a complete continuation. Progressive mode bounds
  // the planning pass, then emits legal attempts and exact failed-branch undos.
  // Cache eviction trades repeated work for bounded retained memory. It never
  // alters the live DFS stack or records an unresolved board as impossible.
  function boundedMap(limit) {
    const cache=new Map(),set=cache.set;
    cache.set=function(key,value){
      set.call(this,key,value);
      if(this.size>limit)this.delete(this.keys().next().value);
      return this;
    };
    return cache;
  }
  function boundedSet(limit) {
    const cache=new Set(),add=cache.add,has=cache.has;
    cache.evictions=0;
    // Refresh reused proofs rather than evicting frequently encountered states.
    cache.has=function(key){if(!has.call(this,key))return false;this.delete(key);add.call(this,key);return true;};
    cache.add=function(key){
      this.delete(key);add.call(this,key);
      if(this.size>limit){this.delete(this.values().next().value);this.evictions++;}
      return this;
    };
    return cache;
  }
  function* solveAttempt(tiles, adjacency, {
    strategyStates=120000, sectionStates=120000, sectionWidth=8, sectionRestarts=16, sectionEndgameTiles=24, sectionEndgameStates=65536, localStates=1536, planVariants=24, layoutLimit=192, bridgeStates=16384,
    assessmentCacheEntries=2048, failedCacheEntries=500000, solutionCacheEntries=512, planningVariant=0, moveTreeSearch=true, history=[], lookaheadStates, endgameTiles, progressive=false, stopBeforeExhaustive=false, strategyOnly=false, batchGroups=0, proofTiles=20, proofStates=16384, frontierStates=65536, commuteMoves=true, bridgePlanning=false, bridgeWidth=8, bridgeGoalBudget=18, bridgeJobStates=96, bridgeVariants=4, bridgePathStates=256, bridgeTailStates=3000
  } = {}) {
    // Accept the old options for saved integrations; they no longer authorize
    // speculative playback or change the meaning of an unresolved position.
    for(const [key,value] of Object.entries({assessmentCacheEntries,failedCacheEntries,solutionCacheEntries,strategyStates,sectionStates,sectionWidth,sectionRestarts,sectionEndgameTiles,sectionEndgameStates,localStates,planVariants,layoutLimit,bridgeStates,lookaheadStates,endgameTiles,batchGroups,proofTiles,proofStates,frontierStates,bridgeWidth,bridgeGoalBudget,bridgeJobStates,bridgeVariants,bridgePathStates,bridgeTailStates}))
      if(value!==undefined && (!Number.isSafeInteger(value)||value<0))throw new RangeError(`${key} must be a nonnegative safe integer`);
    // Strategic lanes skip individual-move proofs; the diagnostic lane may
    // use them. Planning limits bound effort, not bridge length.
    if(!moveTreeSearch)strategyOnly=true;
    const graphKey=JSON.stringify(adjacency);
    if(continuation?.graph===graphKey&&(!strategyOnly||continuation.strategic)&&
      (moveTreeSearch||continuation.events.every(e=>e.plan.kind==='clear-secondary'))){
      const start=continuation.events.findIndex(e=>e.before.every((c,i)=>c===tiles[i])&&e.before.length===tiles.length);
      if(start>=0){for(const event of continuation.events.slice(start))yield event;return 'solved';}
    }
    if(!proofMemory || proofMemory.graph!==graphKey || proofMemory.limit!==failedCacheEntries)
      proofMemory={graph:graphKey,limit:failedCacheEntries,dead:boundedSet(failedCacheEntries)};
    const proofCache=proofMemory;
    const assessments=boundedMap(assessmentCacheEntries),dead=proofCache.dead,winning=boundedMap(solutionCacheEntries);
    const retainedFailures=dead.size;
    let frontiers=[];
    let positions=0,plansTried=0;

    let proofDepth=0,proofProgress=null;
    const proofStats={calls:0,cacheHits:0,commuted:0,balanceRejected:0,maxDepth:0,retainedFailures};
    const primary=c=>c===1||c===2||c===4;
    // Pack five 3-bit colors per UTF-16 code unit: exact, collision-free keys.
    const keyOf=b=>{let key='';for(let i=0;i<b.length;i+=5){let bits=0;for(let j=0;j<5&&i+j<b.length;j++)bits|=b[i+j]<<(j*3);key+=String.fromCharCode(bits);}return key;};
    const parts=b=>groups(b.flatMap((c,i)=>c?[i]:[]),adjacency).sort((a,b)=>a.length-b.length);
    const isolated=(b,cells)=>{const out=Array(b.length).fill(0);for(const i of cells)out[i]=b[i];return out;};
    const stepBoard=(b,m)=>{const next=b.slice(),c=b[m.source]|b[m.target];next[m.source]=0;next[m.target]=c===7?0:c;return next;};
    function assessment(b) {
      const key=keyOf(b),cached=assessments.get(key);
      if(cached)return cached;
      const reservations=new Map(),allBlobs=blobs(b,adjacency);
      const reason=rejectionReason(b,adjacency,allBlobs,reservations);
      const result={reason,reservations,allBlobs};
      assessments.set(key,result);
      return result;
    }
    const checkpoint=(phase,goal=null,board=root)=>({type:'search',phase,positions,plansTried,
      cacheEntries:{assessments:assessments.size,failed:dead.size,solutions:winning.size},proofStats:{...proofStats,failedEvictions:dead.evictions},
      proofProgress:proofProgress&&proofDepth?{...proofProgress,depth:proofDepth}:null,
      tiles:board.map(c=>names[c]),
      objective:goal?{kind:'clear-secondary',color:names[goal.color],cells:goal.cells}:null});
    const legal=b=>moves(b,adjacency,blobs(b,adjacency));

    // Before executable planning, solve a relaxed resource-allocation problem:
    // which cells could EVER form each secondary bridge? All mixes, all clears
    // in that layout, and existing secondary obligations share ONE matching.
    // Original blob links and future regions deliberately overestimate access;
    // failure is a proof, while success only permits further planning.
    function* bridgeFeasibility(b,budget) {
      const {allBlobs,reservations}=assessment(b);
      const profiles=secondaryRegions(b,adjacency,allBlobs,reservations);
      const owner=new Map(allBlobs.flatMap(blob=>blob.map(i=>[i,blob])));
      function match(demands) {
        const assigned=new Map();
        function add(k,seen){for(const tile of demands[k]){
          if(seen.has(tile))continue;seen.add(tile);
          if(!assigned.has(tile)||add(assigned.get(tile),seen)){assigned.set(tile,k);return true;}
        }return false;}
        demands.sort((a,c)=>a.length-c.length);
        return demands.every((_,k)=>add(k,new Set()));
      }
      for(const [color,{regions}] of profiles)for(const region of regions) {
        const variables=region.cells.filter(i=>b[i]!==color);
        if(!region.anchors.length||variables.length>16)continue;
        const mandatory=variables.filter(i=>reservations.get(i)?.secondary===color);
        const donors=new Map(variables.map(i=>[i,[...new Set(owner.get(i).flatMap(j=>adjacency[j])
          .filter(j=>b[j]===(color^b[i])).flatMap(j=>owner.get(j)))]]));
        const external=[];
        for(const {regions:others} of profiles.values())for(const other of others)if(other!==region)
          for(const tile of other.obligations)external.push(reachableSuppliers(other,tile,adjacency));
        let possible=false;
        const objective={color,cells:region.anchors};
        for(let mask=0;mask<2**variables.length;mask++) {
          if(budget.left--<=0)return null; // Unknown, never proof of failure.
          positions++;if((positions&127)===1)yield checkpoint('funding',objective,b);
          const chosen=new Set([...region.anchors,...variables.filter((_,i)=>mask&(1<<i))]);
          if(mandatory.some(i=>!chosen.has(i)))continue;
          const available=tiles=>tiles.filter(i=>!chosen.has(i)&&!reservations.has(i));
          const demands=[...chosen].filter(i=>b[i]!==color).map(i=>available(donors.get(i)));
          for(const component of groups([...chosen],adjacency)) {
            const cells=new Set(component);
            const supplies=available(region.supplierBlobs.filter(blob=>blob.some(i=>adjacency[i].some(j=>cells.has(j))))
              .flat().filter(i=>region.suppliers.includes(i)));
            for(const _ of component)demands.push(supplies);
          }
          for(const supplies of external)demands.push(available(supplies));
          if(match(demands)){possible=true;break;}
        }
        if(!possible)return {type:'bridge-resource-conflict',color:names[color],tiles:region.cells};
      }
      return null;
    }

    // Layouts describe the cells to convert and clear together. Connected growth
    // includes ALL already-secondary branches it touches. Actual local planning
    // below checks donors, transfer links, competing demands, and clearing order.
    // Enumeration limits mean unknown, never a proof that no layout exists.
    let useBridgeRoutes=bridgePlanning;
    function* goals(b,budget) {
      const {allBlobs,reservations}=assessment(b);
      const profiles=secondaryRegions(b,adjacency,allBlobs,reservations),seen=new Set();
      const seeds=[];
      for(const color of [3,5,6]) {
        const profile=profiles.get(color);
        for(const blob of allBlobs)if(b[blob[0]]===color) {
          const region=profile.byCell[blob[0]];
          if(region)seeds.push({color,cells:blob,region,anchor:true});
        }
        for(const blob of allBlobs)if(primary(b[blob[0]])&&(b[blob[0]]&color)) {
          const region=profile.byCell[blob[0]];if(!region)continue;
          seeds.push({color,cells:blob,region,anchor:false});
          if(blob.length>1)for(const cell of blob)seeds.push({color,cells:[cell],region,anchor:false});
        }
      }
      // Plan donor routes to each distinct complementary supply, not only
      // the closest one. The whole path is retained until it can be cleared.
      if(useBridgeRoutes){const routes=[];
      for(const [color,profile] of profiles)for(const region of profile.regions){
        const allowed=new Set(region.cells);
        for(const supply of region.supplierBlobs){
          const supplySet=new Set(supply),distance=new Map(),queue=[];
          for(const i of region.cells)if(adjacency[i].some(j=>supplySet.has(j))){distance.set(i,0);queue.push(i);}
          for(const i of queue)for(const j of adjacency[i])if(allowed.has(j)&&!distance.has(j)){distance.set(j,distance.get(i)+1);queue.push(j);}
          for(const start of region.cells){
            if(!distance.has(start))continue;
            const paths=[[start]];let pathsTried=0;
            while(paths.length&&pathsTried++<bridgePathStates){
            if(budget.left--<=0)return;
            positions++;if((positions&127)===1)yield checkpoint('bridge-planning',null,b);
            const cells=paths.pop(),i=cells[cells.length-1];
            if(distance.get(i)>0){for(const j of adjacency[i])if(distance.get(j)===distance.get(i)-1)paths.push([...cells,j]);continue;}
            const closure=[...cells];const chosen=new Set(closure);
            for(const x of closure)for(const j of adjacency[x])if(b[j]===color&&!chosen.has(j)){chosen.add(j);closure.push(j);}
            const list=[...chosen].sort((a,c)=>a-c),key=`${color}:${list}`;
            if(seen.has(key)||list.length>region.suppliers.length||list.length<2)continue;
            const owner=new Map(allBlobs.flatMap(blob=>blob.map(i=>[i,blob])));
            let deficit=0;
            for(const blob of allBlobs)if(primary(b[blob[0]])&&(b[blob[0]]&color)&&
              (blob.includes(start)||blob.some(i=>adjacency[i].includes(start)))){
              const donors=new Set(blob.flatMap(i=>adjacency[i]).filter(i=>b[i]===(7^color)).flatMap(i=>owner.get(i)));
              deficit=Math.max(deficit,blob.length-donors.size);
            }
            const available=list.filter(i=>b[i]!==color).map(i=>{
              const blob=allBlobs.find(g=>g.includes(i)),needed=color^b[i];
              return [...new Set(blob.flatMap(j=>adjacency[j]).filter(j=>b[j]===needed).flatMap(j=>allBlobs.find(g=>g.includes(j))))].filter(j=>!chosen.has(j)&&!reservations.has(j));
            });
            const assignments=new Map();
            const assign=(k,used)=>available[k].some(i=>{if(used.has(i))return false;used.add(i);if(!assignments.has(i)||assign(assignments.get(i),used)){assignments.set(i,k);return true;}return false;});
            if(!available.every((_,k)=>assign(k,new Set())))continue;
            seen.add(key);routes.push({color,cells:list,anchors:list.filter(i=>b[i]===color),score:deficit*100+supply.length*2+list.length*(deficit>0?1:-1)});
            }
          }
        }
      }
      routes.sort((a,c)=>c.score-a.score);
      const colors=[6,5,3],offset=planningVariant%colors.length;
      const routeQueues=[...colors.slice(offset),...colors.slice(0,offset)].map(color=>{
        const queue=routes.filter(route=>route.color===color);
        if(queue.length){const shift=Math.floor(planningVariant/3)%queue.length;queue.push(...queue.splice(0,shift));}
        return queue;
      });
      while(routeQueues.some(q=>q.length))for(const queue of routeQueues)if(queue.length){if(budget.left--<=0)return;yield queue.shift();}}
      const slack=seed=>seed.region.supplierBlobs.filter(blob=>blob.some(i=>adjacency[i].some(j=>seed.cells.includes(j))))
        .reduce((n,blob)=>n+blob.length,0)-seed.cells.length;
      // A group without a current clearing connection needs its bridge before
      // well-supplied neighbors consume the cells that could form that bridge.
      seeds.sort((a,c)=>Number(c.anchor)-Number(a.anchor) ||
        (!moveTreeSearch ? Number(c.cells.length>1)-Number(a.cells.length>1) || c.cells.length-a.cells.length : 0) || slack(a)-slack(c) ||
        (a.region.suppliers.length-a.cells.length)-(c.region.suppliers.length-c.cells.length));
      if(planningVariant&&seeds.length){
        const offset=(planningVariant*7)%seeds.length;
        seeds.push(...seeds.splice(0,offset));
      }
      for(const seed of seeds) {
        const allowed=new Set(seed.region.cells),queue=[seed.cells],visited=new Set();
        let layouts=0;
        while(queue.length&&layouts<layoutLimit&&budget.left>0) {
          budget.left--;positions++;if((positions&15)===1)yield checkpoint('planning',seed,b);
          const cells=new Set(queue.shift());
          const spread=[...cells];for(const i of spread)for(const j of adjacency[i])
            if(b[j]===seed.color&&!cells.has(j)){cells.add(j);spread.push(j);}
          const list=[...cells].sort((a,c)=>a-c),key=`${seed.color}:${list}`;
          if(visited.has(key))continue;visited.add(key);layouts++;
          const donors=list.filter(i=>b[i]!==seed.color);
          const supplies=seed.region.supplierBlobs.filter(blob=>blob.some(i=>adjacency[i].some(j=>cells.has(j))))
            .flat().filter(i=>seed.region.suppliers.includes(i));
          if(supplies.length>=list.length&&!seen.has(key)) {
            seen.add(key);
            // Reserve receivers: none may simultaneously be used as a donor.
            const available=donors.map(i=>{
              const blob=allBlobs.find(g=>g.includes(i)),needed=seed.color^b[i];
              return [...new Set(blob.flatMap(j=>adjacency[j]))]
                .filter(j=>b[j]===needed).flatMap(j=>allBlobs.find(g=>g.includes(j)))
                .filter(j=>!cells.has(j)&&!reservations.has(j));
            });
            const used=new Map();
            function assign(k,seenDonors){for(const i of available[k]){
              if(seenDonors.has(i))continue;seenDonors.add(i);
              if(!used.has(i)||assign(used.get(i),seenDonors)){used.set(i,k);return true;}
            }return false;}
            if(available.every((_,k)=>assign(k,new Set())))
              yield {color:seed.color,cells:list,anchors:list.filter(i=>b[i]===seed.color)};
          }
          // Layout size is limited by available tiles and donors, never by
          // a fixed number of bridge cells. The caller bounds planning work.
          const boundary=[...new Set(list.flatMap(i=>adjacency[i]))]
            .filter(i=>allowed.has(i)&&!cells.has(i));
          for(const i of boundary)queue.push([...list,i]);
        }
      }
    }

    // A goal is a bridge to build and eventually clear, not a fixed color
    // phase. Interacting planning may clear built cells early and insert
    // other-color jobs while the remaining bridge still provides access.
    function* localPlans(b,goal,budget,backdrop=b) {
      const active=b.flatMap((c,i)=>c?[i]:[]);
      const snapshot=current=>{const full=backdrop.slice();for(const i of active)full[i]=current[i];return full;};
      const members=new Set(goal.cells),seen=new Set(),outputs=new Set();
      let left=localStates,count=0;
      function* visit(current,path,resources) {
        if(left--<=0||budget.left--<=0||count>=planVariants)return;
        positions++;if((positions&15)===1)yield checkpoint('planning',goal,snapshot(current));
        const key=keyOf(current);if(seen.has(key))return;seen.add(key);
        if(assessment(current).reason)return;
        if(goal.cells.every(i=>!current[i])) {
          if(!outputs.has(key)){outputs.add(key);count++;
            yield {next:current,moves:path,goal,resources};}
          return;
        }
        const building=goal.cells.some(i=>current[i]&&current[i]!==goal.color);
        const currentBlobs=blobs(current,adjacency),currentOwner=new Map(currentBlobs.flatMap(g=>g.map(i=>[i,g])));
        const pending=goal.cells.filter(i=>current[i]&&current[i]!==goal.color);
        const mixDonors=new Map(pending.map(i=>[i,[...new Set(currentOwner.get(i).flatMap(j=>adjacency[j]).filter(j=>current[j]===(goal.color^current[i])).flatMap(j=>currentOwner.get(j)))].filter(j=>!members.has(j))]));
        if(bridgePlanning&&building){const assigned=new Map();const assign=(i,seen)=>mixDonors.get(i).some(j=>{if(seen.has(j))return false;seen.add(j);if(!assigned.has(j)||assign(assigned.get(j),seen)){assigned.set(j,i);return true;}return false;});if(!pending.every(i=>assign(i,new Set())))return;}
        let candidates=legal(current).filter(m=>{
          const combined=current[m.source]|current[m.target];
          if(building){
            if(combined===goal.color&&members.has(m.target)&&!members.has(m.source))return true;
            if(!bridgePlanning)return false;
          }
          return combined===7&&((members.has(m.source)&&current[m.source]===goal.color)||
            (members.has(m.target)&&current[m.target]===goal.color));
        });
        // Scarce donors and bridge articulation cells are worth keeping.
        // Score once per candidate; sorting must not rebuild all blobs.
        if(building){
          const degree=m=>adjacency[m.target].filter(i=>members.has(i)&&current[i]===current[m.target]).length;
          const costs=new Map();
          if(bridgePlanning)for(const m of candidates){
            if((current[m.source]|current[m.target])===7)continue;
            const remaining=pending.filter(i=>i!==m.target);
            const shared=remaining.filter(i=>adjacency[m.source].includes(i)).length;
            const boundary=adjacency[m.source].filter(i=>current[i]&&current[i]!==current[m.source]&&!members.has(i)).length;
            const donorBlob=currentOwner.get(m.source);
            const critical=[1,2,4].filter(bit=>bit!==current[m.source]).some(bit=>
              new Set(donorBlob.flatMap(i=>adjacency[i]).filter(i=>current[i]===bit).flatMap(i=>currentOwner.get(i))).size<donorBlob.length);
            const remote=adjacency[m.source].includes(m.target)?0:1;
            costs.set(m,shared*1000+donorBlob.length*30+(critical?boundary*10+remote:remote*100+boundary));
          }
          candidates.sort((a,c)=>{
            if(!bridgePlanning)return degree(a)-degree(c);
            const mixing=m=>(current[m.source]|current[m.target])!==7;
            if(!mixing(a)||!mixing(c))return Number(mixing(c))-Number(mixing(a));
            return mixDonors.get(a.target).length-mixDonors.get(c.target).length||degree(a)-degree(c)||costs.get(a)-costs.get(c);
          });
        }else{
          const degree=m=>adjacency[current[m.source]===goal.color?m.source:m.target]
            .filter(i=>members.has(i)&&current[i]).length;
          const costs=new Map();
          if(bridgePlanning)for(const m of candidates){
            const after=m.next,bs=blobs(after,adjacency),owner=new Map(bs.flatMap(g=>g.map(i=>[i,g])));
            const supplies=new Set();
            const bridges=bs.filter(g=>after[g[0]]===goal.color&&g.some(i=>members.has(i)));
            for(const group of bridges)for(const i of group)for(const j of adjacency[i])
              if(after[j]===(7^goal.color))for(const k of owner.get(j))supplies.add(k);
            const donor=current[m.source]===goal.color?m.target:m.source,donorBlob=currentOwner.get(donor);
            const donorDegree=adjacency[donor].filter(j=>current[j]===current[donor]).length;
            costs.set(m,bridges.length*10000-supplies.size*100+1000/donorBlob.length+donorDegree);
          }
          candidates.sort((a,c)=>(bridgePlanning?costs.get(a)-costs.get(c):0)||degree(a)-degree(c));
        }
        for(const move of candidates) {
          const mixing=(current[move.source]|current[move.target])!==7;
          const donor=mixing?move.source:current[move.source]===(7^goal.color)?move.source:move.target;
          const receiver=mixing?move.target:members.has(move.source)?move.source:move.target;
          const resource={tile:donor,receiver,role:mixing?'mix':'clear',step:path.length+1};
          yield* visit(move.next,[...path,{source:move.source,target:move.target}],[...resources,resource]);
          if(left<=0||budget.left<=0||count>=planVariants)return;
        }
        // Clear outside material while keeping this bridge alive. A helper
        // may use any other color and must finish a legal one- or two-move
        // clearance; every intermediate board is checked independently.
        if(bridgePlanning){
          const helperSuppliers=new Set();
          for(const group of currentBlobs)if(current[group[0]]===goal.color&&group.some(i=>members.has(i)))
            for(const i of group)for(const j of adjacency[i])if(current[j]===(7^goal.color))for(const k of currentOwner.get(j))helperSuppliers.add(k);
          for(const move of legal(current)){
            // Rejected helper combinations also cost work. Yield before the
            // expensive second-move generation so other lanes and the caller's
            // deadline can run even when no helper reaches visit().
            if(left<=0||budget.left<=0)return;
            positions++;if((positions&15)===1)yield checkpoint('planning',goal,snapshot(current));
            if(!helperSuppliers.has(move.source)&&!helperSuppliers.has(move.target))continue;
            if(members.has(move.source)||members.has(move.target))continue;
            const mixed=current[move.source]|current[move.target];
            const helpers=mixed===7?[[move]]:legal(move.next).filter(m=>
              !members.has(m.source)&&!members.has(m.target)&&
              (m.source===move.target||m.target===move.target)&&
              (move.next[m.source]|move.next[m.target])===7).map(m=>[move,m]);
            for(const helper of helpers){
              if(left<=0||budget.left<=0)return;
              positions++;if((positions&15)===1)yield checkpoint('planning',goal,snapshot(current));
              if(helper.some(m=>assessment(m.next).reason))continue;
              const moves=helper.map(m=>({source:m.source,target:m.target}));
              const helperResources=helper.map((m,k)=>({tile:m.source,receiver:m.target,role:'helper',step:path.length+k+1}));
              yield* visit(helper[helper.length-1].next,[...path,...moves],[...resources,...helperResources]);
              if(left<=0||budget.left<=0||count>=planVariants)return;
            }
          }
        }
      }
      yield* visit(b,[],[]);
    }

    // Compare complete small clearances across a bounded frontier before the
    // expensive layout planner. Every edge removes a whole color-balanced job;
    // intermediate bridge contacts and the resulting remainder are checked.
    function* sectionPlans(b, budget, width=8, seed=0) {
      width=Math.min(width,32);
      // Pair the same ranking with clearance-only and early-bridge choices.
      const rankingSeed=moveTreeSearch?seed:Math.floor(seed/2)+planningVariant*17;
      const rank=current=>{
        const bs=blobs(current,adjacency),components=parts(current);
        let score=0;
        for(const blob of bs){
          const boundary=new Set(blob.flatMap(i=>adjacency[i]).filter(i=>current[i]&&current[i]!==current[blob[0]]));
          score+=blob.length*blob.length+boundary.size*3;
        }
        // Favor connected residual sections, retaining their donor contacts.
        for(const i of current.keys())if(current[i]){
          const degree=adjacency[i].filter(j=>current[j]).length;
          score+=degree*2-(degree<=1?12:0);
        }
        // Stable, seeded variation avoids repeating the same greedy branch.
        // It affects ranking only; legality and complete proofs remain required.
        let variation=0;
        if(rankingSeed){
          let hash=(2166136261^rankingSeed)>>>0;
          for(const color of current)hash=Math.imul(hash^color,16777619)>>>0;
          hash=Math.imul(hash^(hash>>>16),2246822507)>>>0;
          hash=Math.imul(hash^(hash>>>13),3266489909)>>>0;
          hash=(hash^(hash>>>16))>>>0;
          variation=(hash/4294967296-0.5)*100;
        }
        return score-components.length*20+variation;
      };
      let frontier=[{board:b,plans:[],score:rank(b)}];
      const visited=boundedSet(16384);visited.add(keyOf(b));
      while(frontier.length&&budget.left>0){
        yield {...checkpoint('planning',null,frontier[0].board),sectionWidth:width,sectionSeed:seed,
          message:`Comparing section clearances${seed?` with ranking ${seed}`:''}: ${frontier.length} candidate continuations.`};
        const candidates=boundedMap(8192);
        for(const node of frontier){
          const current=node.board,bs=blobs(current,adjacency);
          // Immediate clearances can miss a bridge that must be built before
          // clearing. Verify a bounded endgame before discarding this section.
          // Unknown leaves section planning active; failure rejects this node.
          const remaining=current.filter(Boolean).length;
          if(moveTreeSearch&&sectionEndgameStates&&remaining<=sectionEndgameTiles){
            // Screen larger remainders cheaply before immediate clearances
            // discard a bridge-building continuation. Keep the deeper budget
            // for small endgames; an exhausted screen remains unknown.
            const endgameBudget=remaining>18?Math.min(sectionEndgameStates,2048):sectionEndgameStates;
            const proof=exact(current,{left:endgameBudget});
            let step;
            try {
              while(!(step=proof.next()).done)yield {...step.value,phase:'section-endgame'};
            } finally { proof.return(); }
            if(step.value===null)continue;
            if(step.value!==undefined)return [...node.plans,
              {moves:step.value,goal:null,resources:[],sectionEndgame:true}];
          }
          if(!moveTreeSearch&&remaining<=24) {
            // Finish a promising remainder with bridge/group jobs, never
            // reverting to an individual-move tree or committing a partial job.
            const groupBudget={left:Math.min(12000,budget.left)},initial=groupBudget.left;
            const completion=yield* strategic(current,groupBudget,boundedSet(16384),[],true);
            budget.left-=initial-groupBudget.left;
            if(completion!==null)return [...node.plans,...completion];
            if(budget.left<=0)return null;
          }
          const owner=new Map(bs.flatMap(blob=>blob.map(i=>[i,blob])));
          const linked=(a,c)=>a.some(i=>adjacency[i].some(j=>c.includes(j)));
          const offer=(next,path,color,receiver,resources)=>{
            const key=keyOf(next);if(visited.has(key)||candidates.has(key))return;
            const score=rank(next);
            candidates.set(key,{board:next,score,plans:[...node.plans,
              {next,moves:path,goal:{color,cells:Array.isArray(receiver)?receiver:[receiver],anchors:(Array.isArray(receiver)?receiver:[receiver]).filter(i=>current[i]===color)},resources}]});
          };
          if(!moveTreeSearch&&(remaining<=24||seed%2===1)) {
            // Alternate immediate-clearance and whole-group passes at every
            // section size, retaining both strategies. Waiting
            // for an endgame can discard their required donor connections.
            // Build an entire primary blob into a connected compound group
            // before clearing. Verify donor order and complementary contacts.
            const profiles=secondaryRegions(current,adjacency,bs);
            for(const group of bs.filter(g=>primary(current[g[0]])&&g.length>1).sort((a,c)=>c.length-a.length)) {
              for(const color of [3,5,6].filter(c=>c&current[group[0]])) {
                const region=profiles.get(color).byCell[group[0]];
                if(!region||region.suppliers.length<group.length)continue;
                const jobBudget={left:Math.min(32,budget.left)},initial=jobBudget.left;
                for(const plan of localPlans(current,{color,cells:group,anchors:[]},jobBudget)) {
                  if(plan.type==='search'){yield plan;continue;}
                  offer(plan.next,plan.moves,color,group,plan.resources);
                  break;
                }
                budget.left-=initial-jobBudget.left;
                if(budget.left<=0)return null;
              }
            }
          }
          for(const group of bs){
            const color=current[group[0]];
            if(!primary(color)){
              for(const supply of bs)if(current[supply[0]]===(7^color)&&linked(group,supply))
                for(const receiver of group)for(const donor of supply){
                  if(budget.left--<=0)return null;
                  positions++;if((positions&15)===1)yield checkpoint('planning',{color,cells:group},current);
                  const next=current.slice();next[receiver]=next[donor]=0;
                  offer(next,[color<(7^color)?{source:receiver,target:donor}:{source:donor,target:receiver}],color,receiver,[{tile:donor,receiver,role:'clear',step:1}]);
                }
              continue;
            }
            for(const other of bs)if(primary(current[other[0]])&&current[other[0]]!==color&&linked(group,other)){
              const secondary=color|current[other[0]],complement=7^secondary;
              for(const receiver of group)for(const donor of other){
                if(budget.left--<=0)return null;
                positions++;if((positions&15)===1)yield checkpoint('planning',{color,cells:group},current);
                const mixed=current.slice();mixed[donor]=0;mixed[receiver]=secondary;
                // The new secondary can join an existing bridge. Build the
                // actual connected blob, rather than assuming static access.
                const bridge=[receiver],seen=new Set(bridge);
                for(const i of bridge)for(const j of adjacency[i])if(mixed[j]===secondary&&!seen.has(j)){seen.add(j);bridge.push(j);}
                const supplies=new Set(bridge.flatMap(i=>adjacency[i]).filter(i=>mixed[i]===complement).flatMap(i=>owner.get(i)));
                for(const clearer of supplies){
                  const next=mixed.slice();next[receiver]=next[clearer]=0;
                  offer(next,[{source:donor,target:receiver},secondary<complement?{source:receiver,target:clearer}:{source:clearer,target:receiver}],secondary,receiver,
                    [{tile:donor,receiver,role:'mix',step:1},{tile:clearer,receiver,role:'clear',step:2}]);
                }
              }
            }
          }
        }
        const ordered=[...candidates.values()].sort((a,c)=>a.board.filter(Boolean).length-c.board.filter(Boolean).length||c.score-a.score);
        frontier=[];
        for(const node of ordered){
          if(budget.left--<=0)return null;
          positions++;if((positions&15)===1)yield checkpoint('planning',null,node.board);
          visited.add(keyOf(node.board));
          if(assessment(node.board).reason)continue;
          if(node.board.every(c=>!c))return node.plans;
          frontier.push(node);if(frontier.length>=width)break;
        }
      }
      return null;
    }

    function* bridgeBeam(start) {
      let frontier=[{board:start,plans:[],score:0}];
      const visited=boundedSet(10000);
      for(let depth=0;frontier.length&&depth<start.filter(Boolean).length;depth++){
        const next=boundedMap(8192);
        for(const node of frontier){
          let goalsTried=0;
          for(const goal of goals(node.board,{left:100000})){
            if(goal.type==='search'){yield goal;continue;}
            if(goalsTried++>=bridgeGoalBudget)break;
            const budget={left:bridgeJobStates};let produced=0;
            for(const plan of localPlans(node.board,goal,budget)){
              if(plan.type==='search'){yield plan;continue;}
              const key=keyOf(plan.next);if(visited.has(key)||next.has(key))continue;
              const plans=[...node.plans,plan];
              if(plan.next.every(c=>!c))return plans;
              if(plan.next.filter(Boolean).length<=36){
                useBridgeRoutes=false;
                try{const tail=yield* sectionPlans(plan.next,{left:bridgeTailStates},1);if(tail!==null)return [...plans,...tail];}
                finally{useBridgeRoutes=bridgePlanning;}
              }
              const components=parts(plan.next),bs=blobs(plan.next,adjacency);
              let work=node.board,mixCost=0;
              for(const move of plan.moves){const mixed=work[move.source]|work[move.target];if(mixed!==7){const donor=blobs(work,adjacency).find(g=>g.includes(move.source));mixCost+=donor.length+(adjacency[move.source].includes(move.target)?0:2);}work=stepBoard(work,move);}
              const constructionCost=(node.constructionCost||0)+mixCost;
              const helperMoves=plans.reduce((n,p)=>n+Math.max(0,p.moves.length-2*p.goal.cells.length),0);
              const score=-plan.next.filter(Boolean).length*1000-helperMoves*1500-constructionCost*20-components.length*10+
                bs.reduce((n,g)=>n+g.length*g.length,0);
              next.set(key,{board:plan.next,plans,score,constructionCost});
              if(++produced>=bridgeVariants)break;
            }
          }
        }
        frontier=[...next.values()].sort((a,c)=>c.score-a.score).slice(0,bridgeWidth);
        for(const node of frontier)visited.add(keyOf(node.board));
        yield {...checkpoint('bridge-planning',null,frontier[0]?.board||start),bridgeDepth:depth+1,bridgeCandidates:next.size,
          message:`Planning interacting bridges: ${depth+1} clearances, ${next.size} candidate continuations.`};
      }
      return null;
    }
    function* strategic(b,budget,tried,prefix=[],completeOnly=false) {
      if(b.every(c=>!c))return [];
      if(budget.left<=0)return null;
      const key=keyOf(b),triedKey=strategyOnly&&batchGroups?`${key}:${Math.min(prefix.length,batchGroups)}`:key;
      if(tried.has(triedKey)||assessment(b).reason)return null;
      if(!completeOnly&&strategyOnly&&batchGroups&&prefix.length>=batchGroups){
        yield {...checkpoint('batch-check',null,b),groupsCleared:prefix.length,remaining:b.filter(Boolean).length};
        // Necessary conditions only: a passed batch is promising, not a
        // guaranteed full solution. No exact move search is used here.
        const conflict=yield* bridgeFeasibility(b,{left:bridgeStates});
        if(conflict)return null;
        if((yield* smallPositionProof(b))===false)return null;
        return [];
      }
      if(prefix.length&&!frontiers.some(f=>f.key===key)){
        frontiers.push({key,board:b,prefix,size:b.filter(Boolean).length});
        frontiers.sort((a,c)=>a.size-c.size);frontiers=frontiers.slice(0,bridgeWidth);
      }
      // Finish independent components separately; their resources cannot mix.
      const components=parts(b),active=isolated(b,components[0]);
      for(const goal of goals(active,budget)) {
        if(goal.type==='search'){yield {...goal,tiles:b.map(c=>names[c])};continue;}
        plansTried++;
        for(const plan of localPlans(active,goal,budget,b)) {
          if(plan.type==='search'){yield plan;continue;}
          const next=b.slice();for(const i of components[0])next[i]=plan.next[i];
          const rest=yield* strategic(next,budget,tried,[...prefix,plan],completeOnly);
          if(rest!==null)return [plan,...rest];
          if(budget.left<=0)return null;
        }
        if(budget.left<=0)return null;
      }
      // This records failure of THIS bounded plan vocabulary on THIS exact
      // board, not unsolvability. It is never consulted by the exact solver.
      tried.add(triedKey);return null;
    }

    // Complete cooperative fallback. Only exhaustive failure or an established
    // structural obstruction enters dead. Unknown planning results never do.
    // Failed branches have no forward/backtrack events and cannot reach the UI.
    function* exact(b,budget=null,sleep=[]) {
      if(proofDepth===0){
        proofProgress=budget?null:{completed:0,total:0,kind:'moves'};
        if(!budget)proofCache.root=JSON.stringify(b);
      }
      proofDepth++;proofStats.maxDepth=Math.max(proofStats.maxDepth,proofDepth);
      try {
        proofStats.calls++;
        if(!moveTreeSearch)throw new Error('Move-tree search is disabled');
        if(b.every(c=>!c))return [];
        const key=keyOf(b);if(dead.has(key)){proofStats.cacheHits++;return null;}
        if(winning.has(key))return winning.get(key);
        if(budget&&budget.left--<=0)return undefined; // Unknown, never a dead state.
        // Yield even if every successor fails its structural check. A large
        // run of rejected candidates must not starve Stop or the deadline.
        positions++;if((positions&15)===1)yield checkpoint('verification',null,b);
        if(assessment(b).reason){dead.add(key);return null;}
        const components=parts(b);
        if(components.length>1) {
          const path=[];
          if(proofDepth===1&&proofProgress){proofProgress.total=components.length;proofProgress.kind='components';}
          let componentIndex=0;
          for(const component of components){
            if(proofDepth===1&&proofProgress)proofProgress.completed=componentIndex++;
            const found=yield* exact(isolated(b,component),budget);
            if(found===undefined)return undefined;
            if(found===null){dead.add(key);return null;}path.push(...found);
          }
          winning.set(key,path);return path;
        }
        const {reservations,allBlobs}=assessment(b);
        const owner=new Map(allBlobs.flatMap(blob=>blob.map(i=>[i,blob])));
        // A move depends on both complete blobs and their boundary cells. Disjoint
        // dependencies guarantee that either order stays legal and reaches the
        // same board, including nonlocal transfers within linked blobs.
        const describe=move=>{const cells=new Set([...owner.get(move.source),...owner.get(move.target)]);
          const boundary=new Set([...cells].flatMap(i=>adjacency[i]));
          return {...move,id:`${move.source}:${move.target}`,cells,boundary};};
        const independent=(a,c)=>![...a.cells].some(i=>c.cells.has(i)||c.boundary.has(i))&&
          ![...c.cells].some(i=>a.boundary.has(i));
        const earlier=[];
        const candidates=legal(b);
        if(proofDepth===1&&proofProgress)proofProgress.total=candidates.length;
        let branchIndex=0;
        for(const candidate of candidates) {
          if(proofDepth===1&&proofProgress)proofProgress.completed=branchIndex++;
          const move=describe(candidate);
          if(commuteMoves&&sleep.some(old=>old.id===move.id)){proofStats.commuted++;continue;}
          if(primary(b[move.source])&&reservations.has(move.source))continue;
          const required=reservations.get(move.target);
          if(required&&primary(b[move.target])&&move.next[move.target]!==required.secondary)continue;
          if(!balancedComponents(move.next,adjacency)){proofStats.balanceRejected++;continue;}
          const nextSleep=commuteMoves?[...sleep,...earlier].filter(old=>independent(old,move)):[];
          const rest=yield* exact(move.next,budget,nextSleep);
          if(rest===undefined)return undefined;
          if(rest!==null){const path=[{source:move.source,target:move.target},...rest];winning.set(key,path);return path;}
          earlier.push(move);
        }
        // Sleep-set failure is relative to earlier explored orders, not a proof
        // about this board in isolation. Never publish it to the global cache.
        if(proofDepth===1&&proofProgress)proofProgress.completed=proofProgress.total;
        if(!sleep.length)dead.add(key);

        return null;
      } finally {proofDepth--;}
    }

    // Bounded small-position validation, never an unrestricted fallback.
    // A failed proof rejects a proposed batch; unknown never means impossible.
    // A successful path is evidence only: playback still uses strategic jobs.
    function* smallPositionProof(b) {
      if(!moveTreeSearch||!proofStates||b.filter(Boolean).length>proofTiles)return undefined;
      const proof=exact(b,{left:proofStates});
      try {
        let step;
        while(!(step=proof.next()).done)yield {...step.value,phase:'endgame-check'};
        const result=step.value===null?'unsolvable':step.value===undefined?'unknown':'solvable';
        yield {...checkpoint('endgame-check',null,b),proofResult:result,
          message:result==='unsolvable'?'Small-board proof found an impossible position. Rejecting this plan.':
            result==='unknown'?'Small-board proof reached its limit. Continuing strategic planning.':
            'Small-board validation found a complete continuation.'};
        return result==='unsolvable'?false:result==='unknown'?undefined:true;
      } finally { proof.return(); }
    }

    // Play unresolved continuations with reversible events. A structural pass
    // only permits an attempt; exhaustive failure alone populates dead.
    function* explore(b) {
      if(b.every(c=>!c))return true;
      const key=keyOf(b);
      if(dead.has(key))return false;
      positions++;if((positions&15)===1)yield checkpoint('exploration');
      if(assessment(b).reason){dead.add(key);return false;}
      const {reservations}=assessment(b),successors=new Set();
      for(const move of legal(b)) {
        if(primary(b[move.source])&&reservations.has(move.source))continue;
        const required=reservations.get(move.target);
        if(required&&primary(b[move.target])&&move.next[move.target]!==required.secondary)continue;
        const nextKey=keyOf(move.next);
        if(successors.has(nextKey)||dead.has(nextKey))continue;
        successors.add(nextKey);
        // Reject established obstructions silently before touching the display.
        positions++;if((positions&15)===1)yield checkpoint('exploration');
        if(assessment(move.next).reason){dead.add(nextKey);continue;}
        // Screen short dead branches silently. Budget exhaustion permits an
        // attempt; it never proves failure or adds an unknown state to dead.
        const probe=yield* exact(move.next,{left:512});
        if(probe===null)continue;
        const event={sourceIndex:move.source,targetIndex:move.target,
          before:b.map(c=>names[c]),after:move.next.map(c=>names[c])};
        yield {type:'forward',...event};
        if(yield* explore(move.next))return true;
        yield {type:'backtrack',...event,reason:'proved-unsolvable'};
      }
      dead.add(key);return false;
    }

    let root=tiles.map(c=>masks[c]);
    const ancestors=history.map(snapshot=>(snapshot.tiles||snapshot).map(c=>masks[c]));
    for(;;) {
      let plans=null;
      const structural=assessment(root).reason;
      const fundingBudget={left:bridgeStates};
      const funding=structural?null:yield* bridgeFeasibility(root,fundingBudget);
      const smallFailure=!structural&&!funding&&strategyOnly
        ? (yield* smallPositionProof(root))===false : false;
      if(structural||funding||smallFailure)dead.add(keyOf(root));
      if(bridgePlanning&&!structural&&!funding&&!smallFailure){
        plans=yield* bridgeBeam(root);
        if(plans===null)return 'unknown'; // A bounded planner cannot prove failure.
      }
      if(!bridgePlanning&&!structural&&!funding&&!smallFailure) {
        frontiers=[];
        const planningBudget={left:progressive&&!strategyOnly?Math.min(strategyStates,2048):strategyStates};
        // Retry section planning before the slower layout search. Increasing
        // both the frontier and its budget preserves alternatives that a
        // narrow, heuristic ranking may discard. Only full solutions play.
        const canPlanSections=strategyStates&&sectionStates&&sectionWidth&&
          root.filter(Boolean).length>20&&parts(root).length===1;
        let nextSectionWidth=sectionWidth;
        let nextSectionStates=Math.min(sectionStates,strategyStates);
        if(canPlanSections){
          // Bound the initial Auto Play pass so bridge alternatives get a turn.
          plans=yield* sectionPlans(root,{left:moveTreeSearch?nextSectionStates:Math.min(nextSectionStates,20000)},1);
          // Cheap narrow restarts explore different preferences before paying
          // for a wider frontier of similarly ranked residual boards.
          for(let seed=1;plans===null&&strategyOnly&&seed<=sectionRestarts;seed++)
            plans=yield* sectionPlans(root,{left:nextSectionStates},1,seed);
          if(plans===null&&sectionWidth>1)
            plans=yield* sectionPlans(root,{left:nextSectionStates},nextSectionWidth);
          // Keep the first retries bounded; later strategic passes continue
          // widening sections before retrying group layouts.
          for(let retry=0;plans===null&&strategyOnly&&retry<2;retry++){
            nextSectionWidth=Math.min(Number.MAX_SAFE_INTEGER,nextSectionWidth*2);
            nextSectionStates=Math.min(Number.MAX_SAFE_INTEGER,nextSectionStates*2);
            plans=yield* sectionPlans(root,{left:nextSectionStates},nextSectionWidth);
          }
        }
        if(plans===null)plans=yield* strategic(root,planningBudget,boundedSet(16384));
        // Strategy-only runs spend their effort on whole clearing jobs.
        // Widen bounded planning rather than entering move-sequence fallback.
        // Failure of this vocabulary is unresolved, never an impossibility proof.
        let strategyPass=1;
        let nextStrategyStates=strategyStates;
        while(plans===null&&strategyOnly){
          strategyPass++;
          nextStrategyStates=Math.min(Number.MAX_SAFE_INTEGER,Math.max(1,nextStrategyStates)*2);
          localStates=Math.min(Number.MAX_SAFE_INTEGER,Math.max(1,localStates)*2);
          planVariants=Math.min(Number.MAX_SAFE_INTEGER,Math.max(1,planVariants)*2);
          layoutLimit=Math.min(Number.MAX_SAFE_INTEGER,Math.max(1,layoutLimit)*2);
          frontiers=[];
          yield {...checkpoint('planning'),strategyPass,
            message:`Strategic planning pass ${strategyPass}: widening section continuations, group layouts, and donor assignments.`};
          if(canPlanSections){
            nextSectionWidth=Math.min(Number.MAX_SAFE_INTEGER,nextSectionWidth*2);
            nextSectionStates=Math.min(Number.MAX_SAFE_INTEGER,nextSectionStates*2);
            plans=yield* sectionPlans(root,{left:nextSectionStates},nextSectionWidth);
            for(let seed=1;plans===null&&seed<=sectionRestarts;seed++)
              plans=yield* sectionPlans(root,{left:nextSectionStates},1,seed+strategyPass*sectionRestarts);
          }
          if(plans===null)plans=yield* strategic(root,{left:nextStrategyStates},boundedSet(16384));
        }
        if(plans===null&&stopBeforeExhaustive){
          const remaining=root.filter(Boolean).length;
          const best=frontiers[0];
          const reason=planningBudget.left<=0
            ? 'The strategic planning budget was exhausted'
            : 'The available group-clearing plans did not produce a complete solution';
          const fundingStatus=fundingBudget.left<0
            ? 'Bridge supply checking reached its budget without a conclusion.'
            : 'Bridge supply checks found no contradiction.';
          const progress=best
            ? ` The best partial plan leaves ${best.size} of ${remaining} colored tiles; its continuation is unproved.`
            : ' No complete continuation was found for a partial plan.';
          yield {type:'exhaustive-required',positions,plansTried,remaining,
            planningBudgetExhausted:planningBudget.left<=0,
            bestRemaining:best?.size??remaining,
            message:`Auto Play stopped before exhaustive search. Structural checks found no impossibility proof. ${fundingStatus} ${reason} after ${plansTried} group plans and ${positions} examined positions.${progress} The next step would enumerate individual move sequences. This position remains unresolved; it has not been proved solvable or unsolvable.`};
          return 'paused';
        }
        // Cheap exact screening avoids animating easily disproved positions.
        if(plans===null&&progressive){
          const screened=yield* exact(root,{left:2048});
          if(screened===null)dead.add(keyOf(root));
          else if(screened!==undefined)plans=[{moves:screened,goal:null,resources:[]}];
        }
        if(plans===null&&progressive&&!dead.has(keyOf(root))){
          if(yield* explore(root))return 'solved';
        }else if(plans===null&&!progressive){
          yield checkpoint('verification');
          // First verify continuations of the most advanced strategic plans.
          // Bound each partial assignment so a difficult remainder cannot monopolize
          // the proof. Unknown advances to the next candidate; only the original
          // board is searched without a limit to establish impossibility.
          for(const frontier of [...frontiers,{board:root,prefix:[]}]){
            const path=yield* exact(frontier.board,frontier.prefix.length?{left:frontierStates}:undefined);
            if(path!==null&&path!==undefined){plans=[...frontier.prefix,{moves:path,goal:null,resources:[]}];break;}
          }
        }
      }
      if(plans!==null) {
        // Validate the entire composition once more using actual blob links.
        // Playback commits to this sequence; it never re-scores between steps.
        let check=root.slice();
        for(const plan of plans)for(const move of plan.moves){
          if(!legal(check).some(m=>m.source===move.source&&m.target===move.target))throw new Error('Invalid planned transfer');
          check=stepBoard(check,move);
        }
        const complete=check.every(c=>!c);
        if(!complete&&!(strategyOnly&&batchGroups))throw new Error('Incomplete planned continuation');
        const playback=[];
        for(let id=0;id<plans.length;id++) {
          const plan=plans[id],goal=plan.goal;
          const description=goal?`Clear ${names[goal.color]} bridge${plan.resources.some(r=>r.role==='helper')?' with supporting clearances':''}`:'Complete verified continuation';
          for(let k=0;k<plan.moves.length;k++){
            const move=plan.moves[k],next=stepBoard(root,move);
            playback.push({type:'forward',sourceIndex:move.source,targetIndex:move.target,
              before:root.map(c=>names[c]),after:next.map(c=>names[c]),
              plan:{id:id+1,kind:goal?'clear-secondary':'verified-continuation',description,
                color:goal?names[goal.color]:null,cells:goal?.cells||[],anchors:goal?.anchors||[],
                resources:plan.resources,step:k+1,total:plan.moves.length,verified:true,
                continuationVerified:complete,batchGroups:plans.length}});
            root=next;
          }
        }
        continuation=complete?{graph:graphKey,events:playback,strategic:plans.every(plan=>plan.goal!==null||plan.sectionEndgame===true)}:null;
        if(strategyOnly&&batchGroups)yield {type:'batch-ready',groupsCleared:plans.length,
          remaining:root.filter(Boolean).length,complete,moveCount:playback.length,
          after:root.map(c=>names[c]),
          history:[...ancestors.map(b=>({tiles:b.map(c=>names[c])})),...playback.map(e=>({tiles:e.before}))],
          message:complete?'Strategic plan clears the remaining board.':`Planned ${plans.length} group clearances. The remaining ${root.filter(Boolean).length} tiles have no detected obstruction; solvability is not yet proved.`};
        for(const event of playback)yield event;
        if(complete)return 'solved';
        ancestors.push(...playback.map(e=>e.before.map(c=>masks[c])));
        yield {...checkpoint('planning'),message:'Batch played. Planning the next group clearances.'};
        continue;
      }
      if(!ancestors.length)return 'unsolvable';
      const before=ancestors.pop();
      const move=legal(before).find(m=>m.next.every((c,i)=>c===root[i]));
      if(!move)return 'unsolvable';
      // Only user/existing history may be undone, after proof of failure.
      yield {type:'backtrack',sourceIndex:move.source,targetIndex:move.target,
        before:before.map(c=>names[c]),after:root.map(c=>names[c]),reason:'proved-unsolvable'};
      root=before;
    }
  }
  // Match the offline C++ solver's unsigned 64-bit ranking hash exactly.
  // Integer pairs keep this reproducible without BigInt in the search loop.
  function beamHighProduct(a,b) {
    const low=(a&65535)*(b&65535);
    const middle=(a>>>16)*(b&65535)+(a&65535)*(b>>>16)+(low>>>16);
    return ((a>>>16)*(b>>>16)+Math.floor(middle/65536))>>>0;
  }
  function beamMultiply(lo,hi,a,b) {
    return [Math.imul(lo,a)>>>0,(Math.imul(hi,a)+Math.imul(lo,b)+beamHighProduct(lo,a))>>>0];
  }
  function beamNoise(board,seed) {
    let hlo=0x7f4a7c15,hhi=0x9e3779b9;
    for(let c=1;c<7;c++){
      const blo=(board[c*2]|((board[c*2+1]&3)<<30))>>>0,bhi=board[c*2+1]>>>2;
      let lo=(blo+hlo)>>>0,hi=(bhi+hhi+(lo<blo?1:0))>>>0;
      lo^=(lo>>>30)|(hi<<2);hi^=hi>>>30;
      [lo,hi]=beamMultiply(lo,hi,0x1ce4e5b9,0xbf58476d);
      lo^=(lo>>>27)|(hi<<5);hi^=hi>>>27;
      [lo,hi]=beamMultiply(lo,hi,0x133111eb,0x94d049bb);
      hlo=(hlo^lo^(lo>>>31)^(hi<<1))>>>0;hhi=(hhi^hi^(hi>>>31))>>>0;
    }
    const [slo,shi]=beamMultiply(seed,0,0x7f4a7c15,0x9e3779b9);
    let lo=(hlo^slo)>>>0,hi=(hhi^shi)>>>0;
    lo^=hi>>>1;
    [lo,hi]=beamMultiply(lo,hi,0xed558ccd,0xff51afd7);
    lo=(lo^(hi>>>1))>>>0;
    const remainder=((hi%1000000)*967296+lo)%1000000;
    return remainder/1000000-.5;
  }

  function beamColorWeights(seed,equal){return Array.from({length:7},(_,c)=>{
      if(equal)return 1;
      const a=beamMultiply(seed,0,0x7f4a7c15,0x9e3779b9),b=beamMultiply(c,0,0x1ce4e5b9,0xbf58476d);
      let lo=(a[0]^b[0])>>>0,hi=(a[1]^b[1])>>>0;
      lo=(lo^(lo>>>31)^(hi<<1))>>>0;hi=(hi^(hi>>>31))>>>0;
      return .25+((hi%10000)*7296+lo)%10000/4000;
    });}

  // Reproducible policy stream. BigInt is used only when choosing a new
  // ranking, never while expanding a position. The offset spreads this lane
  // away from the established beam seeds; it stores no boards or moves.
  function resourcePolicyStream() {
    const mask=(1n<<64n)-1n, state=[11235813n];
    for(let i=1;i<312;i++)state[i]=(6364136223846793005n*(state[i-1]^(state[i-1]>>62n))+BigInt(i))&mask;
    let index=312;
    function next(){
      if(index===312){for(let i=0;i<312;i++){
        const x=(state[i]&0xffffffff80000000n)|(state[(i+1)%312]&0x7fffffffn);
        state[i]=state[(i+156)%312]^(x>>1n)^((x&1n)?0xb5026f5aa96619e9n:0n);
      }index=0;}
      let x=state[index++];x^=(x>>29n)&0x5555555555555555n;
      x^=(x<<17n)&0x71d67fffeda60000n;x^=(x<<37n)&0xfff7eee000000000n;x^=x>>43n;
      return x&mask;
    }
    let variant=0;
    return ()=>{let policy;do{
      const seed=next(),colors=Array(7).fill(0);
      for(let c=1;c<7;c++)colors[c]=Math.fround(.25+Number(next()%400n)/100);
      policy={seedLo:Number(seed&0xffffffffn),seedHi:Number(seed>>32n),colors,
        clear:[15,30,45,60][variant%4],group:variant%3===0?.5:2,
        noise:[40,100,150,300,800][variant%5]};
    }while(variant++<45);return policy;};
  }
  function resourceNoise(board,policy) {
    function mix(lo,hi){
      lo^=(lo>>>30)|(hi<<2);hi^=hi>>>30;
      [lo,hi]=beamMultiply(lo,hi,0x1ce4e5b9,0xbf58476d);
      lo^=(lo>>>27)|(hi<<5);hi^=hi>>>27;
      [lo,hi]=beamMultiply(lo,hi,0x133111eb,0x94d049bb);
      return [(lo^(lo>>>31)^(hi<<1))>>>0,(hi^(hi>>>31))>>>0];
    }
    let lo=17,hi=0;
    for(let c=1;c<7;c++)[lo,hi]=mix(lo^(board[c*2]|((board[c*2+1]&3)<<30)),hi^(board[c*2+1]>>>2));
    [lo,hi]=mix(lo^policy.seedLo,hi^policy.seedHi);
    return Math.fround((hi*2097152+(lo>>>11))/9007199254740992);
  }
  // Bounded beam portfolio used by the offline timeout-board solver. Two
  // 30-bit words represent each color, avoiding BigInt costs in the browser.
  // This is a solution finder only: pruning/exhaustion never proves failure.
  function* beamSolve(tiles, adjacency, configuration=null, enhanced=true) {
    const n=tiles.length;
    if(n>60)return 'unknown';
    if(configuration?.adaptive){
      // Each ranking retains its own frontier. A wide search cannot keep the
      // other color priorities waiting for its entire first pass to finish.
      const policies=[
        {width:128,seed:500,clear:30,group:2,noise:150,slice:10},
        {width:128,seed:501,clear:45,group:.5,noise:40,slice:10},
        {width:256,seed:512,clear:30,group:2,noise:150,slice:10},
        {width:1024,seed:548,clear:30,group:2,noise:150,slice:30},
        {width:1024,seed:114,clear:30,group:2,noise:150,equal:true,slice:30},
        {width:512,seed:539,clear:15,group:1,noise:100,slice:80},
        {width:64,seed:535,clear:45,group:.5,noise:800,slice:10}
      ];
      const lanes=policies.map(p=>beamSolve(tiles,adjacency,{...p,adaptiveTail:true}));
      try{for(;;)for(let i=0;i<lanes.length;i++){
        let work=0;
        for(let count=0;count<512;count++){
          const started=Date.now(),step=lanes[i].next();work+=Math.max(0,Date.now()-started);
          if(step.done)return step.value;
          if(step.value.type!=='search'){for(const lane of lanes)if(lane!==lanes[i])lane.return();yield step.value;return yield* lanes[i];}
          yield step.value;if(work>=policies[i].slice)break;
        }
      }}finally{for(const lane of lanes)lane.return();}
    }
    if(!configuration){
      const standard=beamSolve(tiles,adjacency,{width:256,diverse:false,seed:1,initialNoise:0,retryNoise:120});
      const wide=beamSolve(tiles,adjacency,{width:512,diverse:false,seed:2,initialNoise:60,retryNoise:120});
      const varied=beamSolve(tiles,adjacency,{width:64,diverse:true,seed:3,initialNoise:200,retryNoise:300});
      const adaptive=enhanced?beamSolve(tiles,adjacency,{adaptive:true}):null;
      const lanes=[standard,wide,varied,adaptive].filter(Boolean);
      function* finish(winner,event){for(const lane of lanes)if(lane!==winner)lane.return();yield event;return yield* winner;}
      try{
        // Give the deterministic search ten seconds, retaining its frontier.
        // All rankings then share computation so a difficult first pass cannot
        // keep the adaptive searches waiting until the caller times out.
        let headStart=0;for(;;){const started=Date.now(),step=standard.next();headStart+=Math.max(0,Date.now()-started);if(step.done)return step.value;if(step.value.type!=='search')return yield* finish(standard,step.value);yield step.value;if(step.value.restart>1||enhanced&&headStart>=10000)break;}
        for(;;)for(const [lane,slice] of (enhanced?[[adaptive,60],[wide,15],[varied,10],[standard,5]]:[[wide,25],[varied,20],[standard,5]])){
          let work=0;
          for(let count=0;count<512;count++){
            const started=Date.now(),step=lane.next();work+=Math.max(0,Date.now()-started);
            if(step.done)return step.value;
            if(step.value.type!=='search')return yield* finish(lane,step.value);
            yield step.value;if(work>=slice)break;
          }
        }
      }finally{for(const lane of lanes)lane.return();}
    }
    const pop=x=>{x-=(x>>>1)&0x55555555;x=(x&0x33333333)+((x>>>2)&0x33333333);return (((x+(x>>>4))&0x0f0f0f0f)*0x01010101)>>>24;};
    const bits=Array.from({length:n},(_,i)=>1<<(i%30));
    const halves=Array.from({length:n},(_,i)=>i<30?0:1);
    const edges=adjacency.map(a=>{const m=[0,0];for(const i of a)m[halves[i]]|=bits[i];return m;});
    function neighbors(lo,hi){let a=0,b=0;while(lo){const bit=lo&-lo,i=31-Math.clz32(bit);lo^=bit;a|=edges[i][0];b|=edges[i][1];}while(hi){const bit=hi&-hi,i=61-Math.clz32(bit);hi^=bit;a|=edges[i][0];b|=edges[i][1];}return [a,b];}
    function flood(lo,hi,allowedLo,allowedHi){for(;;){const [a,b]=neighbors(lo,hi),x=lo|(a&allowedLo),y=hi|(b&allowedHi);if(x===lo&&y===hi)return [lo,hi];lo=x;hi=y;}}
    const colorGroupCaches=configuration.adaptiveTail?Array.from({length:7},()=>boundedMap(1024)):null;
    function colorGroups(board){
      if(!colorGroupCaches){const result=[];for(let c=1;c<7;c++){let lo=board[c*2],hi=board[c*2+1];while(lo||hi){const [a,b]=flood(lo?lo&-lo:0,lo?0:hi&-hi,lo,hi);lo^=a;hi^=b;const [edgeLo,edgeHi]=neighbors(a,b);result.push({lo:a,hi:b,edgeLo,edgeHi,color:c,size:pop(a)+pop(b)});}}return result;}
      const result=[];
      for(let c=1;c<7;c++){
        let lo=board[c*2],hi=board[c*2+1];const cache=colorGroupCaches?.[c],key=lo+','+hi,cached=cache?.get(key);
        if(cached){result.push(...cached);continue;}
        const groups=[];
        while(lo||hi){const [a,b]=flood(lo?lo&-lo:0,lo?0:hi&-hi,lo,hi);lo^=a;hi^=b;const [edgeLo,edgeHi]=neighbors(a,b);groups.push({lo:a,hi:b,edgeLo,edgeHi,color:c,size:pop(a)+pop(b)});}
        if(cache)cache.set(key,groups);result.push(...groups);
      }
      return result;
    }
    function cells(lo,hi){const out=[];while(lo){const bit=lo&-lo;out.push(31-Math.clz32(bit));lo^=bit;}while(hi){const bit=hi&-hi;out.push(61-Math.clz32(bit));hi^=bit;}return out;}
    function occupancy(b){let lo=0,hi=0;for(let c=1;c<7;c++){lo|=b[c*2];hi|=b[c*2+1];}return [lo,hi];}
    function viable(b,lo,hi){
      const ingredient=[[0,0],[0,0],[0,0]];
      for(let c=1;c<7;c++)for(let k=0;k<3;k++)if(c&(1<<k)){ingredient[k][0]|=b[c*2];ingredient[k][1]|=b[c*2+1];}
      let leftLo=lo,leftHi=hi;
      while(leftLo||leftHi){const [a,d]=flood(leftLo?leftLo&-leftLo:0,leftLo?0:leftHi&-leftHi,leftLo,leftHi);leftLo^=a;leftHi^=d;const totals=ingredient.map(m=>pop(a&m[0])+pop(d&m[1]));if(totals[0]!==totals[1]||totals[0]!==totals[2])return false;}
      for(const s of [3,5,6]){
        let remainLo=b[s*2],remainHi=b[s*2+1];if(!remainLo&&!remainHi)continue;
        const demands=[];let allowedLo=0,allowedHi=0;for(let c=1;c<7;c++)if(!(c&~s)){allowedLo|=b[c*2];allowedHi|=b[c*2+1];}
        while(remainLo||remainHi){const [a,d]=flood(remainLo?remainLo&-remainLo:0,remainLo?0:remainHi&-remainHi,allowedLo,allowedHi);remainLo&=~a;remainHi&=~d;const [e,f]=neighbors(a,d),complement=7^s;let supplyLo=e&b[complement*2],supplyHi=f&b[complement*2+1],donorLo=0,donorHi=0;
          while(supplyLo||supplyHi){const [x,y]=flood(supplyLo?supplyLo&-supplyLo:0,supplyLo?0:supplyHi&-supplyHi,b[complement*2],b[complement*2+1]);donorLo|=x;donorHi|=y;supplyLo&=~x;supplyHi&=~y;}
          const need=pop(a&b[s*2])+pop(d&b[s*2+1]);
          if(need>pop(donorLo)+pop(donorHi))return false;
          demands.push({need,lo:donorLo,hi:donorHi});
        }
        let need=0,donorLo=0,donorHi=0;
        for(const d of demands){need+=d.need;donorLo|=d.lo;donorHi|=d.hi;}
        if(need>pop(donorLo)+pop(donorHi))return false;
        for(let a=0;a<demands.length;a++)for(let d=a+1;d<demands.length;d++){
          const x=demands[a],y=demands[d],lo=x.lo|y.lo,hi=x.hi|y.hi;
          if(x.need+y.need>pop(lo)+pop(hi))return false;
          for(let c=d+1;c<demands.length;c++){const z=demands[c];if(x.need+y.need+z.need>pop(lo|z.lo)+pop(hi|z.hi))return false;}
        }
      }
      return true;
    }
    // Optimistic future secondary regions give each primary tile routes to
    // its two missing ingredients. A matching requires distinct donor tiles
    // across ALL routes, rather than spending one donor several times.
    // Regions may contain currently unmixed primaries: this overestimates
    // reachability, which is essential for sound rejection.
    function resourceViable(b,gs) {
      const profiles=Array.from({length:7},()=>Array(n).fill(null));
      const ingredients=[1,2,4].map(bit=>{
        let lo=0,hi=0;for(let c=1;c<7;c++)if(c&bit){lo|=b[c*2];hi|=b[c*2+1];}return [lo,hi];
      });
      for(const s of [3,5,6]){
        const bits=[1,2,4].filter(c=>c&s);let leftLo=b[s*2]|b[bits[0]*2]|b[bits[1]*2],leftHi=b[s*2+1]|b[bits[0]*2+1]|b[bits[1]*2+1];
        while(leftLo||leftHi){
          const [lo,hi]=flood(leftLo?leftLo&-leftLo:0,leftLo?0:leftHi&-leftHi,leftLo,leftHi);leftLo&=~lo;leftHi&=~hi;
          const capacity=Math.min(...bits.map(bit=>pop(lo&(b[s*2]|b[bit*2]))+pop(hi&(b[s*2+1]|b[bit*2+1]))));
          const [el,eh]=neighbors(lo,hi),complement=7^s;let sl=el&b[complement*2],sh=eh&b[complement*2+1],dl=0,dh=0;
          while(sl||sh){const [a,d]=flood(sl?sl&-sl:0,sl?0:sh&-sh,b[complement*2],b[complement*2+1]);dl|=a;dh|=d;sl&=~a;sh&=~d;}
          const distances=Array(n).fill(Infinity);let wl=lo&neighbors(b[complement*2],b[complement*2+1])[0],wh=hi&neighbors(b[complement*2],b[complement*2+1])[1],vl=0,vh=0,distance=1;
          while(wl||wh){for(const i of cells(wl,wh))distances[i]=distance;vl|=wl;vh|=wh;const [a,d]=neighbors(wl,wh);wl=a&lo&~vl;wh=d&hi&~vh;distance++;}
          const region={lo,hi,capacity,dl,dh,distances};for(const i of cells(lo,hi))profiles[s][i]=region;
          for(const i of cells(lo&b[s*2],hi&b[s*2+1]))if(distances[i]>capacity)return false;
        }
      }
      const demands=Array.from({length:7},()=>[[],[],[]]);
      for(const g of gs){
        const color=g.color;if(color!==1&&color!==2&&color!==4)continue;
        const opposite=7^color,direct=new Set(cells(g.edgeLo,g.edgeHi).map(i=>profiles[opposite][i]).filter(r=>r&&r.capacity>0));
        const partners=gs.filter(h=>(h.color===1||h.color===2||h.color===4)&&!(color&h.color)&&((g.edgeLo&h.lo)||(g.edgeHi&h.hi)));
        for(const i of cells(g.lo,g.hi)){
          const supplies=[[0,0],[0,0],[0,0]];let escape=direct.size>0;
          for(const r of direct)for(let k=0;k<3;k++){supplies[k][0]|=r.lo&ingredients[k][0];supplies[k][1]|=r.hi&ingredients[k][1];}
          for(const h of partners){const s=color|h.color,r=profiles[s][i];if(!r)continue;
            let distance=r.distances[i];for(const j of cells(h.lo,h.hi))distance=Math.min(distance,r.distances[j]);
            if(distance>r.capacity)continue;escape=true;
            for(let k=0;k<3;k++)if(!(color&(1<<k))){supplies[k][0]|=(s&(1<<k))?h.lo:r.dl;supplies[k][1]|=(s&(1<<k))?h.hi:r.dh;}
          }
          if(!escape)return false;
          for(let k=0;k<3;k++)if(!(color&(1<<k)))demands[color][k].push(supplies[k]);
        }
      }
      for(const color of [1,2,4])for(const list of demands[color]){
        const matched=Array(n).fill(-1);
        function assign(i,seen){for(const j of cells(list[i][0],list[i][1])){
          if(seen[j])continue;seen[j]=true;
          if(matched[j]<0||assign(matched[j],seen)){matched[j]=i;return true;}
        }return false;}
        for(let i=0;i<list.length;i++)if(!assign(i,Array(n).fill(false)))return false;
      }
      return true;
    }
    const nextResourcePolicy=configuration.resourceMatching?resourcePolicyStream():null;
    let resourcePolicy=null;
    function resourceRank(b,lo,hi,gs){
      let score=Math.fround(-resourcePolicy.clear*(pop(lo)+pop(hi)));
      for(const g of gs){
        score=Math.fround(score+Math.fround(Math.fround(Math.fround(resourcePolicy.group*resourcePolicy.colors[g.color])*g.size)*g.size));
        if(g.color===1||g.color===2||g.color===4){let a=0,d=0;for(let c=1;c<7;c++)if(!(c&g.color)){a|=b[c*2];d|=b[c*2+1];}if(!((g.edgeLo&a)||(g.edgeHi&d)))return -Infinity;}
      }
      for(const term of occupancyScore(lo,hi))score=Math.fround(score+term);
      return Math.fround(score+Math.fround(resourceNoise(b,resourcePolicy)*resourcePolicy.noise));
    }
    const key=b=>String.fromCharCode(b[2]&65535,b[2]>>>16,b[3]&65535,b[3]>>>16,b[4]&65535,b[4]>>>16,b[5]&65535,b[5]>>>16,b[6]&65535,b[6]>>>16,b[7]&65535,b[7]>>>16,b[8]&65535,b[8]>>>16,b[9]&65535,b[9]>>>16,b[10]&65535,b[10]>>>16,b[11]&65535,b[11]>>>16,b[12]&65535,b[12]>>>16,b[13]&65535,b[13]>>>16);
    const occupancyScores=boundedMap(8192);
    function occupancyScore(lo,hi){
      const k=lo+','+hi,cached=occupancyScores.get(k);if(cached!==undefined)return cached;
      const terms=[];for(const i of cells(lo,hi)){const degree=pop(edges[i][0]&lo)+pop(edges[i][1]&hi);terms.push(degree*2-(degree<=1?15:0));}
      occupancyScores.set(k,terms);return terms;
    }
    function rank(b,lo,hi,gs,diverse,weights=null){let score=-(weights?.clear??45)*(pop(lo)+pop(hi));for(const g of gs){score+=(weights?.group??(diverse ? 0.5 : 2))*(weights?.colors[g.color]??1)*g.size*g.size;if(g.color===1||g.color===2||g.color===4){let a=0,d=0;for(let c=1;c<7;c++)if(!(c&g.color)){a|=b[c*2];d|=b[c*2+1];}if(!((g.edgeLo&a)||(g.edgeHi&d)))return -Infinity;}}if(configuration.adaptiveTail)for(const term of occupancyScore(lo,hi))score+=term;else for(const i of cells(lo,hi)){const degree=pop(edges[i][0]&lo)+pop(edges[i][1]&hi);score+=degree*2-(degree<=1?15:0);}return score;}
    function* exactTail(b,budget,weights){
      if(budget.left--<=0)return undefined;
      if((++checked&127)===0)yield {type:'search',phase:'beam-planning',positions:checked,tiles:tiles.slice(),message:'Checking a bounded endgame continuation.'};
      const [lo,hi]=occupancy(b);if(!lo&&!hi)return [];
      const k=key(b);if(tailDead.has(k))return null;
      const remember=()=>{if(tailDead.size>=20000)tailDead.delete(tailDead.values().next().value);tailDead.add(k);};
      if(!viable(b,lo,hi)){remember();return null;}
      // Independent occupied components cannot exchange any ingredients.
      const [cl,ch]=flood(lo?lo&-lo:0,lo?0:hi&-hi,lo,hi);
      if(cl!==lo||ch!==hi){
        let leftLo=lo,leftHi=hi;const result=[],components=[];
        while(leftLo||leftHi){const [a,d]=flood(leftLo?leftLo&-leftLo:0,leftLo?0:leftHi&-leftHi,leftLo,leftHi);leftLo&=~a;leftHi&=~d;components.push({lo:a,hi:d,size:pop(a)+pop(d)});}
        components.sort((a,b)=>a.size-b.size);
        for(const {lo:a,hi:d} of components){const sub=b.map((v,i)=>v&(i%2?d:a));const path=yield* exactTail(sub,budget,weights);if(path===undefined)return undefined;if(path===null){remember();return null;}result.push(...path);}
        return result;
      }
      const gs=colorGroups(b),moves=[],seen=new Set();
      for(let a=0;a<gs.length;a++)for(let d=a+1;d<gs.length;d++){
        const g=gs[a],h=gs[d];if((g.color&h.color)||!((g.edgeLo&h.lo)||(g.edgeHi&h.hi)))continue;
        for(const x of cells(g.lo,g.hi))for(const y of cells(h.lo,h.hi))for(let dir=0;dir<((g.color|h.color)===7?1:2);dir++){
          const source=dir?y:x,target=dir?x:y,sc=dir?h.color:g.color,tc=dir?g.color:h.color,mix=sc|tc,next=b.slice();
          next[sc*2+halves[source]]&=~bits[source];next[tc*2+halves[target]]&=~bits[target];if(mix!==7)next[mix*2+halves[target]]|=bits[target];
          const nk=key(next);if(seen.has(nk))continue;seen.add(nk);
          const [a,d]=occupancy(next),score=configuration.resourceMatching?resourceRank(next,a,d,colorGroups(next)):rank(next,a,d,colorGroups(next),true,weights);
          if(score!==-Infinity)moves.push({source,target,board:next,score});
        }
      }
      moves.sort((a,b)=>b.score-a.score);
      for(const move of moves){const path=yield* exactTail(move.board,budget,weights);if(path===undefined)return undefined;if(path!==null)return [{source:move.source,target:move.target},...path];}
      remember();return null;
    }
    const root=Array(14).fill(0);for(let i=0;i<n;i++)root[masks[tiles[i]]*2+halves[i]]|=bits[i];root[0]=root[1]=0;
    if(tiles.every(c=>c==='white'))return 'solved';
    let checked=0;
    const tailDead=new Set();
    for(let attempt=0;;attempt++){
      if(nextResourcePolicy)resourcePolicy=nextResourcePolicy();
      const setting=configuration.adaptiveTail?configuration:null;
      const width=setting?.width??configuration.width,diverse=configuration.diverse??true;
      const seed=setting?setting.seed+attempt:configuration.seed+attempt;
      const noise=setting?.noise??(attempt?configuration.retryNoise:configuration.initialNoise);
      const weights=setting?{...setting,colors:beamColorWeights(setting.seed,setting.equal)}:null;
      let frontier=[{board:root,parent:null}],winner=null,tailPath=[];
      yield {type:'search',phase:'beam-planning',tiles:tiles.slice(),positions:checked,restart:attempt+1,message:`Exploring alternative full-board continuations (beam ${width}, attempt ${attempt+1}).`};
      // A primary mix removes one cell; a three-ingredient clearance removes
      // two. Ingredient totals determine the required number of clearances.
      const depthLimit=tiles.filter(c=>c!=='white').length-tiles.reduce((sum,c)=>sum+pop(masks[c]),0)/3;
      for(let depth=0;depth<depthLimit&&!winner;depth++){
        const seen=new Set(),retained=new Set(),heap=[];
        // Keep only the best width candidates instead of retaining every child.
        function keep(node){if(retained.has(node.key))return;if(heap.length<width){retained.add(node.key);heap.push(node);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].score<=node.score)break;heap[i]=heap[p];i=p;}heap[i]=node;}else if(node.score>heap[0].score){retained.delete(heap[0].key);retained.add(node.key);let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].score<heap[j].score)j++;if(heap[j].score>=node.score)break;heap[i]=heap[j];i=j;}heap[i]=node;}}
        expansion: for(const parent of frontier){const gs=colorGroups(parent.board);for(let a=0;a<gs.length;a++)for(let d=a+1;d<gs.length;d++){
          const g=gs[a],h=gs[d];if((g.color&h.color)||!((g.edgeLo&h.lo)||(g.edgeHi&h.hi)))continue;
          for(const x of cells(g.lo,g.hi))for(const y of cells(h.lo,h.hi))for(let dir=0;dir<((g.color|h.color)===7?1:2);dir++){
            const source=dir?y:x,target=dir?x:y,sc=dir?h.color:g.color,tc=dir?g.color:h.color,mix=sc|tc;
            const b=parent.board.slice();b[sc*2+halves[source]]&=~bits[source];b[tc*2+halves[target]]&=~bits[target];if(mix!==7)b[mix*2+halves[target]]|=bits[target];
            if((++checked&127)===0)yield {type:'search',phase:'beam-planning',positions:checked,depth,tiles:tiles.slice()};
            const k=key(b);if(seen.has(k))continue;
            // Forgetting dedup keys affects speed only, and bounds memory even
            // on large groups with many possible source/target pairs.
            if(seen.size<(configuration.adaptiveTail?50000:250000))seen.add(k);
            const [lo,hi]=occupancy(b),node={board:b,parent,source,target,key:k,score:0};
            if(!lo&&!hi){winner=node;break expansion;}
            if(!configuration.adaptiveTail&&!viable(b,lo,hi))continue;
            const gsNext=colorGroups(b);
            let score=configuration.resourceMatching?resourceRank(b,lo,hi,gsNext):rank(b,lo,hi,gsNext,diverse,weights);if(score===-Infinity)continue;
            if(noise&&!configuration.resourceMatching)score+=beamNoise(b,seed)*noise;
            // A candidate below a full beam's cutoff cannot be retained even
            // if viable. Defer expensive ingredient/donor checks until needed.
            if(configuration.adaptiveTail){
              if(heap.length>=width&&score<=heap[0].score)continue;
              if(!viable(b,lo,hi))continue;
              if(configuration.resourceMatching&&!resourceViable(b,gsNext))continue;
            }
            node.score=score;keep(node);
          }
          if(winner)break;
        }if(winner)break;}
        if(!heap.length)break;
        frontier=heap.sort((a,b)=>b.score-a.score);
        if(configuration.adaptiveTail){
          const probeCandidates=frontier.slice(0,16);
          for(const node of (configuration.resourceMatching?probeCandidates.slice(0,8):probeCandidates)){
            const [lo,hi]=occupancy(node.board);if(pop(lo)+pop(hi)>(configuration.resourceMatching?20:24)||configuration.resourceMatching&&depth<24)continue;
            const path=yield* exactTail(node.board,{left:configuration.resourceMatching?15000:50000},weights);
            if(path!==null&&path!==undefined){winner=node;tailPath=path;break;}
          }
        }
      }
      if(!winner)continue;
      const path=[];for(let node=winner;node.parent;node=node.parent)path.push({source:node.source,target:node.target});path.reverse();path.push(...tailPath);
      // Validate the complete plan before handing any move to the player.
      let current=tiles.map(c=>masks[c]);const playback=[];
      for(const [i,move] of path.entries()){
        const gs=blobs(current,adjacency),source=gs.find(g=>g.includes(move.source)),target=new Set(gs.find(g=>g.includes(move.target)));
        if(!current[move.source]||!current[move.target]||(current[move.source]&current[move.target])||!source.some(x=>adjacency[x].some(y=>target.has(y))))throw new Error('Invalid beam continuation');
        const before=current.map(c=>names[c]),mix=current[move.source]|current[move.target];current[move.source]=0;current[move.target]=mix===7?0:mix;
        playback.push({type:'forward',sourceIndex:move.source,targetIndex:move.target,before,after:current.map(c=>names[c]),plan:{id:1,kind:'verified-continuation',description:'Complete beam-search continuation',color:null,cells:[],anchors:[],resources:[],step:i+1,total:path.length,verified:true,continuationVerified:true,batchGroups:1}});
      }
      if(current.some(Boolean))throw new Error('Incomplete beam continuation');
      yield* playback;return 'solved';
    }
  }

  // Cooperative search strategies share the caller's computation deadline.
  // Keep the successful offline beam and diagnostic strategies available
  // alongside the two strategic planners. Only a fully verified continuation is played.
  function* hybridSolve(tiles,adjacency,options) {
    const quickPlanMs=options.quickPlanMs??1000;
    if(!Number.isFinite(quickPlanMs)||quickPlanMs<0)throw new RangeError('quickPlanMs must be nonnegative and finite');
    const legacyAttempt=variant=>solveAttempt(tiles,adjacency,{...options,
      moveTreeSearch:false,strategyOnly:true,bridgePlanning:false,batchGroups:0,
      planningVariant:variant,sectionRestarts:options.sectionRestarts??4});
    function* bridgePortfolio(expanded=false){
      for(let attempt=0;;attempt++){
        const scale=2**Math.min(3,Math.floor(attempt/3));
        yield {type:'search',phase:'bridge-planning',restart:attempt+1,tiles:tiles.slice(),
          message:`Planning interacting color bridges (attempt ${attempt+1}).`};
        const search=solveAttempt(tiles,adjacency,{...options,moveTreeSearch:false,
          strategyOnly:true,bridgePlanning:true,batchGroups:0,planningVariant:attempt,
          bridgeWidth:options.bridgeWidth??(expanded?64:8*scale),
          bridgeGoalBudget:options.bridgeGoalBudget??(expanded?144:18*scale),
          bridgeJobStates:options.bridgeJobStates??(expanded?768:96*scale),
          bridgeVariants:options.bridgeVariants??(expanded?32:4*scale),
          bridgePathStates:options.bridgePathStates??(expanded?2048:256*scale)});
        try{
          let step;
          while(!(step=search.next()).done)yield step.value;
          if(step.value!=='unknown')return step.value;
        }finally{search.return();}
      }
    }
    let legacy=legacyAttempt(0),bridges=bridgePortfolio(),legacyVariant=0,legacyWork=0;
    // Match the offline strategy that solved the latest screenshot. Partial
    // continuations receive bounded probes; the root proof remains cooperative
    // and is stopped by the same Auto Play timeout as every other strategy.
    let diagnostic=options.diagnosticSearch===false?null:solveAttempt(tiles,adjacency,{
      ...options,moveTreeSearch:true,strategyOnly:false,bridgePlanning:false,
      progressive:false,stopBeforeExhaustive:false,batchGroups:0,
      strategyStates:options.strategyStates??12000,
      sectionStates:options.sectionStates??120000,
      frontierStates:options.frontierStates??4096});
    let beam=options.beamSearch===false?null:beamSolve(tiles,adjacency,null,false);
    let resources=options.beamSearch===false?null:beamSolve(tiles,adjacency,{width:512,adaptiveTail:true,resourceMatching:true});
    let resourceWarmupDone=false,resourceWarmupWork=0;
    const resourceAfterMs=options.resourceAfterMs??60000,resourceWarmupMs=options.resourceWarmupMs??90000;
    for(const [key,value] of Object.entries({resourceAfterMs,resourceWarmupMs}))if(!Number.isFinite(value)||value<0)throw new RangeError(`${key} must be nonnegative and finite`);
    let enhanced=false,portfolioWork=0;
    const adaptiveAfterMs=options.adaptiveAfterMs??210000;
    if(!Number.isFinite(adaptiveAfterMs)||adaptiveAfterMs<0)throw new RangeError('adaptiveAfterMs must be nonnegative and finite');
    const closeOthers=winner=>{for(const search of [legacy,bridges,diagnostic,beam,resources])if(search&&search!==winner)search.return();};
    const advance=search=>{
      const started=Date.now(),step=search.next(),work=Math.max(0,Date.now()-started);portfolioWork+=work;
      return {step,work};
    };
    try{
      let quickWork=0;
      while(quickWork<quickPlanMs){
        const {step,work}=advance(legacy);quickWork+=work;legacyWork+=work;
        if(step.done){
          if(step.value!=='unknown')return step.value;
          legacy=legacyAttempt(++legacyVariant);legacyWork=0;break;
        }
        if(step.value.type!=='search'){
          closeOthers(legacy);yield step.value;return yield* legacy;
        }
        yield step.value;
      }
      for(;;){
        // Bounded execution slices retain every lane's frontier across turns. Browser
        // scheduling and animation pauses are excluded from computation totals.
        // Preserve the established five-minute regressions: most finish in
        // this initial portfolio. Harder deals then get the learned rankings
        // and larger bridge frontier without retaining duplicate beam caches.
        // Leave common deals on their established fast path. A bounded,
        // uninterrupted turn lets the donor-aware frontier finish useful work
        // before it joins the longer-running adaptive portfolio.
        if(resources&&!resourceWarmupDone&&portfolioWork>=resourceAfterMs){
          resourceWarmupDone=true;let work=0;
          while(work<resourceWarmupMs){
            const result=advance(resources),step=result.step;work+=result.work;resourceWarmupWork+=result.work;
            if(step.done){if(step.value!=='unknown')return step.value;resources=null;break;}
            if(step.value.type!=='search'){
              closeOthers(resources);step.value.strategyLane='resource-beam';yield step.value;return yield* resources;
            }
            yield step.value;
          }
        }
        if(!enhanced&&beam&&portfolioWork-resourceWarmupWork>=adaptiveAfterMs){
          closeOthers(resources);legacyVariant=0;legacy=legacyAttempt(0);legacyWork=0;diagnostic=null;
          beam=beamSolve(tiles,adjacency,{adaptive:true});
          bridges=options.expandedBridgeSearch===false?null:bridgePortfolio(true);
          enhanced=true;
          yield {type:'search',phase:'beam-planning',tiles:tiles.slice(),message:'Trying adaptive color priorities and larger bridge plans.'};
        }
        const schedule=enhanced?[[beam,400],[resources,120],[bridges,200],[legacy,150]]:[[beam,300],[diagnostic,15],[bridges,10],[legacy,5]];
        for(const [search,slice] of schedule){
          if(!search)continue;
          let work=0;
          for(let steps=0;steps<(enhanced||search===diagnostic||search===beam?512:32);steps++){
            const result=advance(search),step=result.step;work+=result.work;
            if(search===legacy)legacyWork+=result.work;
            if(step.done){
              if(step.value!=='unknown')return step.value;
              if(search===beam)beam=null;
              else if(search===diagnostic)diagnostic=null;
              else if(search===resources)resources=null;
              else if(search===legacy){legacy=legacyAttempt(++legacyVariant);legacyWork=0;}
              break;
            }
            if(step.value.type!=='search'){
              closeOthers(search);
              if(step.value.type==='forward')step.value.strategyLane=search===legacy?'group-planning':search===bridges?'bridge-planning':search===beam?'beam':search===resources?'resource-beam':'diagnostic';
              yield step.value;return yield* search;
            }
            yield step.value;
            if(work>=slice)break;
          }
        }
        if(legacy&&legacyWork>=(enhanced?15000:60000)){
          legacy.return();legacy=legacyAttempt(++legacyVariant);legacyWork=0;
          yield {type:'search',phase:'planning',tiles:tiles.slice(),
            message:`Trying another group-planning ranking (attempt ${legacyVariant+1}); bridge planning retains its progress.`};
        }
      }
    }finally{legacy?.return();bridges?.return();diagnostic?.return();beam?.return();resources?.return();}
  }

  // Restart strategic planning from committed tiles, retaining undo history.
  // Measure time inside next(), excluding display pauses and browser scheduling.
  function* solveRun(tiles,adjacency,options={}) {
    if(options.hybrid)return yield* hybridSolve(tiles,adjacency,options);
    if(options.moveTreeSearch!==false)return yield* solveAttempt(tiles,adjacency,options);
    const restartAfterMs=options.restartAfterMs??30000;
    if(!Number.isFinite(restartAfterMs)||restartAfterMs<=0)
      throw new RangeError('restartAfterMs must be positive and finite');
    let current=tiles.slice(),history=(options.history||[]).slice(),attempt=0;
    for(;;){
      const search=solveAttempt(current,adjacency,{...options,history,
        planningVariant:(options.planningVariant||0)+attempt});
      let workMs=0,restart=false;
      try {
        for(;;){
          const started=Date.now(),step=search.next();
          workMs+=Math.max(0,Date.now()-started);
          if(step.done)return step.value;
          const event=step.value;
          if(event.type==='forward'){
            history.push({tiles:current.slice()});current=event.after.slice();workMs=0;
          }else if(event.type==='backtrack'){
            current=event.before.slice();history.pop();workMs=0;
          }
          // Never abandon an already verified batch halfway through playback.
          if(event.type==='search'&&workMs>=restartAfterMs){restart=true;break;}
          yield event;
        }
      }finally{search.return();}
      if(!restart)return 'unknown';
      attempt++;
      yield {type:'search',phase:'planning',tiles:current.slice(),restart:attempt,
        message:`Restarting strategic planning: trying alternative rankings and group priorities (attempt ${attempt+1}).`};
    }
  }
  function* solve(tiles,adjacency,options={}) {
    let finished=false;
    try {
      const result=yield* solveRun(tiles,adjacency,options);
      finished=true;return result;
    } finally {
      // Cancellation keeps useful proofs; a concluded search releases memory.
      if(finished)proofMemory=null;
    }
  }
  // Internal transport between this page and its own worker. These snapshots
  // contain established proofs, not user input or a saved board file.
  function exportProofCache() {
    return proofMemory?{graph:proofMemory.graph,limit:proofMemory.limit,root:proofMemory.root,keys:[...proofMemory.dead]}:null;
  }
  function restoreProofCache(snapshot) {
    if(!snapshot)return;
    if(typeof snapshot.graph!=='string'||!Number.isSafeInteger(snapshot.limit)||snapshot.limit<0||
      !Array.isArray(snapshot.keys)||snapshot.keys.length>snapshot.limit||snapshot.keys.some(k=>typeof k!=='string'))
      throw new TypeError('Invalid internal proof cache');
    const dead=boundedSet(snapshot.limit);for(const key of snapshot.keys)dead.add(key);
    proofMemory={graph:snapshot.graph,limit:snapshot.limit,root:snapshot.root,dead};
  }
  return {solve,assess,exportProofCache,restoreProofCache};
}
const SplashSearch = createSplashSearch();
if (typeof module !== 'undefined') module.exports = SplashSearch;
