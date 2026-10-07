/* Resource-aware plan search with a silent complete fallback.
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
      if(reservations.size===size)return primaryGateReason(board,adjacency,allBlobs) ||
        bridgeLayoutReason(board,adjacency,allBlobs,profiles,reservations,planning.resourceDemands) ||
        narrowConnectionReason(board,adjacency,allBlobs) ||
        primaryGateOrderingReason(board,adjacency,allBlobs,profiles);
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
          next.forEach((c,k)=>{if(c){const degree=adjacency[k].filter(v=>next[v]).length;score+=degree*degree-(degree===1?15:degree===0?100:0);}});
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
  // Strategic search has two distinct layers. A bounded planner searches whole
  // clearing jobs, including their actual donor assignments and execution order.
  // If its vocabulary/budget is insufficient, complete search stays silent.
  // Verified mode waits for a complete continuation. Progressive mode bounds
  // the planning pass, then emits legal attempts and exact failed-branch undos.
  function* solve(tiles, adjacency, {
    strategyStates=120000, sectionStates=120000, sectionWidth=8, sectionRestarts=16, sectionEndgameTiles=18, sectionEndgameStates=65536, localStates=1536, planVariants=24, layoutLimit=192, bridgeStates=16384,
    history=[], lookaheadStates, endgameTiles, progressive=false, stopBeforeExhaustive=false, strategyOnly=false, batchGroups=0, proofTiles=20, proofStates=16384
  } = {}) {
    // Accept the old options for saved integrations; they no longer authorize
    // speculative playback or change the meaning of an unresolved position.
    for(const [key,value] of Object.entries({strategyStates,sectionStates,sectionWidth,sectionRestarts,sectionEndgameTiles,sectionEndgameStates,localStates,planVariants,layoutLimit,bridgeStates,lookaheadStates,endgameTiles,batchGroups,proofTiles,proofStates}))
      if(value!==undefined && (!Number.isSafeInteger(value)||value<0))throw new RangeError(`${key} must be a nonnegative safe integer`);
    const graphKey=JSON.stringify(adjacency);
    if(continuation?.graph===graphKey&&(!strategyOnly||continuation.strategic)){
      const start=continuation.events.findIndex(e=>e.before.every((c,i)=>c===tiles[i])&&e.before.length===tiles.length);
      if(start>=0){for(const event of continuation.events.slice(start))yield event;return 'solved';}
    }
    const assessments=new Map(),dead=new Set(),winning=new Map();
    let frontiers=[];
    let positions=0,plansTried=0;
    const primary=c=>c===1||c===2||c===4;
    const keyOf=b=>b.join('');
    const parts=b=>groups(b.flatMap((c,i)=>c?[i]:[]),adjacency).sort((a,b)=>a.length-b.length);
    const isolated=(b,cells)=>{const out=Array(b.length).fill(0);for(const i of cells)out[i]=b[i];return out;};
    const stepBoard=(b,m)=>{const next=b.slice(),c=b[m.source]|b[m.target];next[m.source]=0;next[m.target]=c===7?0:c;return next;};
    function assessment(b) {
      const key=keyOf(b);
      if(!assessments.has(key)) {
        const reservations=new Map(),allBlobs=blobs(b,adjacency);
        const reason=rejectionReason(b,adjacency,allBlobs,reservations);
        assessments.set(key,{reason,reservations,allBlobs});
      }
      return assessments.get(key);
    }
    const checkpoint=(phase,goal=null)=>({type:'search',phase,positions,plansTried,
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
          positions++;if((positions&127)===1)yield checkpoint('funding',objective);
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
          if(blob.length<=6)seeds.push({color,cells:blob,region,anchor:false});
          if(blob.length>1)for(const cell of blob)seeds.push({color,cells:[cell],region,anchor:false});
        }
      }
      const slack=seed=>seed.region.supplierBlobs.filter(blob=>blob.some(i=>adjacency[i].some(j=>seed.cells.includes(j))))
        .reduce((n,blob)=>n+blob.length,0)-seed.cells.length;
      // A group without a current clearing connection needs its bridge before
      // well-supplied neighbors consume the cells that could form that bridge.
      seeds.sort((a,c)=>Number(c.anchor)-Number(a.anchor) || slack(a)-slack(c) ||
        (a.region.suppliers.length-a.cells.length)-(c.region.suppliers.length-c.cells.length));
      for(const seed of seeds) {
        const allowed=new Set(seed.region.cells),queue=[seed.cells],visited=new Set();
        let layouts=0;
        while(queue.length&&layouts<layoutLimit&&budget.left>0) {
          budget.left--;positions++;if((positions&15)===1)yield checkpoint('planning',seed);
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
          // Prefer the shortest extensions; no bound here excludes a legal
          // solution from the complete fallback. Keep construction manageable.
          if(donors.length>=6)continue;
          const boundary=[...new Set(list.flatMap(i=>adjacency[i]))]
            .filter(i=>allowed.has(i)&&!cells.has(i));
          for(const i of boundary)queue.push([...list,i]);
        }
      }
    }

    // Build first, then clear. A completed plan has an executable sequence,
    // not merely a matching or a path through hypothetical future colors.
    function* localPlans(b,goal,budget) {
      const members=new Set(goal.cells),seen=new Set(),outputs=new Set();
      let left=localStates,count=0;
      function* visit(current,path,resources) {
        if(left--<=0||budget.left--<=0||count>=planVariants)return;
        positions++;if((positions&15)===1)yield checkpoint('planning',goal);
        const key=keyOf(current);if(seen.has(key))return;seen.add(key);
        if(assessment(current).reason)return;
        if(goal.cells.every(i=>!current[i])) {
          if(!outputs.has(key)){outputs.add(key);count++;
            yield {next:current,moves:path,goal,resources};}
          return;
        }
        const building=goal.cells.some(i=>current[i]&&current[i]!==goal.color);
        let candidates=legal(current).filter(m=>{
          const combined=current[m.source]|current[m.target];
          if(building)return combined===goal.color&&members.has(m.target)&&!members.has(m.source);
          return combined===7&&((members.has(m.source)&&current[m.source]===goal.color)||
            (members.has(m.target)&&current[m.target]===goal.color));
        });
        // Peripheral members first tends to retain clearing contacts. Every
        // legal order remains available to this bounded local plan search.
        if(!building)candidates.sort((a,c)=>{
          const degree=m=>adjacency[current[m.source]===goal.color?m.source:m.target]
            .filter(i=>members.has(i)&&current[i]).length;
          return degree(a)-degree(c);
        });
        for(const move of candidates) {
          const donor=building?move.source:current[move.source]===(7^goal.color)?move.source:move.target;
          const receiver=building?move.target:members.has(move.source)?move.source:move.target;
          const resource={tile:donor,receiver,role:building?'mix':'clear',step:path.length+1};
          yield* visit(move.next,[...path,{source:move.source,target:move.target}],[...resources,resource]);
          if(left<=0||budget.left<=0||count>=planVariants)return;
        }
      }
      yield* visit(b,[],[]);
    }

    // Compare complete small clearances across a bounded frontier before the
    // expensive layout planner. Every edge removes a whole color-balanced job;
    // intermediate bridge contacts and the resulting remainder are checked.
    function* sectionPlans(b, budget, width=8, seed=0) {
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
        if(seed){
          let hash=(2166136261^seed)>>>0;
          for(const color of current)hash=Math.imul(hash^color,16777619)>>>0;
          hash=Math.imul(hash^(hash>>>16),2246822507)>>>0;
          hash=Math.imul(hash^(hash>>>13),3266489909)>>>0;
          hash=(hash^(hash>>>16))>>>0;
          variation=(hash/4294967296-0.5)*100;
        }
        return score-components.length*20+variation;
      };
      let frontier=[{board:b,plans:[],score:rank(b)}];
      const visited=new Set([keyOf(b)]);
      while(frontier.length&&budget.left>0){
        yield {...checkpoint('planning'),sectionWidth:width,sectionSeed:seed,
          message:`Comparing section clearances${seed?` with ranking ${seed}`:''}: ${frontier.length} candidate continuations.`};
        const candidates=new Map();
        for(const node of frontier){
          const current=node.board,bs=blobs(current,adjacency);
          // Immediate clearances can miss a bridge that must be built before
          // clearing. Verify a bounded endgame before discarding this section.
          // Unknown leaves section planning active; failure rejects this node.
          if(sectionEndgameStates&&current.filter(Boolean).length<=sectionEndgameTiles){
            const proof=exact(current,{left:sectionEndgameStates});
            let step;
            try {
              while(!(step=proof.next()).done)yield {...step.value,phase:'section-endgame'};
            } finally { proof.return(); }
            if(step.value===null)continue;
            if(step.value!==undefined)return [...node.plans,
              {moves:step.value,goal:null,resources:[],sectionEndgame:true}];
          }
          const owner=new Map(bs.flatMap(blob=>blob.map(i=>[i,blob])));
          const linked=(a,c)=>a.some(i=>adjacency[i].some(j=>c.includes(j)));
          const offer=(next,path,color,receiver,resources)=>{
            const key=keyOf(next);if(visited.has(key)||candidates.has(key))return;
            const score=rank(next);
            candidates.set(key,{board:next,score,plans:[...node.plans,
              {next,moves:path,goal:{color,cells:[receiver],anchors:current[receiver]===color?[receiver]:[]},resources}]});
          };
          for(const group of bs){
            const color=current[group[0]];
            if(!primary(color)){
              for(const supply of bs)if(current[supply[0]]===(7^color)&&linked(group,supply))
                for(const receiver of group)for(const donor of supply){
                  if(budget.left--<=0)return null;
                  positions++;if((positions&15)===1)yield checkpoint('planning');
                  const next=current.slice();next[receiver]=next[donor]=0;
                  offer(next,[color<(7^color)?{source:receiver,target:donor}:{source:donor,target:receiver}],color,receiver,[{tile:donor,receiver,role:'clear',step:1}]);
                }
              continue;
            }
            for(const other of bs)if(primary(current[other[0]])&&current[other[0]]!==color&&linked(group,other)){
              const secondary=color|current[other[0]],complement=7^secondary;
              for(const receiver of group)for(const donor of other){
                if(budget.left--<=0)return null;
                positions++;if((positions&15)===1)yield checkpoint('planning');
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
          positions++;if((positions&15)===1)yield checkpoint('planning');
          visited.add(keyOf(node.board));
          if(assessment(node.board).reason)continue;
          if(node.board.every(c=>!c))return node.plans;
          frontier.push(node);if(frontier.length>=width)break;
        }
      }
      return null;
    }

    function* strategic(b,budget,tried,prefix=[]) {
      if(b.every(c=>!c))return [];
      if(budget.left<=0)return null;
      const key=keyOf(b),triedKey=strategyOnly&&batchGroups?`${key}:${Math.min(prefix.length,batchGroups)}`:key;
      if(tried.has(triedKey)||assessment(b).reason)return null;
      if(strategyOnly&&batchGroups&&prefix.length>=batchGroups){
        yield {...checkpoint('batch-check'),groupsCleared:prefix.length,remaining:b.filter(Boolean).length};
        // Necessary conditions only: a passed batch is promising, not a
        // guaranteed full solution. No exact move search is used here.
        const conflict=yield* bridgeFeasibility(b,{left:bridgeStates});
        if(conflict)return null;
        if((yield* smallPositionProof(b))===false)return null;
        return [];
      }
      if(prefix.length&&!frontiers.some(f=>f.key===key)){
        frontiers.push({key,board:b,prefix,size:b.filter(Boolean).length});
        frontiers.sort((a,c)=>a.size-c.size);frontiers=frontiers.slice(0,8);
      }
      // Finish independent components separately; their resources cannot mix.
      const components=parts(b),active=isolated(b,components[0]);
      for(const goal of goals(active,budget)) {
        if(goal.type==='search'){yield goal;continue;}
        plansTried++;
        for(const plan of localPlans(active,goal,budget)) {
          if(plan.type==='search'){yield plan;continue;}
          const next=b.slice();for(const i of components[0])next[i]=plan.next[i];
          const rest=yield* strategic(next,budget,tried,[...prefix,plan]);
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
    function* exact(b,budget=null) {
      if(b.every(c=>!c))return [];
      const key=keyOf(b);if(dead.has(key))return null;
      if(winning.has(key))return winning.get(key);
      if(budget&&budget.left--<=0)return undefined; // Unknown, never a dead state.
      // Yield even if every successor fails its structural check. A large
      // run of rejected candidates must not starve Stop or the deadline.
      positions++;if((positions&15)===1)yield checkpoint('verification');
      if(assessment(b).reason){dead.add(key);return null;}
      const components=parts(b);
      if(components.length>1) {
        const path=[];
        for(const component of components){
          const found=yield* exact(isolated(b,component),budget);
          if(found===undefined)return undefined;
          if(found===null){dead.add(key);return null;}path.push(...found);
        }
        winning.set(key,path);return path;
      }
      const {reservations}=assessment(b);
      for(const move of legal(b)) {
        if(primary(b[move.source])&&reservations.has(move.source))continue;
        const required=reservations.get(move.target);
        if(required&&primary(b[move.target])&&move.next[move.target]!==required.secondary)continue;
        const rest=yield* exact(move.next,budget);
        if(rest===undefined)return undefined;
        if(rest!==null){const path=[{source:move.source,target:move.target},...rest];winning.set(key,path);return path;}
      }
      dead.add(key);return null;
    }

    // Bounded small-position validation, never an unrestricted fallback.
    // A failed proof rejects a proposed batch; unknown never means impossible.
    // A successful path is evidence only: playback still uses strategic jobs.
    function* smallPositionProof(b) {
      if(!proofStates||b.filter(Boolean).length>proofTiles)return undefined;
      const proof=exact(b,{left:proofStates});
      try {
        let step;
        while(!(step=proof.next()).done)yield {...step.value,phase:'endgame-check'};
        const result=step.value===null?'unsolvable':step.value===undefined?'unknown':'solvable';
        yield {...checkpoint('endgame-check'),proofResult:result,
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
      if(!structural&&!funding&&!smallFailure) {
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
          plans=yield* sectionPlans(root,{left:nextSectionStates},1);
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
        if(plans===null)plans=yield* strategic(root,planningBudget,new Set());
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
          if(plans===null)plans=yield* strategic(root,{left:nextStrategyStates},new Set());
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
          // Failure rejects that exact assignment, not the original board.
          for(const frontier of [...frontiers,{board:root,prefix:[]}]){
            const path=yield* exact(frontier.board);
            if(path!==null){plans=[...frontier.prefix,{moves:path,goal:null,resources:[]}];break;}
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
          const description=goal?`Clear ${names[goal.color]} group`:'Complete verified continuation';
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
  return {solve,assess};
}
const SplashSearch = createSplashSearch();
if (typeof module !== 'undefined') module.exports = SplashSearch;
