const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
const {board}=require('./early-endgame-two.cjs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);
 await p.evaluate(board=>{state.tiles=board.slice();state.initialTiles=board.slice();state.history=[];createShuffledBoard=()=>board.slice();render();},board);
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.locator('#auto-play-no-display').check();await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();
 await p.waitForFunction(()=>autoPlayState.active && autoPlayState.searchComputeMs>100);
 assert(await p.evaluate(()=>[...innerLayer.querySelectorAll('.tile-group')].every(g=>g.querySelector('.inner').getAttribute('fill')===COLOR_HEX[state.initialTiles[+g.dataset.index]])));
 assert.equal(await p.locator('#inner-layer .search-selected').count(),0);
 await p.getByRole('button',{name:'Stop',exact:true}).click();
 await p.waitForFunction(()=>!autoPlayState.active);
 assert.equal(await p.locator('#inner-layer .search-selected').count(),0);
 assert.deepEqual(errors,[]);console.log('Passed original-deal display during real background search and Stop.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
