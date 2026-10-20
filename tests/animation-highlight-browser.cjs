const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const p=await browser.newPage();await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);
 await p.evaluate(()=>{autoPlayState.active=true;autoPlayState.searchGroup=[0,1];state.tiles[0]=state.tiles[1]='red';autoPlayState.displayMode='animate';renderInnerTiles();});
 assert.equal(await p.locator('.search-selected').count(),0);
 await p.evaluate(()=>{autoPlayState.displayMode='process';renderInnerTiles();});
 assert.equal(await p.locator('.search-selected').count(),2);
 await p.evaluate(()=>{autoPlayState.displayMode='none';renderInnerTiles();});
 await p.evaluate(()=>{autoPlayState.displayMode='animate';renderInnerTiles();});
 assert.equal(await p.locator('.search-selected').count(),0);
 console.log('Passed animation without group outlines and preserved process selection.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
