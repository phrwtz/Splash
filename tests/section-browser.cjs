const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
const {board}=require(process.env.SECTION_FIXTURE||'./section-planning.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);
  await page.clock.install();await page.clock.pauseAt(new Date());
  await page.evaluate(board=>{
   state.tiles=board.slice();state.initialTiles=board.slice();state.history=[];window.trace=[];window.events=[];
   const realEvent=animateSearchEvent;animateSearchEvent=async event=>{events.push(event);return realEvent(event);};
   animateAutoPlayMove=async plan=>{assertLegal(plan);trace.push(plan);return true;};
   window.assertLegal=plan=>{if(!isLinkedBlobMove(plan.sourceIndex,plan.targetIndex,state.tiles))throw Error('Illegal planned transfer');};
   render();
  },board);
  await page.getByRole('button',{name:'Auto Play',exact:true}).click();await page.getByRole('button',{name:'Start Auto Play',exact:true}).click();
  // Stop while the section pass is yielding; the live board stays untouched.
  await page.clock.runFor(50);
  assert.deepEqual(await page.evaluate(()=>state.tiles),board);
  await page.getByRole('button',{name:'Stop',exact:true}).click();await page.clock.runFor(100);
  assert.equal(await page.evaluate(()=>autoPlayState.active),false);assert.equal(await page.evaluate(()=>trace.length),0);
  await page.getByRole('button',{name:'Auto Play',exact:true}).click();await page.getByRole('button',{name:'Start Auto Play',exact:true}).click();
  for(let i=0;i<240&&!(await page.evaluate(()=>state.tiles.every(c=>c==='white')));i++)await page.clock.runFor(500);
  assert(await page.evaluate(()=>state.tiles.every(c=>c==='white')));
  assert.equal(await page.evaluate(()=>trace.length),40);
  assert(await page.evaluate(()=>events.every(e=>e.type==='forward'&&e.plan.verified&&e.plan.continuationVerified)));
  assert.equal(await page.locator('#auto-play-solved').textContent(),'1');
  await page.getByRole('button',{name:'Stop',exact:true}).click();await page.clock.runFor(100);
  assert.deepEqual(errors,[]);console.log('Passed challenge in real Auto Play: Stop during planning, full verified playback, 40 legal moves, and solved counter.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
