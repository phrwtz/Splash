const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});try{
 const p=await browser.newPage();
 await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);
 assert.equal(await p.locator('#auto-play-process').count(),0);
 await p.evaluate(()=>{
  autoPlayState.active=true;autoPlayState.displayMode='none';autoPlayState.animate=false;
  state.initialTiles=Array(60).fill('red');state.tiles=state.initialTiles.slice();render();
 });
 const colors=()=>p.locator('#inner-layer .inner').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('fill')));
 const first=await colors();
 await p.evaluate(async()=>{
  autoPlayState.searchView=Array(60).fill('blue');
  await animateSearchEvent({type:'move',before:state.tiles.slice(),after:Array(60).fill('white')});
  autoPlayState.phase='result';render();
 });
 assert.deepEqual(await colors(),first,'Search and solution playback must not alter the displayed deal');
 await p.evaluate(()=>{
  state.initialTiles=Array(60).fill('yellow');state.tiles=state.initialTiles.slice();
  autoPlayState.searchView=null;autoPlayState.phase='search';render();
 });
 assert.notDeepEqual(await colors(),first,'Starting a new deal must update the board');
 assert.equal(await p.locator('#inner-layer .search-selected').count(),0);
 console.log('PASS: No display holds the original deal through search/playback/results and updates on the next deal.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
