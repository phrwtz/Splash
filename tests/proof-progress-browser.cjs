const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});try{
const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);
await p.evaluate(()=>{
const rows=['BBYBYBYR','BRBYBBR','RBYBRYYY','BYYRBYB','BYBBRRBB','RRRBBYY','YYYRYRRR','RRRYRYR'];state.tiles=rows.join('').split('').map(c=>({R:'red',B:'blue',Y:'yellow'}[c]));state.initialTiles=state.tiles.slice();state.history=[];render();
// Keep the test focused on complete search; production keeps strategic attempts.
createSplashSearch=new Function('return ('+createSplashSearch.toString().replace('if(options.hybrid)return yield* hybridSolve(tiles,adjacency,options);','if(options.hybrid)return yield* hybridSolve(tiles,adjacency,{...options,strategicAttempts:0,strategyStates:0,sectionStates:0,bridgeStates:0});')+')')();
});
await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.locator('#auto-play-no-display').check();await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();
await p.waitForFunction(()=>autoPlayProofSnapshot?.keys?.length>0,{},{timeout:45000});
assert.match(await p.locator('#auto-play-status').textContent(),/initial move branches/);assert.match(await p.locator('#auto-play-status').textContent(),/time remaining is unknown/);
await p.getByRole('button',{name:'Stop',exact:true}).click();await p.waitForFunction(()=>!autoPlayState.active);const count=await p.evaluate(()=>autoPlayProofSnapshot.keys.length);assert(count>0);
await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();await p.waitForFunction(()=>autoPlayState.message.includes('cached failures retained'),{},{timeout:10000});
await p.getByRole('button',{name:'Stop',exact:true}).click();await p.waitForFunction(()=>!autoPlayState.active);assert.deepEqual(errors,[]);console.log('Passed real-worker snapshots, Stop/Start proof reuse, branch status, honest ETA, and Stop. Retained failures:',count);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
