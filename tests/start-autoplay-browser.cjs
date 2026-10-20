const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const p=await browser.newPage({acceptDownloads:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);
await p.evaluate(()=>{
 Worker=undefined;SplashSearch.solve=function*(){for(;;)yield {type:'search'};};
 window.pickerCalls=0;window.freshCalls=0;window.before=state.tiles.slice();
 window.showSaveFilePicker=window.showOpenFilePicker=async()=>{pickerCalls++;throw Error('Unexpected picker')};
 const fresh=createShuffledBoard;createShuffledBoard=()=>{freshCalls++;return fresh()};
});
await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.locator('#auto-play-no-display').check();await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();await p.waitForFunction(()=>autoPlayState.active);
assert.equal(await p.evaluate(()=>pickerCalls),0);assert.equal(await p.evaluate(()=>freshCalls),1);assert.equal(await p.evaluate(()=>autoPlayState.displayMode),'none');assert.equal(await p.locator('#auto-play-options').evaluate(e=>e.open),false);
assert.notDeepEqual(await p.evaluate(()=>state.initialTiles),await p.evaluate(()=>before));
const deal=await p.evaluate(()=>state.initialTiles);
const download=p.waitForEvent('download');await p.evaluate(()=>autoPlayState.searchComputeMs=300000);const file=await download;
const archive=JSON.parse(require('node:fs').readFileSync(await file.path(),'utf8'));
assert.equal(archive.format,'splash-boards-v1');assert.deepEqual(archive.boards[0].tiles,deal);assert.equal(archive.boards[0].outcome,'timed-out');
await p.waitForFunction(()=>autoPlayState.session.unknown===1);assert.equal(await p.evaluate(()=>pickerCalls),0);
await p.getByRole('button',{name:'Stop',exact:true}).click();await p.waitForFunction(()=>!autoPlayState.active);
await p.locator('#saved-timeouts-btn').click();assert(await p.locator('#saved-timeouts-dialog').evaluate(e=>e.open));assert.equal(await p.locator('#saved-timeouts-list input').count(),1);assert.equal(await p.evaluate(()=>pickerCalls),0);
await p.getByRole('checkbox').check();await p.locator('#saved-timeout-play').click();assert.deepEqual(await p.evaluate(()=>state.tiles),deal);
await p.getByRole('button',{name:'Auto Play',exact:true}).click();await p.getByRole('button',{name:'Start Auto Play',exact:true}).click();await p.waitForFunction(()=>autoPlayState.active);assert.equal(await p.evaluate(()=>pickerCalls),0);assert.notDeepEqual(await p.evaluate(()=>state.initialTiles),deal);
await p.getByRole('button',{name:'Stop',exact:true}).click();await p.waitForFunction(()=>!autoPlayState.active);assert.deepEqual(errors,[]);
console.log('PASS: immediate random-board start without file selection, timeout archive download and count, Saved boards list/replay, and fresh random restart.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
