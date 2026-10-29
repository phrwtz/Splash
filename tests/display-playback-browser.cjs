const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(()=>{
   window.Worker=function(){throw Error('Playback must never create a worker');};
   let tick=0;const timer=window.setTimeout.bind(window);
   window.setTimeout=(fn,ms)=>timer(fn,Math.min(ms,1));
   window.requestAnimationFrame=fn=>timer(()=>fn(tick+=1000),1);
   window.completed=[];
   window.addEventListener('DOMContentLoaded',()=>{
    const svg=document.getElementById('board');
    new MutationObserver(records=>{
     for(const r of records)if(r.attributeName==='data-move-index'&&svg.getAttribute('data-move-index')==='40'){
      const tiles=[...svg.querySelectorAll('.recorded-tile')];
      completed.push({index:Number(svg.getAttribute('data-board-index')),clear:tiles.every(t=>t.getAttribute('fill')==='#ffffff')});
     }
    }).observe(svg,{attributes:true});
   });
  });
  await page.goto(pathToFileURL(path.join(__dirname,'../Display/index.html')).href);
  await page.waitForFunction(()=>completed.length>=101,{},{timeout:120000});
  const completed=await page.evaluate(()=>window.completed.slice(0,101));
  assert.deepEqual(completed.map(b=>b.index),[...Array(100).keys(),0]);
  assert(completed.every(b=>b.clear));
  assert.equal(await page.locator('h1').innerText(),'Solving Splash Boards');
  assert.equal(await page.locator('.display-subtitle span').count(),3);
  assert(!requests.some(u=>/\/(search|app)\.js/.test(u)));
  assert.equal(await page.locator('#playback-error').isVisible(),false);
  assert(!/Solved:|Proved unsolvable|Timed out:|Session:|Current search:/.test(await page.locator('body').innerText()));
  const rect=await page.locator('.board-wrap').boundingBox();assert(rect.y+rect.height<=1080);assert(rect.x>=0&&rect.x+rect.width<=1920);
  assert.deepEqual(errors,[]);
  console.log('PASS: browser played all 100 solutions, wrapped to board 1 and cleared it again; no solver, workers, statistics, or browser errors; 1080p layout fits.');
  // Capture the ordinary-speed opening, including its title and board.
  const preview=await browser.newPage({viewport:{width:1920,height:1080}});
  await preview.goto(pathToFileURL(path.join(__dirname,'../Display/index.html')).href);
  await preview.screenshot({path:'/tmp/splash-display-preview.png'});
  await preview.setViewportSize({width:1280,height:720});
  await preview.waitForFunction(()=>document.querySelector('.board-wrap').getBoundingClientRect().bottom<=window.innerHeight);
  const small=await preview.locator('.board-wrap').boundingBox();assert(small.y+small.height<=720);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
