const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const p=await browser.newPage();await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);await p.clock.install();await p.clock.pauseAt(new Date());
 await p.evaluate(()=>{window.workClock=0;performance.now=()=>workClock;autoPlayState.active=true;autoPlayState.phase='search';autoPlayState.searchComputeMs=0;autoPlayState.session={startedAt:0,endedAt:null,solved:0,unknown:0,unsolvable:0};SplashSearch.solve=function*(){for(let i=0;i<10;i++){workClock+=1000;yield {type:'search'};}};window.timed=createAutoPlayTimedSearch([],[],{});timed.next();});
 assert.equal(await p.evaluate(()=>autoPlayState.searchComputeMs),1000);
 await p.evaluate(()=>{workClock+=600000;renderAutoPlaySession();});assert.equal(await p.evaluate(()=>autoPlayInterrupted()),false);assert.equal(await p.locator('#auto-play-search-elapsed').textContent(),'1.00 seconds');
 await p.evaluate(()=>timed.next());assert.equal(await p.evaluate(()=>autoPlayState.searchComputeMs),2000);
 await p.evaluate(()=>{autoPlayState.searchComputeMs=299000;timed.next();});assert.equal(await p.evaluate(()=>autoPlayInterrupted()),false);
 // Worker reports are cumulative and must be charged once before queue consumption.
 await p.evaluate(()=>{autoPlayState.searchComputeMs=0;window.NativeWorker=Worker;window.Worker=class {constructor(){window.worker=this;}postMessage(data){this.request=data;}terminate(){}};window.prefetch=createAutoPlayPrefetch([],[],[]);worker.onmessage({data:{kind:'event',computeMs:1200,event:{type:'search'}}});worker.onmessage({data:{kind:'event',computeMs:1500,event:{type:'search'}}});worker.onmessage({data:{kind:'event',computeMs:1500,event:{type:'search'}}});});
 assert.equal(await p.evaluate(()=>autoPlayState.searchComputeMs),1500);await p.evaluate(()=>prefetch.next());assert.equal(await p.evaluate(()=>autoPlayState.searchComputeMs),1500);assert.equal(await p.evaluate(()=>worker.request.options.hybrid),true);await p.evaluate(()=>prefetch.return());
 // Exercise real worker accounting without a computation cutoff.
 await p.evaluate(()=>{Worker=NativeWorker;autoPlayState.searchComputeMs=299990;createSplashSearch=()=>({solve:function*(){for(;;){const started=performance.now();while(performance.now()-started<6){}yield {type:'search'};}}});window.realPrefetch=createAutoPlayPrefetch([],[],[]);});
 await p.waitForFunction(()=>autoPlayState.searchComputeMs>=300000);
 await p.evaluate(()=>realPrefetch.return());
 await p.evaluate(()=>{autoPlayState.stopRequested=true;});assert.equal(await p.evaluate(()=>autoPlayInterrupted()),true);
 console.log('Passed scheduling exclusion, computation timer and unlimited complete search, worker cumulative accounting, and Stop.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
