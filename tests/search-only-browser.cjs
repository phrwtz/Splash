const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);
 await p.evaluate(()=>localStorage.clear());await p.reload();await p.clock.install();await p.clock.pauseAt(new Date());
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();assert(await p.locator('#auto-play-animation').isChecked());assert.equal(await p.evaluate(()=>autoPlayState.active),false);
 await p.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await p.evaluate(()=>autoPlayState.session),null);
 await p.evaluate(()=>{
  window.timeoutDeal=[...state.initialTiles];window.searchCalls=0;window.freshCalls=0;window.animationCalls=0;window.pauseCalls=0;
  window.tiny=Array(60).fill('white');tiny[0]='red';tiny[1]='blue';tiny[8]='yellow';
  state.tiles=[...tiny];state.initialTiles=[...tiny];state.history=[];
  animateAutoPlayMove=async()=>{animationCalls++;throw Error('Unexpected animation');};
  buildAutoPlayAnimationPath=()=>{throw Error('Unexpected animation path');};
  const realPause=pauseAutoPlay;pauseAutoPlay=async ms=>{pauseCalls++;return realPause(ms);};
  const realSolve=SplashSearch.solve;SplashSearch.solve=function*(tiles,adj,opt){searchCalls++;if(searchCalls>=4){while(true)yield {type:'search'};}return yield* realSolve(tiles,adj,opt);};
  createShuffledBoard=()=>{freshCalls++;if(freshCalls===2){const b=Array(60).fill('white');b[0]='red';return b;}return freshCalls===3?[...timeoutDeal]:[...tiny];};render();
 });
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.locator('#auto-play-animation').uncheck();await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();
 await p.clock.runFor(1000);
 assert.equal(await p.locator('#auto-play-solved').textContent(),'2');assert.equal(await p.locator('#auto-play-unsolvable').textContent(),'1');assert(await p.evaluate(()=>autoPlayState.active));
 assert.equal(await p.evaluate(()=>animationCalls),0);assert.equal(await p.evaluate(()=>pauseCalls),0);
 await p.clock.fastForward(300001);await p.clock.runFor(100);
 assert.equal(await p.locator('#auto-play-unknown').textContent(),'1');assert.equal(await p.evaluate(()=>savedTimedOutBoards.length),1);
 assert.deepEqual(await p.evaluate(()=>savedTimedOutBoards[0].tiles),await p.evaluate(()=>timeoutDeal));assert(await p.evaluate(()=>freshCalls>=4));assert(await p.evaluate(()=>autoPlayState.active));
 await p.getByRole('button',{name:'Stop',exact:true}).click();await p.clock.runFor(100);assert.equal(await p.evaluate(()=>autoPlayState.active),false);
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();assert.equal(await p.locator('#auto-play-animation').isChecked(),false);await p.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('Passed modal choice/cancel, verified instant solutions, running counts, continuous proof handling, no animation or pauses, timeout saving, Stop, and remembered choice.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
