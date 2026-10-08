const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
 try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const url=require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href;
 await p.goto(url);await p.evaluate(()=>localStorage.clear());await p.reload();
 await p.clock.install();await p.clock.pauseAt(new Date());
 await p.evaluate(()=>{
  window.deal=[...state.initialTiles];window.freshBoards=0;
  state.tiles=state.tiles.map((c,i)=>i<3?'white':c);state.history=[{tiles:[...deal]}];
  SplashSearch.solve=function*(){while(true)yield {type:'search'};};
  createShuffledBoard=()=>{freshBoards++;return deal.map((c,i)=>deal[(i+1)%60]);};render();
 });
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();
 assert.equal(await p.evaluate(()=>AUTO_PLAY_SEARCH_MS),300000);
 await p.clock.fastForward(299000);
 assert.equal(await p.evaluate(()=>savedTimedOutBoards.length),0);
 assert.equal(await p.locator('#auto-play-unknown').textContent(),'0');
 await p.clock.fastForward(1001);await p.clock.runFor(100);
 assert.equal(await p.evaluate(()=>savedTimedOutBoards.length),1);
 assert.deepEqual(await p.evaluate(()=>savedTimedOutBoards[0].tiles),await p.evaluate(()=>deal));
 assert.equal(await p.locator('#auto-play-unknown').textContent(),'1');
 await p.clock.runFor(2500);assert.equal(await p.evaluate(()=>freshBoards),1);assert(await p.evaluate(()=>autoPlayState.active));
 await p.locator('#saved-timeouts-btn').click();
 await p.getByRole('button',{name:'Play this board',exact:true}).click();await p.clock.runFor(100);
 assert.equal(await p.evaluate(()=>autoPlayState.active),false);
 assert.deepEqual(await p.evaluate(()=>state.tiles),await p.evaluate(()=>deal));
 assert.deepEqual(await p.evaluate(()=>state.initialTiles),await p.evaluate(()=>deal));assert.equal(await p.evaluate(()=>state.history.length),0);
 const original=await p.evaluate(()=>deal);
 await p.reload();await p.locator('#saved-timeouts-btn').click();
 assert.equal(await p.getByRole('button',{name:'Play this board',exact:true}).count(),1);
 await p.getByRole('button',{name:'Play this board',exact:true}).click();
 assert.deepEqual(await p.evaluate(()=>state.tiles),original);
 // Stop is cancellation, not another timeout.
 await p.clock.install();await p.clock.pauseAt(new Date());
 await p.evaluate(()=>{SplashSearch.solve=function*(){while(true)yield {type:'search'};};});
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.clock.runFor(50);
 await p.getByRole('button',{name:'Stop',exact:true}).click();await p.clock.runFor(100);
 assert.equal(await p.evaluate(()=>savedTimedOutBoards.length),1);
 // Storage failure retains the board in memory and explains its lifetime.
 await p.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Quota exceeded');};saveTimedOutBoard();});
 await p.locator('#saved-timeouts-btn').click();assert.match(await p.locator('#saved-timeouts-storage').textContent(),/visit only/);
 assert.equal(await p.getByRole('button',{name:'Play this board',exact:true}).count(),2);
 assert.deepEqual(errors,[]);console.log('Passed timeout saving, automatic next board, opening during Auto Play, original-deal restoration, persistence, cancellation, and storage failure.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
