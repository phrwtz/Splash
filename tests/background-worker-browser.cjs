const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict'),{board}=require('./background-board.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext(),p=await context.newPage();await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);
 await p.evaluate(board=>{state.tiles=board.slice();state.initialTiles=board.slice();state.history=[];window.workers=0;const OriginalWorker=Worker;Worker=class extends OriginalWorker{constructor(...args){super(...args);workers++;}};const realRender=render;render=()=>{if(autoPlayState.phase==='result'&&!window.result){window.result={tiles:state.tiles.slice(),computeMs:autoPlayState.searchComputeMs};autoPlayState.stopRequested=true;}realRender();};render();},board);
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.locator('#auto-play-no-display').check();
 // A timer-dependent main search would hang here; workers must still finish.
 await p.evaluate(()=>{waitForAutoPlayMs=()=>new Promise(()=>{});});
 await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();const foreground=await context.newPage();await foreground.goto('about:blank');await foreground.bringToFront();
 await p.waitForFunction(()=>!!window.result,{},{timeout:30000});const result=await p.evaluate(()=>({result,workers}));assert(result.workers>=1);assert(result.result.tiles.every(c=>c==='white'));assert(result.result.computeMs>0&&result.result.computeMs<300000);console.log('Passed actual worker completion with another tab foreground and blocked page timer yields:',result.result.computeMs,'ms computation');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
