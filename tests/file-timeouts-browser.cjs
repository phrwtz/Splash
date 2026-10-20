const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href;await page.goto(url);
await page.evaluate(()=>{
window.disk='';window.failWrite=false;window.NativeWorker=Worker;
window.handle={name:'test.json',getFile:async()=>({text:async()=>disk}),requestPermission:async()=> 'granted',createWritable:async()=>({write:async text=>{if(failWrite)throw Error('disk full');disk=text},close:async()=>{},abort:async()=>{}})};
window.showSaveFilePicker=async()=>handle;window.showOpenFilePicker=async()=>[handle];
});
await page.evaluate(()=>chooseBoardArchive(false));
assert.equal(await page.evaluate(()=>JSON.parse(disk).format),'splash-boards-v1');
await page.clock.install();await page.clock.pauseAt(new Date());
await page.evaluate(()=>{Worker=undefined;window.deal=[...state.initialTiles];SplashSearch.solve=function*(){for(;;)yield {type:'search'};};autoPlayState.displayMode='none';autoPlayState.animate=false;window.run=runAutoPlay();});
await page.evaluate(()=>autoPlayState.searchComputeMs=300000);await page.clock.runFor(150);
assert.equal(await page.evaluate(()=>autoPlayState.session.unknown),1);
assert.equal(await page.evaluate(()=>JSON.parse(disk).boards.length),1);
assert.deepEqual(await page.evaluate(()=>JSON.parse(disk).boards[0].tiles),await page.evaluate(()=>deal));
assert.equal(await page.locator('#auto-play-unknown').isVisible(),true);
await page.clock.runFor(150);assert.equal(await page.evaluate(()=>autoPlayState.active),true);
assert(await page.evaluate(()=>autoPlayState.searchComputeMs<300000));
await page.evaluate(()=>autoPlayState.stopRequested=true);await page.clock.runFor(100);
// Exercise a pending real worker: the cancellation poll must unblock next().
await page.evaluate(()=>{
 Worker=NativeWorker;
 createSplashSearch=function(){return {restoreProofCache(){},exportProofCache(){return null},solve:function*(){for(;;)yield {type:'search'};}}};
 autoPlayState.animate=false;window.workerRun=runAutoPlay();
});
await page.evaluate(()=>autoPlayState.searchComputeMs=300000);
await page.clock.runFor(200);
assert.equal(await page.evaluate(()=>autoPlayState.session.unknown),2);
await page.evaluate(()=>autoPlayState.stopRequested=true);await page.clock.runFor(100);
const disk=await page.evaluate(()=>disk);await page.reload();
await page.evaluate(contents=>{window.disk=contents;window.handle={name:'test.json',getFile:async()=>({text:async()=>disk}),requestPermission:async()=> 'granted',createWritable:async()=>({write:async text=>{disk=text},close:async()=>{},abort:async()=>{}})};window.showOpenFilePicker=async()=>[handle];window.showSaveFilePicker=async()=>handle;},disk);
await page.evaluate(()=>chooseBoardArchive(true));assert.equal(await page.evaluate(()=>savedTimedOutBoards.length),2);
await page.evaluate(async()=>{selectedTimedOutBoards.add(savedTimedOutBoards[0]);await playSelectedTimedOutBoard();});
assert.deepEqual(await page.evaluate(()=>state.tiles),JSON.parse(disk).boards[0].tiles);
await page.evaluate(()=>{savedBoardsFile.createWritable=async()=>{throw Error('disk full')};Worker=undefined;SplashSearch.solve=function*(){return 'unsolvable'};autoPlayState.animate=false;window.run=runAutoPlay();});
await page.waitForFunction(()=>!autoPlayState.active);
assert.match(await page.evaluate(()=>autoPlayState.message),/File save failed.*disk full/);
assert.deepEqual(errors,[]);console.log('PASS: timeout count, file contents, next board, Stop, reopen, replay, real worker cancellation, and disk failure');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
