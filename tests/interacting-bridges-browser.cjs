const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
const {board}=require('./interacting-bridge-board.cjs'),{pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});try{
 const context=await browser.newContext({acceptDownloads:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const url=pathToFileURL(path.join(__dirname,'..','index.html')).href;await p.goto(url);
 await p.evaluate(board=>{
  createShuffledBoard=()=>board.slice();
  // Exercise the real worker with a tripwire in the forbidden fallback.
  createSplashSearch=Function('return ('+createSplashSearch.toString().replace('function* hybridSolve(tiles,adjacency,options) {','function* hybridSolve(tiles,adjacency,options) {options={...options,beamSearch:false,diagnosticSearch:false};').replace('function* exact(b,budget=null,sleep=[]) {','function* exact(b,budget=null,sleep=[]) {throw Error("Forbidden exact search");')+')')();
  window.workers=0;const Native=Worker;Worker=class extends Native{constructor(...args){super(...args);workers++;}};
  const draw=render;render=()=>{if(!window.result&&autoPlayState.phase==='result'&&autoPlayState.session?.solved){window.result={tiles:state.tiles.slice(),history:state.history.map(h=>h.tiles),computeMs:autoPlayState.searchComputeMs};autoPlayState.stopRequested=true;}draw();};
 },board);
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.locator('#auto-play-no-display').check();
 await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();
 const foreground=await context.newPage();await foreground.goto('about:blank');await foreground.bringToFront();
 await p.waitForFunction(()=>!!window.result,{},{timeout:60000});
 const result=await p.evaluate(()=>({result,workers}));assert(result.workers>=1);assert(result.result.tiles.every(c=>c==='white'));assert.equal(result.result.history.length,40);assert(result.result.computeMs>0&&result.result.computeMs<60000);
 await p.waitForFunction(()=>!autoPlayState.active);
 // The UI's own canDrop/applyMove checks each step as a second verifier.
 await p.evaluate(board=>{const positions=[...result.history,result.tiles];state.tiles=board.slice();render();for(let k=1;k<positions.length;k++){const before=positions[k-1],after=positions[k],changed=before.flatMap((c,i)=>c!==after[i]?[i]:[]);if(changed.length!==2)throw Error('Bad replay');let [i,j]=changed;if(!canDrop(i,j,state)){[i,j]=[j,i];}if(!canDrop(i,j,state))throw Error('Illegal move '+k);const a=applyMove(i,j,state);if(JSON.stringify(a.tiles)!==JSON.stringify(after)){[i,j]=[j,i];Object.assign(state,applyMove(i,j,state));}else Object.assign(state,a);if(JSON.stringify(state.tiles)!==JSON.stringify(after))throw Error('Wrong result '+k);render();}},board);
 assert.deepEqual(errors,[]);console.log('PASS: real hidden-tab worker solves screenshot, 40 UI-validated moves, no exhaustive fallback:',result.result.computeMs,'ms');
 // Stop interrupts a real planning worker, including a pending next().
 await p.reload();await p.evaluate(board=>{createShuffledBoard=()=>board.slice();window.terminated=0;const Native=Worker;Worker=class extends Native{terminate(){terminated++;super.terminate();}};},board);
 await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.locator('#auto-play-no-display').check();await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();await p.waitForFunction(()=>autoPlayState.searchComputeMs>0);
 await p.getByRole('button',{name:'Stop',exact:true}).click();await p.waitForFunction(()=>!autoPlayState.active);assert(await p.evaluate(()=>terminated>0));assert.equal(await p.evaluate(()=>autoPlayState.session.unknown),0);
 assert.deepEqual(errors,[]);console.log('PASS: Stop terminates the real planning worker without a timeout outcome.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
