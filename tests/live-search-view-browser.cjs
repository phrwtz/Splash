const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
const {board}=require('./early-endgame-two.cjs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);
 await p.evaluate(board=>{state.tiles=board.slice();state.initialTiles=board.slice();state.history=[];render();},board);
 await p.evaluate(()=>{pauseAutoPlay=async()=>true;});
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.locator('#auto-play-process').check();await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();
 await p.waitForFunction(()=>autoPlayState.searchView?.some((c,i)=>c!==state.initialTiles[i])&&autoPlayState.searchGroup.length,{},{timeout:30000});
 assert(await p.evaluate(()=>[...innerLayer.querySelectorAll('.tile-group')].every(g=>g.querySelector('.inner').getAttribute('fill')===COLOR_HEX[autoPlayState.searchView[+g.dataset.index]])));
 assert(await p.locator('#inner-layer .search-selected').count()>0);
 assert.deepEqual(await p.evaluate(()=>state.tiles),board);
 await p.getByRole('button',{name:'Stop',exact:true}).click();
 await p.waitForFunction(()=>!autoPlayState.active);
 assert.equal(await p.locator('#inner-layer .search-selected').count(),0);assert.deepEqual(await p.evaluate(()=>state.tiles),board);
 assert.deepEqual(errors,[]);console.log('Passed real strategic solver board-color updates, group highlighting, unchanged playable board, and Stop.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
