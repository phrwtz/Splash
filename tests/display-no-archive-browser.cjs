const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 try {
  const page=await browser.newPage(),downloads=[],errors=[];
  page.on('download',d=>downloads.push(d.suggestedFilename()));page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const read=Storage.prototype.getItem;window.archiveReads=0;
   Storage.prototype.getItem=function(key){if(key==='splash.timedOutBoards.v1')archiveReads++;return read.call(this,key);};
  });
  await page.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','Display','index.html')).href);
  await page.evaluate(()=>{autoPlayState.stopRequested=true;});
  await page.waitForFunction(()=>!autoPlayState.active);
  assert.equal(await page.evaluate(()=>archiveReads),0);
  await page.evaluate(async()=>{
   window.Worker=undefined;
   window.testBoards=0;
   SplashSearch.solve=function*(){return ++testBoards%2?'unknown':'unsolvable';};
   // Preserve a task boundary but avoid real result-presentation delays.
   pauseAutoPlay=async()=>{await new Promise(r=>setTimeout(r,0));if(testBoards>=40)autoPlayState.stopRequested=true;return !autoPlayState.stopRequested;};
   autoPlayState.session=null;
   await saveTimedOutBoard();await saveTimedOutBoard('unsolvable');await writeBoardArchive();
   void runAutoPlay();
  });
  await page.waitForFunction(()=>testBoards>=40&&!autoPlayState.active);
  const result=await page.evaluate(()=>({saved:savedTimedOutBoards.length,rows:document.querySelectorAll('.saved-timeout-row').length,timedOut:autoPlayState.session.unknown,unsolvable:autoPlayState.session.unsolvable}));
  assert.deepEqual(result,{saved:0,rows:0,timedOut:20,unsolvable:20});
  assert.deepEqual(downloads,[]);assert.deepEqual(errors,[]);
  console.log('PASS: 40 failed Display boards counted with no archive reads, retained boards, archive rows, downloads, or errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
