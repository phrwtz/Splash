const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict'),{board,adj}=require('./oct12-board.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);
 await p.evaluate(board=>{state.tiles=board.slice();state.initialTiles=board.slice();state.history=[];const realRender=render;render=()=>{if(autoPlayState.phase==='result'&&autoPlayState.session?.solved===1&&!window.solvedTiles)window.solvedTiles=state.tiles.slice();realRender();};render();},board);
 assert.deepEqual(await p.evaluate(()=>tilesMeta.map(t=>getNeighbors(t.index)).map(a=>a.sort((x,y)=>x-y))),adj.map(a=>a.slice().sort((x,y)=>x-y)));
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.locator('#auto-play-no-display').check();const start=Date.now();await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();
 await p.waitForFunction(()=>autoPlayState.session.solved===1,{},{timeout:30000});assert(await p.evaluate(()=>solvedTiles.every(c=>c==='white')));
 await p.getByRole('button',{name:'Stop',exact:true}).click();assert.deepEqual(errors,[]);console.log('Pictured board solved by actual Auto Play:',Date.now()-start,'ms');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
