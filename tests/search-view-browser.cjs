const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);await p.clock.install();await p.clock.pauseAt(new Date());
 await p.evaluate(()=>{
  window.pauses=[];const realPause=pauseAutoPlay;pauseAutoPlay=async ms=>{pauses.push(ms);return realPause(ms);};
  window.original=state.tiles.slice();window.first=Array(60).fill('white');first[0]=first[1]='red';first[8]='blue';
  window.second=first.slice();second[0]='white';second[1]='purple';
  SplashSearch.solve=function*(){yield {type:'search',phase:'planning',tiles:first,objective:{color:'red',cells:[0]},positions:1};while(performance.now()<2000)yield {type:'search',phase:'planning',tiles:first,objective:{color:'red',cells:[0]},positions:1};while(true)yield {type:'search',phase:'planning',tiles:second,objective:{color:'purple',cells:[1]},positions:3};};
 });
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.locator('#auto-play-process').check();await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();
 await p.clock.runFor(50);
 assert.deepEqual(await p.evaluate(()=>pauses),[500]);
 assert.deepEqual(await p.evaluate(()=>state.tiles),await p.evaluate(()=>original));
 assert.deepEqual(await p.locator('.tile-group.search-selected').evaluateAll(gs=>gs.map(g=>+g.dataset.index)),[0,1]);
 assert.match(await p.locator('#inner-layer .tile-group[data-index="0"]').getAttribute('aria-label'),/red tile/);
 const text=await p.locator('#auto-play-status').textContent();await p.clock.runFor(1000);
 assert.equal(await p.locator('#auto-play-status').textContent(),text);
 assert.match(await p.locator('#inner-layer .tile-group[data-index="0"]').getAttribute('aria-label'),/red tile/);
 await p.clock.runFor(3500);
 assert.match(await p.locator('#inner-layer .tile-group[data-index="0"]').getAttribute('aria-label'),/white tile/);
 assert.deepEqual(await p.locator('.tile-group.search-selected').evaluateAll(gs=>gs.map(g=>+g.dataset.index)),[1]);
 assert.deepEqual(await p.evaluate(()=>pauses),[500,500]);
 await p.getByRole('button',{name:'Stop',exact:true}).click();await p.clock.runFor(100);
 assert.equal(await p.locator('.tile-group.search-selected').count(),0);
 assert.deepEqual(await p.evaluate(()=>state.tiles),await p.evaluate(()=>original));
 assert.deepEqual(errors,[]);console.log('Passed search snapshots, whole-group selection, persistence between status changes, and Stop restoration.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
