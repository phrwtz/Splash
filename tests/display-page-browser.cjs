const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});try {
const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','Display','index.html')).href);
await p.waitForFunction(()=>autoPlayState.active);
assert.equal(await p.evaluate(()=>autoPlayState.searchLimitMs),60000);
assert.equal(await p.evaluate(()=>autoPlayState.displayMode),'animate');
assert.equal(await p.locator('.controls').isVisible(),false);
assert.equal(await p.locator('#game-subtitle').isVisible(),false);
assert.equal(await p.locator('input:visible,textarea:visible,button:visible').count(),0);
assert(await p.locator('#board').isVisible());assert(await p.locator('#auto-play-status').isVisible());
assert.equal(await p.locator('.auto-play-stats > span:visible').count(),6);
await p.waitForTimeout(5000);assert.deepEqual(errors,[]);
await p.setViewportSize({width:390,height:844});
assert(await p.locator('#auto-play-status').isVisible());
assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
console.log('PASS: automatic animated startup, one-minute limit, board and full live statistics, hidden controls, no browser errors.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
