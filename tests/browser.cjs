const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const counter=require('./fixtures.json').board.map(i=>['white','red','blue','purple','yellow','orange','green'][i]);
const fixture=require('./fixtures.json').backtrack;
(async()=>{
 const browser=await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {})});
 const errors=[];
 async function setup(){const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);await page.clock.install();await page.clock.pauseAt(new Date());return page;}
 // Fixtures that replace tiles directly also establish their original board.
 async function startFixture(page){await page.evaluate(()=>{state.initialTiles=[...state.tiles];});await page.getByRole('button',{name:'Auto Play',exact:true}).click();await page.getByRole('button',{name:'Start Auto Play',exact:true}).click();}
 async function stopIfRunning(page){if(await page.evaluate(()=>autoPlayState.active))await page.getByRole('button',{name:'Stop',exact:true}).click();}
 let page=await setup();
 await page.evaluate(counter=>{
  window.fresh=0;window.trace=[];window.realAnimate=animateAutoPlayMove;
  animateAutoPlayMove=async plan=>{if(plan.sourceIndex>=0 && !isLinkedBlobMove(plan.sourceIndex,plan.targetIndex,state.tiles))throw Error('Illegal forward animation');trace.push(plan);return true;};
  createShuffledBoard=()=>{fresh++;return [...counter];};
  state.tiles=Array(60).fill('white');state.tiles[0]='red';state.tiles[1]='blue';state.tiles[8]='yellow';render();
 },counter);
 await startFixture(page);
 await page.clock.runFor(600);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Solution found!');
 assert.equal(await page.locator('#auto-play-solved').textContent(),'1');
 assert.equal(await page.locator('#analysis-btn').isDisabled(),true);
 await page.clock.runFor(1800);assert.equal(await page.evaluate(()=>fresh),0);
 // Allow the cooperative validation checkpoints to settle before cycling.
 await page.clock.runFor(200);assert.equal(await page.evaluate(()=>fresh),1);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'1');
 await page.clock.runFor(9999);assert.equal(await page.evaluate(()=>fresh),1);
 await stopIfRunning(page);await page.clock.runFor(100);
 assert.equal(await page.evaluate(()=>autoPlayState.active),false);
 await page.clock.runFor(15000);assert.equal(await page.evaluate(()=>fresh),1);
 // Starting again resumes the same session and retains completed boards.
 await page.evaluate(()=>{state.tiles=Array(60).fill('white');state.tiles[0]='red';state.tiles[1]='blue';state.tiles[8]='yellow';render();});
 await startFixture(page);
 assert.equal(await page.locator('#auto-play-solved').textContent(),'1');assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'1');
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed solution/proof messages, 2-second wait, board cycling, Stop, and session resume.');
 // A doomed current position must rewind history and solve the original deal.
 page=await setup();
 await page.evaluate(fixture=>{
  const names=['white','red','blue','purple','yellow','orange','green'];
  const original=fixture.good.map(c=>names[c]),bad=fixture.after.map(c=>names[c]);
  state.initialTiles=original;state.history=[{tiles:original},{tiles:bad}];
  state.tiles=applyMove(16,26,{tiles:bad}).tiles;
  window.recoveryTrace=[];const animate=animateSearchEvent;
  animateSearchEvent=async event=>{recoveryTrace.push(event.type);return animate(event);};
  animateAutoPlayMove=async()=>true;render();
 },require('./bottleneck.cjs'));
 await page.getByRole('button',{name:'Auto Play',exact:true}).click();await page.getByRole('button',{name:'Start Auto Play',exact:true}).click();
 for(let i=0;i<100;i++){await page.clock.runFor(100);if(await page.locator('#auto-play-status').textContent()==='Solution found!')break;}
 assert.equal(await page.locator('#auto-play-status').textContent(),'Solution found!');
 assert.deepEqual(await page.evaluate(()=>recoveryTrace.slice(0,2)),['backtrack','backtrack']);
 assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'0');
 assert.equal(await page.locator('#auto-play-solved').textContent(),'1');
 assert.equal(await page.evaluate(()=>undoCount),2);
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed two historical undos followed by an alternate solution, without a false unsolvable count.');
 // The two-red gate shortage must stop before any animation or search wait.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];state.initialTiles=[...board];window.gateAnimations=0;
  animateAutoPlayMove=async()=>{gateAnimations++;return true;};render();
 },require('./single-gate.cjs').board);
 await page.getByRole('button',{name:'Auto Play',exact:true}).click();await page.getByRole('button',{name:'Start Auto Play',exact:true}).click();
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>gateAnimations),0);
 assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'1');
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./single-gate.cjs').board);
 await page.close();
 console.log('Passed immediate two-red gate rejection without animation.');
 // Game-only runs: actual solved/unsolvable boards and deadline accounting.
 page=await setup();
 await page.evaluate(()=>{window.originalSolve=SplashSearch.solve;animateAutoPlayMove=async()=>true;});
 for(let round=1;round<=2;round++) {
  assert.equal(await page.evaluate(()=>appState.playVariant),'standard');
  await page.evaluate(()=>{SplashSearch.solve=originalSolve;state.tiles=Array(60).fill('white');state.tiles[0]='red';state.tiles[1]='blue';state.tiles[8]='yellow';render();});
  await startFixture(page);await page.clock.runFor(600);
  assert.equal(await page.locator('#auto-play-solved').textContent(),String(round));
  await stopIfRunning(page);await page.clock.runFor(100);
  await page.evaluate(board=>{state.tiles=[...board];render();},counter);
  await startFixture(page);await page.clock.runFor(100);
  assert.equal(await page.locator('#auto-play-unsolvable').textContent(),String(round));
  await page.evaluate(()=>{SplashSearch.solve=function*(){while(true)yield {type:'search'};};});
  await startFixture(page);await page.clock.fastForward(300001);await page.clock.runFor(100);
  assert.equal(await page.locator('#auto-play-unknown').textContent(),String(round));
  await stopIfRunning(page);await page.clock.runFor(100);
 }
 await page.close();
 console.log('Passed Game-only accumulation for real solutions, proofs, and deadlines.');
 // All outcome totals accumulate across runs, New Board, and mode changes.
 page=await setup();
 for (const outcome of ['solved','unsolvable','unknown','solved','unsolvable','unknown']) {
  await page.evaluate(outcome=>{SplashSearch.solve=function*(){return outcome;};},outcome);
  await startFixture(page);
  await stopIfRunning(page);await page.clock.runFor(100);
  await page.getByRole('button',{name:'New Board',exact:true}).click();
  await page.getByRole('button',{name:'Analysis',exact:true}).click();
  await page.getByRole('button',{name:'Play the game',exact:true}).click();
 }
 for (const outcome of ['solved','unsolvable','unknown'])
  assert.equal(await page.locator('#auto-play-'+outcome).textContent(),'2');
 await page.reload();
 assert.equal(await page.evaluate(()=>autoPlayState.session),null);
 for (const outcome of ['solved','unsolvable','unknown'])
  assert.equal(await page.locator('#auto-play-'+outcome).textContent(),'0');
 await page.close();
 console.log('Passed cumulative outcome counts and reload reset.');
 // Unsuccessful outcomes restore the original deal, not the search start.
 for(const outcome of ['unsolvable']) {
  page=await setup();
  await page.evaluate(outcome=>{
   window.original=[...state.initialTiles];window.fresh=0;
   state.tiles=applyMove(0,1,{tiles:Array.from({length:60},(_,i)=>i===0?'red':i===1?'blue':'white')}).tiles;
   window.searchStart=[...state.tiles];
   state.history=[{tiles:[...original]}];undoCount=7;
   createShuffledBoard=()=>{fresh++;return [...original];};
   SplashSearch.solve=function*(){yield {type:'search'};return outcome;};render();
  },outcome);
  await page.getByRole('button',{name:'Auto Play',exact:true}).click();await page.getByRole('button',{name:'Start Auto Play',exact:true}).click();await page.clock.runFor(100);
  assert.equal(await page.locator('#auto-play-status').textContent(),outcome==='unknown'?'Timed out':'Board is unsolvable!');
  assert.equal(await page.evaluate(()=>autoPlayState.active),false);
  assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>original));
  assert.notDeepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>searchStart));
  assert.equal(await page.evaluate(()=>state.history.length),0);assert.equal(await page.evaluate(()=>undoCount),0);
  assert.equal(await page.locator('#analysis-btn').isEnabled(),true);
  assert.equal(await page.getByRole('button',{name:'Auto Play',exact:true}).isEnabled(),true);
  const stopped=await page.locator('#auto-play-elapsed').textContent();
  await page.clock.runFor(30000);assert.equal(await page.evaluate(()=>fresh),0);
  assert.equal(await page.locator('#auto-play-elapsed').textContent(),stopped);
  assert.match(await page.locator('#auto-play-session').textContent(),/Timed out:/);
  assert.equal(await page.locator('#auto-play-'+outcome).textContent(),'1');
  // Restart and mode changes retain the session counters.
  await page.evaluate(()=>{window.savedSession=autoPlayState.session;SplashSearch.solve=function*(){while(true)yield {type:'search'};};});
  await page.getByRole('button',{name:'Auto Play',exact:true}).click();await page.getByRole('button',{name:'Start Auto Play',exact:true}).click();await page.clock.runFor(20);
  assert.equal(await page.evaluate(()=>autoPlayState.session===savedSession),true);
  await stopIfRunning(page);await page.clock.runFor(100);
  await page.getByRole('button',{name:'Analysis',exact:true}).click();
  await page.getByRole('button',{name:'Play the game',exact:true}).click();
  assert.equal(await page.evaluate(()=>autoPlayState.session===savedSession),true);
  assert.equal(await page.locator('#auto-play-'+outcome).textContent(),'1');
  await page.close();
 }
 console.log('Passed unsuccessful outcome restoration, automatic halt, enabled controls, frozen timer, and session continuity.');
 // The original counterexample remains trapped after an unrelated outside
 // mix. It must be classified before ANY animation, even on a mixed board.
 page=await setup();
 await page.evaluate(counter=>{
  state.tiles=[...counter];state.tiles[19]='white';state.tiles[26]='orange';
  window.trappedSnapshot=[...state.tiles];window.animations=0;
  animateAutoPlayMove=async()=>{animations++;throw Error('A trapped board was animated');};
  render();
 },counter);
 await startFixture(page);
 await page.clock.runFor(50);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'1');
 assert.equal(await page.evaluate(()=>animations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>trappedSnapshot));
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed mixed-board corner trap: immediate proof, no animation.');
 // The pictured bridge conflict is proved before any animation. The
 // solvable version still clears, with every forward successor assessed.
 const bottleneck=require('./bottleneck.cjs');
 for(const board of [bottleneck.bad,bottleneck.good]) {
  page=await setup();
  await page.evaluate(board=>{
   state.tiles=board.map(i=>['white','red','blue','purple','yellow','orange','green'][i]);
   window.snapshot=[...state.tiles];window.animations=0;
   animateAutoPlayMove=async plan=>{
    if(plan.sourceIndex>=0) {
     if(!isLinkedBlobMove(plan.sourceIndex,plan.targetIndex,state.tiles))throw Error('Illegal bottleneck move');
     const after=applyMove(plan.sourceIndex,plan.targetIndex,state).tiles;
     if(SplashSearch.assess(after,tilesMeta.map(t=>getNeighbors(t.index))).unsolvable)throw Error('Bottleneck successor animated');
    }
    animations++;return true;
   };render();
  },board);
  await startFixture(page);
  for(let i=0;i<300;i++) {
   await page.clock.runFor(50);
   if(['Solution found!','Board is unsolvable!'].includes(await page.locator('#auto-play-status').textContent()))break;
  }
  if(board===bottleneck.bad) {
   assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
   assert.equal(await page.evaluate(()=>animations),0);
   assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>snapshot));
  }else {
   assert.equal(await page.locator('#auto-play-status').textContent(),'Solution found!');
   assert.equal(await page.evaluate(()=>state.tiles.every(c=>c==='white')),true);
  }
  await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 }
 console.log('Passed pictured bottleneck rejection without animation and solvable-board successor checks.');
 // Local file mode exposes autoplay on custom Analysis boards too.
 page=await setup();
 await page.getByRole('button',{name:'Analysis',exact:true}).click();
 assert.equal(await page.locator('#auto-play-btn').isVisible(),true);
 assert.equal(await page.locator('#auto-play-btn').isEnabled(),true);
 await page.evaluate(()=>{
  state.tiles=Array(60).fill('white');state.tiles[0]='red';state.tiles[1]='blue';state.tiles[8]='yellow';
  animateAutoPlayMove=async()=>true;render();
 });
 await startFixture(page);
 assert.equal(await page.locator('#auto-play-session').isVisible(),true);
 assert.equal(await page.locator('#analysis-btn').isDisabled(),true);
 await page.clock.runFor(1000);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Solution found!');
 assert.equal(await page.evaluate(()=>state.tiles.every(c=>c==='white')),true);
 await stopIfRunning(page);await page.clock.runFor(100);
 assert.equal(await page.locator('#analysis-btn').isEnabled(),true);
 assert.equal(await page.locator('#auto-play-btn').isEnabled(),true);
 await page.close();
 console.log('Passed local Analysis autoplay visibility, solving, Stop, and controls.');
 // The resource-shortage picture is rejected without touching the board.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.snapshot=[...board];window.animations=0;
  animateAutoPlayMove=async()=>{animations++;throw Error('Supply shortage animated');};render();
 },["white","white","white","white","white","white","blue","white","white","white","white","white","white","red","red","white","white","white","white","white","white","blue","white","white","white","white","white","white","red","white","white","yellow","white","white","white","white","purple","yellow","blue","yellow","white","white","white","white","blue","white","yellow","yellow","white","red","yellow","red","yellow","white","white","blue","red","white","blue","white"]);
 await startFixture(page);await page.clock.runFor(50);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>animations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>snapshot));
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed component-shortage rejection without animation.');
 // This picture needs deeper search; no speculative move may be animated.
 page=await setup();
 await page.evaluate(()=>{
  state.tiles=['........','.......','........','..R....','R..B....','Y..PY..','.OBORBB.','...GY..']
   .join('').split('').map(c=>({'.':'white',R:'red',B:'blue',Y:'yellow',P:'purple',O:'orange',G:'green'}[c]));
  window.snapshot=[...state.tiles];window.animations=0;
  animateAutoPlayMove=async()=>{animations++;throw Error('Unproved move animated');};render();
 });
 await startFixture(page);
 for(let i=0;i<100 && await page.locator('#auto-play-status').textContent()!=='Board is unsolvable!';i++)await page.clock.runFor(50);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>animations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>snapshot));
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed bounded rejection of pictured mixed board with unchanged display.');

 // The two pictured blues must fail the structural check immediately.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.snapshot=[...board];window.animations=0;
  animateAutoPlayMove=async()=>{animations++;throw Error('First-mix conflict was animated');};
  render();
 },require('./blue-conflict.json').board);
 await startFixture(page);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>animations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>snapshot));
 assert.equal(await page.evaluate(()=>state.history.length),0);
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed immediate first-mix shortage rejection with unchanged board and history.');

 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.snapshot=[...board];window.animations=0;
  animateAutoPlayMove=async()=>{animations++;throw Error('Orange shortage animated');};render();
 },require('./orange-conflict.json').board);
 await startFixture(page);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>animations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>snapshot));
 assert.equal(await page.evaluate(()=>state.history.length),0);
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed immediate orange-pair shortage rejection without animation.');

 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.snapshot=[...board];window.animations=0;
  animateAutoPlayMove=async()=>{animations++;throw Error('Impossible bridge animated');};render();
  const reason=SplashSearch.assess(state.tiles,tilesMeta.map(tile=>getNeighbors(tile.index))).reason;
  if(reason.type!=='forced-clear-disconnection'||reason.secondary!==14||reason.primary!==21)throw Error('Expected green/red forced clearing');
 },require('./disconnected-colors.json').board);
 await startFixture(page);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>animations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>snapshot));
 assert.equal(await page.evaluate(()=>state.history.length),0);
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed immediate required-bridge donor shortage rejection.');

 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.snapshot=[...board];window.animations=0;
  animateAutoPlayMove=async()=>{animations++;throw Error('Impossible yellow-link move animated');};render();
  if(SplashSearch.assess(board,tilesMeta.map(tile=>getNeighbors(tile.index))).reason.type!=='sealed-region-ordering')throw Error('Expected local ordering failure');
 },require('./yellow-link.json').board);
 await startFixture(page);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>animations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>snapshot));
 assert.equal(await page.evaluate(()=>state.history.length),0);
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed immediate yellow-link ordering rejection without animation.');
 // Both new screenshots reject synchronously, without animation or history.
 const pocket=require('./pocket-conflict.cjs');
 for(const board of [pocket.board,pocket.earlier]) {
  page=await setup();
  await page.evaluate(board=>{
   state.tiles=[...board];window.snapshot=[...board];window.animations=0;
   animateAutoPlayMove=async()=>{animations++;throw Error('Impossible pocket animated');};render();
   if(SplashSearch.assess(board,tilesMeta.map(tile=>getNeighbors(tile.index))).reason.type!=='pocket-supply-conflict')throw Error('Expected pocket supply conflict');
  },board);
  await startFixture(page);
  assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
  assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'1');
  assert.equal(await page.evaluate(()=>animations),0);
  assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>snapshot));
  assert.equal(await page.evaluate(()=>state.history.length),0);
  await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 }
 console.log('Passed immediate pocket rejection for both screenshots without animation.');
 page=await setup();
 await page.evaluate(pocket=>{
  state.tiles=[...pocket.before];render();
  if(!isLinkedBlobMove(pocket.source,pocket.target,state.tiles))throw Error('Expected legal trap-creating move');
  if(JSON.stringify(applyMove(pocket.source,pocket.target,state).tiles)!==JSON.stringify(pocket.board))throw Error('Wrong trap successor');
  const originalSolve=SplashSearch.solve;
  SplashSearch.solve=(tiles,adj)=>originalSolve(tiles,adj,{lookaheadStates:0});
  animateAutoPlayMove=async plan=>{
   if(plan.sourceIndex>=0) {
    if(!isLinkedBlobMove(plan.sourceIndex,plan.targetIndex,state.tiles))throw Error('Illegal pocket predecessor move');
    const after=applyMove(plan.sourceIndex,plan.targetIndex,state).tiles;
    if(JSON.stringify(after)===JSON.stringify(pocket.board))throw Error('Trap-creating move was animated');
    if(SplashSearch.assess(after,tilesMeta.map(t=>getNeighbors(t.index))).unsolvable)throw Error('Rejected successor animated');
   }
   return true;
  };
 },pocket);
 await startFixture(page);
 for(let i=0;i<400;i++) {
  await page.clock.runFor(250);
  if(await page.evaluate(()=>autoPlayState.phase==='result'||!autoPlayState.active))break;
 }
 assert.equal(await page.locator('#auto-play-status').textContent(),'Solution found!');
 assert.equal(await page.evaluate(()=>state.tiles.every(c=>c==='white')),true);
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed solvable predecessor: legal trap-creating move never animated, with zero lookahead.');
 // The purple-bridge shortage must reject before unrelated moves elsewhere,
 // including when a small or zero lookahead budget cannot supply a proof.
 for(const lookaheadStates of [0,64,4000]) {
  page=await setup();
  await page.evaluate(({board,lookaheadStates})=>{
   state.tiles=[...board];window.snapshot=[...board];window.animations=0;
   const originalSolve=SplashSearch.solve;
   SplashSearch.solve=(tiles,adj)=>originalSolve(tiles,adj,{lookaheadStates});
   animateAutoPlayMove=async()=>{animations++;throw Error('Unrelated move after purple bridge conflict');};
   render();
  },{board:require('./purple-distance.cjs').board,lookaheadStates});
  await startFixture(page);
  assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
  assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'1');
  assert.equal(await page.evaluate(()=>animations),0);
  assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>snapshot));
  assert.equal(await page.evaluate(()=>state.history.length),0);
  await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 }
 console.log('Passed purple bridge rejection before any unrelated animation at zero, small, and default budgets.');
 // Prove the forced purple-bridge successor impossible before animation.
 page=await setup();
 await page.evaluate(fixture=>{
  // Keep the former threshold here to exercise visible forced-move fallback.
  const solve=SplashSearch.solve;
  SplashSearch.solve=(tiles,adj)=>solve(tiles,adj,{endgameTiles:20});
  state.tiles=[...fixture.board];window.forcedMoves=[];
  animateAutoPlayMove=async plan=>{
   if(plan.sourceIndex>=0) {
    if(!isLinkedBlobMove(plan.sourceIndex,plan.targetIndex,state.tiles))throw Error('Illegal forced move');
    forcedMoves.push([plan.sourceIndex,plan.targetIndex]);
   }
   return true;
  };render();
 },require('./forced-mix.cjs'));
 await startFixture(page);
 for(let i=0;i<400;i++) {
  await page.clock.runFor(50);
  if(await page.evaluate(()=>autoPlayState.phase==='result'||!autoPlayState.active))break;
 }
 assert.deepEqual(await page.evaluate(()=>forcedMoves),[]);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>state.history.length),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./forced-mix.cjs').board);
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed forced purple-bridge successor rejection before animation.');
 // A single orange anchor must receive the same bridge proof as larger blobs.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.singleAnchorAnimations=0;
  animateAutoPlayMove=async()=>{singleAnchorAnimations++;return true;};render();
 },require('./single-anchor.cjs').board);
 await startFixture(page);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>singleAnchorAnimations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./single-anchor.cjs').board);
 await page.close();
 console.log('Passed immediate single-anchor rejection in Auto Play.');
 // Playback completes a funded purple job without abandoning its objective.
 page=await setup();
 await page.evaluate(()=>{
  state.tiles=Array(60).fill('white');
  state.tiles[9]='purple';state.tiles[10]='purple';state.tiles[16]='purple';
  state.tiles[8]='yellow';state.tiles[23]='yellow';state.tiles[31]='yellow';
  window.strategicEvents=[];const animate=animateSearchEvent;
  animateSearchEvent=async e=>{strategicEvents.push(e);return animate(e);};
  animateAutoPlayMove=async()=>true;render();
 });
 await startFixture(page);
 for(let i=0;i<200;i++){
  await page.clock.runFor(50);
  if(await page.evaluate(()=>strategicEvents.length))break;
 }
 assert.match(await page.locator('#auto-play-status').textContent(),/^Clear purple group — step 1 of 3$/);
 await stopIfRunning(page);await page.clock.runFor(50);
 assert.equal(await page.evaluate(()=>strategicEvents.length),1);
 await page.getByRole('button',{name:'Auto Play',exact:true}).click();await page.getByRole('button',{name:'Start Auto Play',exact:true}).click();
 for(let i=0;i<100;i++){
  await page.clock.runFor(50);
  if(await page.locator('#auto-play-status').textContent()==='Solution found!')break;
 }
 const plannedEvents=await page.evaluate(()=>strategicEvents);
 assert.equal(plannedEvents.length,3);assert(plannedEvents.every(e=>e.type==='forward'&&e.plan.verified));
 assert.deepEqual(plannedEvents.map(e=>e.plan.id),[1,1,1]);
 assert.deepEqual(plannedEvents.map(e=>e.plan.step),[1,2,3]);
 assert.notDeepEqual([plannedEvents[0].sourceIndex,plannedEvents[0].targetIndex].sort((a,b)=>a-b),[8,16]);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Solution found!');
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed persistent purple objective, bridge preservation, and complete plan playback.');
 // Deadline test: controlled endless exploration, with genuine forward/undo states.
 page=await setup();
 await page.evaluate(()=>{
  window.fresh=0;createShuffledBoard=()=>{fresh++;return [...state.initialTiles];};
  animateAutoPlayMove=async()=>true;
  SplashSearch.solve=function*(tiles){const sourceIndex=tiles.findIndex((_,i)=>tiles.some((_,j)=>isLinkedBlobMove(i,j,tiles)));const targetIndex=tiles.findIndex((_,j)=>isLinkedBlobMove(sourceIndex,j,tiles));const after=applyMove(sourceIndex,targetIndex,{tiles}).tiles;while(true){yield {type:'forward',sourceIndex,targetIndex,before:tiles,after};yield {type:'backtrack',sourceIndex,targetIndex,before:tiles,after};}};
 });
 await startFixture(page);
 await page.clock.fastForward(60001);await page.clock.runFor(100);
 assert.equal(await page.evaluate(()=>autoPlayState.phase),'search');
 assert.equal(await page.locator('#auto-play-unknown').textContent(),'0');
 await page.clock.fastForward(239900);await page.clock.runFor(100);
 assert.match(await page.locator('#auto-play-status').textContent(),/^Timed out/);
 assert.equal(await page.locator('#auto-play-unknown').textContent(),'1');assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'0');
 assert.equal(await page.evaluate(()=>fresh),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>state.initialTiles));
 assert.equal(await page.evaluate(()=>state.history.length),0);
 assert.deepEqual(await page.evaluate(()=>savedTimedOutBoards[0].tiles),await page.evaluate(()=>state.initialTiles));
 await page.clock.runFor(4800);assert.equal(await page.evaluate(()=>fresh),1);
 assert.equal(await page.evaluate(()=>autoPlayState.active),true);
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed five-minute cutoff, original-board saving, and automatic continuation.');
 // Real endgame proof: no animation, stable tiles/history, and responsive Stop.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.originalEndgame=[...board];window.endgameAnimations=0;
  const legacySolve=SplashSearch.solve;
  SplashSearch.solve=(tiles,adj,options)=>legacySolve(tiles,adj,{...options,stopBeforeExhaustive:false,strategyOnly:false,progressive:true});
  animateAutoPlayMove=async()=>{endgameAnimations++;throw Error('Impossible endgame animated');};render();
 },require('./endgame-trap.cjs').board);
 await startFixture(page);
 await page.clock.runFor(20);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./endgame-trap.cjs').board);
 assert.equal(await page.evaluate(()=>state.history.length),0);
 await stopIfRunning(page);await page.clock.runFor(20);
 assert.equal(await page.evaluate(()=>autoPlayState.active),false);
 await startFixture(page);
 await page.clock.fastForward(300001);await page.clock.runFor(100);
 assert.match(await page.locator('#auto-play-status').textContent(),/^Timed out/);
 await stopIfRunning(page);await page.clock.runFor(100);
 await startFixture(page);
 for(let i=0;i<1000;i++) {await page.clock.runFor(100);if(await page.evaluate(()=>autoPlayState.phase==='result'||!autoPlayState.active))break;}
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>endgameAnimations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./endgame-trap.cjs').board);
 assert.equal(await page.evaluate(()=>state.history.length),0);
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed real endgame rejection, unchanged board/history, Stop, and deadline.');
 // The green/purple gateway conflict is proved by shared resource planning.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.gatewayAnimations=0;window.gatewayPhases=[];
  const solve=SplashSearch.solve;
  SplashSearch.solve=function*(...args){const g=solve(...args);try{let s;while(!(s=g.next()).done){gatewayPhases.push(s.value.phase);yield s.value;}return s.value;}finally{g.return();}};
  animateAutoPlayMove=async()=>{gatewayAnimations++;return true;};render();
 },require('./gateway-strategy.cjs').board);
 await startFixture(page);
 for(let i=0;i<200;i++){await page.clock.runFor(50);if(await page.evaluate(()=>!autoPlayState.active))break;}
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>gatewayAnimations),0);
 assert.equal(await page.evaluate(()=>gatewayPhases.length>0&&gatewayPhases.every(p=>p==='funding')),true);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./gateway-strategy.cjs').board);
 await page.close();
 console.log('Passed gateway resource proof without exhaustive board search or animation.');
 // The actual large-board planner must remain silent and cancellable.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.planningMoves=0;
  animateAutoPlayMove=async()=>{planningMoves++;return true;};render();
 },require('./purple-strategy.cjs').board);
 await startFixture(page);await page.clock.runFor(20);
 assert.equal(await page.evaluate(()=>planningMoves),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./purple-strategy.cjs').board);
 assert.equal(await page.evaluate(()=>state.history.length),0);
 assert.match(await page.locator('#auto-play-status').textContent(),/^(Planning|Checking)/);
 await stopIfRunning(page);await page.clock.runFor(50);
 assert.equal(await page.evaluate(()=>autoPlayState.active),false);
 await startFixture(page);await page.clock.fastForward(300001);await page.clock.runFor(100);
 assert.match(await page.locator('#auto-play-status').textContent(),/^Timed out/);
 assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'0');
 assert.equal(await page.evaluate(()=>planningMoves),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./purple-strategy.cjs').board);
 await page.close();
 console.log('Passed real strategic planning, unchanged display, Stop, and timeout without speculative moves.');

 // Planning text remains readable without slowing the search itself.
 page=await setup();
 await page.evaluate(()=>{
  SplashSearch.solve=function*(){let i=0;while(true)yield {type:'search',phase:'planning',objective:{color:i++%2?'red':'blue'},positions:i};};
 });
 await startFixture(page);await page.clock.runFor(50);
 const readable=await page.locator('#auto-play-status').textContent();
 await page.clock.runFor(1000);assert.equal(await page.locator('#auto-play-status').textContent(),readable);
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed readable planning status with uninterrupted cooperative search.');

 // Partial batches animate, then hand the reduced board back to planning.
 page=await setup();
 await page.evaluate(()=>{
  window.batchTrace=[];window.prefetches=[];window.plannedAhead=false;
  const prefetch=createAutoPlayPrefetch;
  createAutoPlayPrefetch=(...args)=>{
   const p=prefetch(...args);if(p){prefetches.push(p);const next=p.next.bind(p);
    p.next=async()=>{const s=await next();if(!s.done)batchTrace.push({type:s.value.type,phase:s.value.phase,groups:s.value.groupsCleared,complete:s.value.complete});return s;};
   }return p;
  };
  const solve=SplashSearch.solve;
  SplashSearch.solve=function*(...args){const g=solve(...args);try{let s;while(!(s=g.next()).done){batchTrace.push({type:s.value.type,phase:s.value.phase,groups:s.value.groupsCleared,complete:s.value.complete});yield s.value;}return s.value;}finally{g.return();}};
  state.tiles=Array(60).fill('white');
  // Seven separated three-cell horizontal jobs in alternating rows.
  for(const [a,b,c] of [[0,1,2],[5,6,7],[15,16,17],[20,21,22],[30,31,32],[35,36,37],[45,46,47]]){
   state.tiles[a]='red';state.tiles[b]='blue';state.tiles[c]='yellow';
  }
  animateAutoPlayMove=async()=>{if(prefetches.some(p=>p.hasReadyBatch))plannedAhead=true;return true;};render();
 });
 await startFixture(page);
 for(let i=0;i<600;i++){await page.clock.runFor(50);if(await page.locator('#auto-play-status').textContent()==='Solution found!')break;}
 assert.equal(await page.locator('#auto-play-status').textContent(),'Solution found!');
 const batchTrace=await page.evaluate(()=>window.batchTrace);
 const partial=batchTrace.findIndex(e=>e.type==='batch-ready'&&!e.complete);
 assert(partial>=0);assert.equal(batchTrace[partial].groups,6);
 const forwards=batchTrace.slice(partial+1).filter(e=>e.type==='forward');assert(forwards.length>=12);
 const twelfth=batchTrace.map(e=>e.type).reduce((out,t,i)=>{if(t==='forward')out.push(i);return out;},[])[11];
 assert(batchTrace.slice(twelfth+1).some(e=>e.type==='batch-ready'));
 assert.equal(await page.evaluate(()=>plannedAhead),true,'Next batch must be ready during current playback');
 assert.equal(await page.evaluate(()=>prefetches.every(p=>p.closed)),true);
 assert(!batchTrace.some(e=>e.phase==='verification'||e.phase==='exploration'));
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed checked six-group animation batch and subsequent strategic planning.');

 // A worker plans from predicted tiles without changing the live board.
 page=await setup();
 await page.evaluate(()=>{
  window.liveBefore=[...state.tiles];autoPlayState.active=true;autoPlayState.phase='search';autoPlayState.deadline=Infinity;
  const predicted=Array(60).fill('white');predicted[0]='red';predicted[1]='blue';predicted[8]='yellow';
  window.future=createAutoPlayPrefetch(predicted,tilesMeta.map(t=>getNeighbors(t.index)),[]);
 });
 await page.waitForFunction(()=>future.hasReadyBatch);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>liveBefore));
 const futureEvents=await page.evaluate(async()=>{const out=[];let s;while(!(s=await future.next()).done)out.push(s.value);future.return();return out;});
 assert.equal(futureEvents.filter(e=>e.type==='forward').length,2);
 assert.equal(futureEvents.find(e=>e.type==='forward').before[0],'red');
 await page.evaluate(board=>{
  window.future=createAutoPlayPrefetch(board,tilesMeta.map(t=>getNeighbors(t.index)),[]);
  autoPlayState.stopRequested=true;
 },require('./purple-strategy.cjs').board);
 await page.clock.runFor(100);assert.equal(await page.evaluate(()=>future.closed),true);
 await page.evaluate(()=>{autoPlayState.active=false;autoPlayState.stopRequested=false;});
 await page.close();console.log('Passed worker planning on predicted tiles, unchanged live board, and pending-plan cancellation.');

 // Default Auto Play stays in strategic planning and remains stoppable.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.strategyAnimations=0;window.strategyPhases=[];window.strategyOptions=null;
  const solve=SplashSearch.solve;
  SplashSearch.solve=function*(tiles,adj,options){strategyOptions=options;const g=solve(tiles,adj,{...options,strategyStates:32,localStates:16,layoutLimit:4,planVariants:1});try{let s;while(!(s=g.next()).done){strategyPhases.push(s.value.phase);if(s.value.type==='exhaustive-required')throw Error('Diagnostic halt in strategic mode');yield s.value;}return s.value;}finally{g.return();}};
  animateAutoPlayMove=async()=>{strategyAnimations++;return true;};render();
 },require('./purple-strategy.cjs').board);
 await startFixture(page);await page.clock.runFor(100);
 assert.equal(await page.evaluate(()=>strategyOptions.strategyOnly),true);
 assert.equal(await page.evaluate(()=>strategyPhases.some(p=>p==='verification'||p==='exploration')),false);
 assert.equal(await page.evaluate(()=>autoPlayState.active),true);
 assert.equal(await page.evaluate(()=>strategyAnimations),0);
 assert.match(await page.locator('#auto-play-status').textContent(),/Planning|planning|Checking/);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./purple-strategy.cjs').board);
 await stopIfRunning(page);await page.clock.runFor(100);
 assert.equal(await page.evaluate(()=>autoPlayState.active),false);
 assert.equal(await page.evaluate(()=>autoPlayState.session.unknown),0);
 await page.close();console.log('Passed strategy-only planning, progressive widening, no exact fallback/halt, and Stop.');

 // A difficult board begins playing after bounded planning, remains stoppable,
 // and restores the original deal on timeout after speculative animation.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.progressiveMoves=0;
  const legacySolve=SplashSearch.solve;
  SplashSearch.solve=(tiles,adj,options)=>legacySolve(tiles,adj,{...options,stopBeforeExhaustive:false,strategyOnly:false,progressive:true});
  animateAutoPlayMove=async plan=>{
   if(plan.sourceIndex>=0){
    if(!isLinkedBlobMove(plan.sourceIndex,plan.targetIndex,state.tiles))throw Error('Illegal speculative move');
    progressiveMoves++;
   }
   return true;
  };render();
 },require('./purple-strategy.cjs').board);
 await startFixture(page);
 for(let i=0;i<200&&await page.evaluate(()=>progressiveMoves===0);i++)await page.clock.runFor(50);
 assert(await page.evaluate(()=>progressiveMoves>0),'Hard board must begin animation');
 assert(await page.evaluate(()=>state.history.length>0));
 await stopIfRunning(page);await page.clock.runFor(50);
 const stopped=await page.evaluate(()=>state.tiles);
 await page.clock.runFor(1000);assert.deepEqual(await page.evaluate(()=>state.tiles),stopped);
 await page.getByRole('button',{name:'Auto Play',exact:true}).click();await page.getByRole('button',{name:'Start Auto Play',exact:true}).click();await page.clock.fastForward(300001);await page.clock.runFor(100);
 assert.match(await page.locator('#auto-play-status').textContent(),/^Timed out/);
 assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'0');
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./purple-strategy.cjs').board);
 assert.equal(await page.evaluate(()=>state.history.length),0);
 await page.close();
 console.log('Passed bounded first animation, speculative Stop/resume, and timeout restoration.');

 // Both 18-tile remainders get bounded proofs before planning/playback.
 for(const proofBoard of [require('./small-board-proof.cjs').board,require('./small-board-proof.cjs').secondBoard]){
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.smallProofAnimations=0;window.smallProofResults=[];
  const solve=SplashSearch.solve;
  SplashSearch.solve=function*(...args){const g=solve(...args);try{let s;while(!(s=g.next()).done){if(s.value.proofResult)smallProofResults.push(s.value.proofResult);yield s.value;}return s.value;}finally{g.return();}};
  animateAutoPlayMove=async()=>{smallProofAnimations++;return true;};render();
 },proofBoard);
 await startFixture(page);
 for(let i=0;i<300&&await page.evaluate(()=>autoPlayState.active);i++)await page.clock.runFor(50);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>smallProofAnimations),0);
 assert(await page.evaluate(()=>smallProofResults.includes('unsolvable')));
 assert.deepEqual(await page.evaluate(()=>state.tiles),proofBoard);
 await page.close();
 }console.log('Passed both bounded small-board rejections without batch animation.');

 // Three top yellows have no executable bridge-building order.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.yellowGateEvents=0;window.yellowGateAnimations=0;
  const solve=SplashSearch.solve;
  SplashSearch.solve=function*(...args){const g=solve(...args);try{let s;while(!(s=g.next()).done){yellowGateEvents++;yield s.value;}return s.value;}finally{g.return();}};
  animateAutoPlayMove=async()=>{yellowGateAnimations++;return true;};render();
 },require('./top-yellows.cjs').board);
 await startFixture(page);await page.clock.runFor(100);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>yellowGateEvents),0);assert.equal(await page.evaluate(()=>yellowGateAnimations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./top-yellows.cjs').board);
 assert.equal(await page.evaluate(()=>state.history.length),0);
 await page.close();console.log('Passed immediate top-yellow gate-ordering proof with no planning or animation.');

 // The narrow red/blue connection cannot balance the upper region.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.cutAnimations=0;window.cutEvents=0;
  const solve=SplashSearch.solve;
  SplashSearch.solve=function*(...args){const g=solve(...args);try{let s;while(!(s=g.next()).done){cutEvents++;yield s.value;}return s.value;}finally{g.return();}};
  animateAutoPlayMove=async()=>{cutAnimations++;return true;};render();
 },require('./narrow-connection.cjs').board);
 await startFixture(page);await page.clock.runFor(100);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>cutEvents),0);assert.equal(await page.evaluate(()=>cutAnimations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./narrow-connection.cjs').board);
 assert.equal(await page.evaluate(()=>state.history.length),0);
 await page.close();console.log('Passed immediate narrow-connection proof with no planning or batch animation.');

 // A green exit cannot grow enough clearing capacity for its three reds.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.greenExitEvents=0;window.greenExitAnimations=0;
  const solve=SplashSearch.solve;
  SplashSearch.solve=function*(...args){const g=solve(...args);try{let s;while(!(s=g.next()).done){greenExitEvents++;yield s.value;}return s.value;}finally{g.return();}};
  animateAutoPlayMove=async()=>{greenExitAnimations++;return true;};render();
 },require('./green-exit.cjs').board);
 await startFixture(page);await page.clock.runFor(100);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>greenExitEvents),0);assert.equal(await page.evaluate(()=>greenExitAnimations),0);
 assert.equal(await page.evaluate(()=>state.history.length),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./green-exit.cjs').board);
 assert.equal(await page.evaluate(()=>autoPlayState.active),false);
 await page.close();console.log('Passed immediate green-exit capacity proof without search or animation.');

 // The retracting-moves screenshot receives a silent bounded proof.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.deadBranchAnimations=0;
  const legacySolve=SplashSearch.solve;
  SplashSearch.solve=(tiles,adj,options)=>legacySolve(tiles,adj,{...options,stopBeforeExhaustive:false,strategyOnly:false,progressive:true});
  animateAutoPlayMove=async()=>{deadBranchAnimations++;return true;};render();
 },require('./retracted-moves.cjs').board);
 await startFixture(page);
 for(let i=0;i<300&&await page.evaluate(()=>autoPlayState.active);i++)await page.clock.runFor(50);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>deadBranchAnimations),0);
 assert.equal(await page.evaluate(()=>state.history.length),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./retracted-moves.cjs').board);
 await page.close();console.log('Passed retracting-moves board proof without forward/reverse animation.');

 // The October 4 two-blue pocket is rejected before exhaustive search.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.pocketEvents=0;window.pocketAnimations=0;
  const solve=SplashSearch.solve;
  SplashSearch.solve=function*(...args){const g=solve(...args);try{let s;while(!(s=g.next()).done){pocketEvents++;yield s.value;}return s.value;}finally{g.return();}};
  animateAutoPlayMove=async()=>{pocketAnimations++;return true;};render();
 },require('./eight-pocket.cjs').board);
 await startFixture(page);await page.clock.runFor(100);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>pocketEvents),0);assert.equal(await page.evaluate(()=>pocketAnimations),0);
 assert.equal(await page.evaluate(()=>state.history.length),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./eight-pocket.cjs').board);
 assert.equal(await page.evaluate(()=>autoPlayState.active),false);
 await page.close();console.log('Passed immediate eight-tile pocket proof without search or animation.');

 // The orange screenshot now has a structural proof before any search event.
 page=await setup();
 await page.evaluate(board=>{
  state.tiles=[...board];window.bridgeAnimations=0;window.bridgeSearchEvents=0;
  const solve=SplashSearch.solve;
  SplashSearch.solve=function*(...args){const gen=solve(...args);try{let next;while(!(next=gen.next()).done){bridgeSearchEvents++;yield next.value;}return next.value;}finally{gen.return();}};
  animateAutoPlayMove=async()=>{bridgeAnimations++;return true;};render();
 },require('./stalled-backtracking.cjs').board);
 await startFixture(page);await page.clock.runFor(100);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.evaluate(()=>bridgeAnimations),0);
 assert.equal(await page.evaluate(()=>bridgeSearchEvents),0);
 assert.equal(await page.evaluate(()=>autoPlayState.active),false);
 assert.equal(await page.evaluate(()=>state.history.length),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),require('./stalled-backtracking.cjs').board);
 assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'1');
 await page.close();
 console.log('Passed immediate orange screenshot proof without lookahead, animation, or board/history changes.');

 // Silent rejections leave the board alone and still yield to Stop/deadline.
 page=await setup();
 await page.evaluate(()=>{
  window.unchanged=[...state.tiles];
  SplashSearch.solve=function*(){while(true)yield {type:'search'};};
  animateAutoPlayMove=async()=>{throw Error('Silent lookahead was animated');};
 });
 await startFixture(page);
 await page.clock.runFor(20);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>unchanged));
 assert.equal(await page.evaluate(()=>state.history.length),0);
 await stopIfRunning(page);await page.clock.runFor(20);
 assert.equal(await page.evaluate(()=>autoPlayState.active),false);
 await startFixture(page);
 await page.clock.fastForward(300001);await page.clock.runFor(100);
 assert.match(await page.locator('#auto-play-status').textContent(),/^Timed out/);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>unchanged));
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed silent lookahead display stability, Stop, and deadline.');
 page=await setup();
 await page.evaluate(fixture=>{window.trace=[];state.tiles=[...fixture];animateAutoPlayMove=async plan=>{
  if(plan.sourceIndex>=0){
   if(!isLinkedBlobMove(plan.sourceIndex,plan.targetIndex,state.tiles))throw Error('Illegal forward move');
   const after=applyMove(plan.sourceIndex,plan.targetIndex,state).tiles;
   if(SplashSearch.assess(after,tilesMeta.map(t=>getNeighbors(t.index))).unsolvable)throw Error('A rejected successor was animated');
  }
  trace.push(plan);return true;
 };render();},fixture);
 await startFixture(page);
 for(let i=0;i<300 && await page.locator('#auto-play-status').textContent()!=='Solution found!';i++)await page.clock.runFor(500);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Solution found!');
 assert.equal(await page.evaluate(()=>state.history.length),4);
 await stopIfRunning(page);await page.clock.runFor(100);await page.close();
 console.log('Passed a solving lookahead search with consistent undo history.');
 // Exercise the real RAF animation, including cancellation while unmixing.
 page=await setup();
 await page.evaluate(()=>{
  const before=Array(60).fill('white');before[0]='red';before[1]='blue';before[8]='yellow';
  const after=applyMove(0,1,{tiles:before}).tiles;window.event={type:'forward',sourceIndex:0,targetIndex:1,before,after};
  state.tiles=[...before];autoPlayState.active=true;autoPlayState.phase='search';autoPlayState.deadline=Infinity;
  window.animationResult=null;animateSearchEvent(window.event).then(r=>animationResult=r);
 });
 await page.clock.runFor(800);assert.equal(await page.evaluate(()=>animationResult),true);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>window.event.after));
 assert.equal(await page.evaluate(()=>autoPlayState.message),'Playing…');
 await page.evaluate(()=>{window.event.type='backtrack';window.animationResult=null;animateSearchEvent(window.event).then(r=>animationResult=r);});
 await page.clock.runFor(100);assert.equal(await page.evaluate(()=>demoAnimation.color),'red');
 assert.equal(await page.evaluate(()=>state.tiles[1]),'blue');
 await page.evaluate(()=>autoPlayState.stopRequested=true);await page.clock.runFor(60);
 assert.equal(await page.evaluate(()=>animationResult),false);assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>window.event.after));
 assert.equal(await page.evaluate(()=>demoAnimation.active),false);
 // A full reverse animation restores both cells, including clearing moves.
 await page.evaluate(()=>{autoPlayState.stopRequested=false;window.animationResult=null;animateSearchEvent(window.event).then(r=>animationResult=r);});
 await page.clock.runFor(800);assert.equal(await page.evaluate(()=>animationResult),true);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>window.event.before));
 assert.equal(await page.evaluate(()=>autoPlayState.message),'Planning from the restored position…');
 // Reverse a clearing move: both cells begin white.
 await page.evaluate(()=>{
  const before=Array(60).fill('white');before[1]='purple';before[8]='yellow';
  const after=applyMove(8,1,{tiles:before}).tiles;state.tiles=[...after];
  window.clearingEvent={type:'backtrack',sourceIndex:8,targetIndex:1,before,after};
  window.animationResult=null;animateSearchEvent(clearingEvent).then(r=>animationResult=r);
 });
 await page.clock.runFor(800);assert.equal(await page.evaluate(()=>animationResult),true);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>clearingEvent.before));
 // Timeout interrupts the real animation and leaves a stable board.
 await page.evaluate(()=>{
  state.tiles=[...window.event.before];autoPlayState.deadline=performance.now()+100;
  window.event.type='forward';window.animationResult=null;animateSearchEvent(window.event).then(r=>animationResult=r);
 });
 await page.clock.runFor(200);assert.equal(await page.evaluate(()=>animationResult),false);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>window.event.before));
 await page.close();await browser.close();assert.deepEqual(errors,[]);console.log('Passed actual forward/reverse animation, colors, cancellation rollback; no browser errors.');
})().catch(e=>{console.error(e);process.exit(1);});
