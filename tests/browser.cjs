const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const counter=require('./fixtures.json').board.map(i=>['white','red','blue','purple','yellow','orange','green'][i]);
const fixture=require('./fixtures.json').backtrack;
(async()=>{
 const browser=await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {})});
 const errors=[];
 async function setup(){const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);await page.clock.install();await page.clock.pauseAt(new Date());return page;}
 let page=await setup();
 await page.evaluate(counter=>{
  window.fresh=0;window.trace=[];window.realAnimate=animateAutoPlayMove;
  animateAutoPlayMove=async plan=>{if(plan.sourceIndex>=0 && !isLinkedBlobMove(plan.sourceIndex,plan.targetIndex,state.tiles))throw Error('Illegal forward animation');trace.push(plan);return true;};
  createShuffledBoard=()=>{fresh++;return [...counter];};
  state.tiles=Array(60).fill('white');state.tiles[0]='red';state.tiles[1]='blue';state.tiles[8]='yellow';render();
 },counter);
 await page.getByRole('button',{name:'Auto Play',exact:true}).click();
 await page.clock.runFor(600);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Solution found!');
 assert.equal(await page.locator('#auto-play-solved').textContent(),'1');
 assert.equal(await page.locator('#analysis-btn').isDisabled(),true);
 await page.clock.runFor(9800);assert.equal(await page.evaluate(()=>fresh),0);
 await page.clock.runFor(100);assert.equal(await page.evaluate(()=>fresh),1);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'1');
 await page.clock.runFor(9999);assert.equal(await page.evaluate(()=>fresh),1);
 await page.getByRole('button',{name:'Stop',exact:true}).click();await page.clock.runFor(100);
 assert.equal(await page.evaluate(()=>autoPlayState.active),false);
 await page.clock.runFor(15000);assert.equal(await page.evaluate(()=>fresh),1);
 // Starting again resets every session counter, including time.
 await page.evaluate(()=>{state.tiles=Array(60).fill('white');state.tiles[0]='red';state.tiles[1]='blue';state.tiles[8]='yellow';render();});
 await page.getByRole('button',{name:'Auto Play',exact:true}).click();
 assert.equal(await page.locator('#auto-play-solved').textContent(),'0');assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'0');
 await page.getByRole('button',{name:'Stop',exact:true}).click();await page.clock.runFor(100);await page.close();
 console.log('Passed solution/proof messages, 10-second wait, board cycling, Stop, session reset.');
 // The original counterexample remains trapped after an unrelated outside
 // mix. It must be classified before ANY animation, even on a mixed board.
 page=await setup();
 await page.evaluate(counter=>{
  state.tiles=[...counter];state.tiles[19]='white';state.tiles[26]='orange';
  window.trappedSnapshot=[...state.tiles];window.animations=0;
  animateAutoPlayMove=async()=>{animations++;throw Error('A trapped board was animated');};
  render();
 },counter);
 await page.getByRole('button',{name:'Auto Play',exact:true}).click();
 await page.clock.runFor(50);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Board is unsolvable!');
 assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'1');
 assert.equal(await page.evaluate(()=>animations),0);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>trappedSnapshot));
 await page.getByRole('button',{name:'Stop',exact:true}).click();await page.clock.runFor(100);await page.close();
 console.log('Passed mixed-board corner trap: immediate proof, no animation.');
 // Deadline test: controlled endless exploration, with genuine forward/undo states.
 page=await setup();
 await page.evaluate(()=>{
  window.fresh=0;createShuffledBoard=()=>{fresh++;return [...state.initialTiles];};
  animateAutoPlayMove=async()=>true;
  SplashSearch.solve=function*(tiles){const sourceIndex=tiles.findIndex((_,i)=>tiles.some((_,j)=>isLinkedBlobMove(i,j,tiles)));const targetIndex=tiles.findIndex((_,j)=>isLinkedBlobMove(sourceIndex,j,tiles));const after=applyMove(sourceIndex,targetIndex,{tiles}).tiles;while(true){yield {type:'forward',sourceIndex,targetIndex,before:tiles,after};yield {type:'backtrack',sourceIndex,targetIndex,before:tiles,after};}};
 });
 await page.getByRole('button',{name:'Auto Play',exact:true}).click();
 await page.clock.fastForward(600001);await page.clock.runFor(100);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Solution Unknown');
 assert.equal(await page.locator('#auto-play-unknown').textContent(),'1');assert.equal(await page.locator('#auto-play-unsolvable').textContent(),'0');
 assert.equal(await page.evaluate(()=>fresh),0);
 await page.clock.runFor(4800);assert.equal(await page.evaluate(()=>fresh),0);
 await page.clock.runFor(200);assert.equal(await page.evaluate(()=>fresh),1);
 await page.getByRole('button',{name:'Stop',exact:true}).click();await page.clock.runFor(100);await page.close();
 console.log('Passed ten-minute cutoff and five-second UNKNOWN restart.');
 // Silent rejections leave the board alone and still yield to Stop/deadline.
 page=await setup();
 await page.evaluate(()=>{
  window.unchanged=[...state.tiles];
  SplashSearch.solve=function*(){while(true)yield {type:'search'};};
  animateAutoPlayMove=async()=>{throw Error('Silent lookahead was animated');};
 });
 await page.getByRole('button',{name:'Auto Play',exact:true}).click();
 await page.clock.runFor(20);
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>unchanged));
 assert.equal(await page.evaluate(()=>state.history.length),0);
 await page.getByRole('button',{name:'Stop',exact:true}).click();await page.clock.runFor(20);
 assert.equal(await page.evaluate(()=>autoPlayState.active),false);
 await page.getByRole('button',{name:'Auto Play',exact:true}).click();
 await page.clock.fastForward(600001);await page.clock.runFor(100);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Solution Unknown');
 assert.deepEqual(await page.evaluate(()=>state.tiles),await page.evaluate(()=>unchanged));
 await page.getByRole('button',{name:'Stop',exact:true}).click();await page.clock.runFor(100);await page.close();
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
 await page.getByRole('button',{name:'Auto Play',exact:true}).click();
 for(let i=0;i<300 && await page.locator('#auto-play-status').textContent()!=='Solution found!';i++)await page.clock.runFor(500);
 assert.equal(await page.locator('#auto-play-status').textContent(),'Solution found!');
 assert.equal(await page.evaluate(()=>state.history.length),4);
 await page.getByRole('button',{name:'Stop',exact:true}).click();await page.clock.runFor(100);await page.close();
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
