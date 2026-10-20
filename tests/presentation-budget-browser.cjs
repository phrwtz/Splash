const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});try{
 const p=await browser.newPage();await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);await p.clock.install();await p.clock.pauseAt(new Date());
 await p.evaluate(()=>{const now=performance.now();window.base=now;autoPlayState.active=true;autoPlayState.phase='search';autoPlayState.displayMode='process';autoPlayState.searchComputeMs=0;autoPlayState.searchStartedAt=now;autoPlayState.searchPausedMs=0;autoPlayState.session={startedAt:now,endedAt:null,solved:0,unsolvable:0,unknown:0};window.viewPause=pauseAutoPlayPresentation(500);});
 await p.clock.runFor(250);assert.equal(await p.evaluate(()=>autoPlayInterrupted()),false);
 await p.evaluate(()=>renderAutoPlaySession());assert.equal(await p.locator('#auto-play-search-elapsed').textContent(),'0.00 seconds');
 await p.clock.runFor(250);assert(await p.evaluate(()=>viewPause));
 assert.equal(await p.evaluate(()=>autoPlayState.searchPausedMs),500);assert.equal(await p.evaluate(()=>autoPlayState.searchComputeMs),0);
 await p.clock.runFor(999);assert.equal(await p.evaluate(()=>autoPlayInterrupted()),false);
 await p.clock.runFor(1);assert.equal(await p.evaluate(()=>autoPlayInterrupted()),false);
 await p.evaluate(()=>renderAutoPlaySession());assert.equal(await p.locator('#auto-play-search-elapsed').textContent(),'0.00 seconds');
 console.log('Passed display-pause exclusion, search-timer freeze, and unchanged computation deadline.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
