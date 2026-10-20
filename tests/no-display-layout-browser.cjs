const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
for(const width of [480,900,1200]){
const p=await browser.newPage({viewport:{width,height:900}});await p.goto(require('node:url').pathToFileURL(require('node:path').join(__dirname,'..','index.html')).href);
const rects=await p.evaluate(()=>{
 autoPlayState.active=true;autoPlayState.displayMode='none';autoPlayState.session={startedAt:performance.now(),endedAt:null,solved:1085,unsolvable:0,unknown:0,maxSolveMs:132000};
 const rects=[];
 for(let i=0;i<12;i++){
  autoPlayState.message=i%2?'Solution found!':'Complete search — five-minute limit… '+ 'Checking search branches and cached failures. '.repeat(12);
  autoPlayState.session.solved=1085+i;
  autoPlayState.searchComputeMs=i%2?132000:0;
  state.tiles=i%2?Array(60).fill('white'):[...state.initialTiles];
  render();
  const {x,y,width,height}=gameBoardWrap.getBoundingClientRect();rects.push({x,y,width,height});
 }
 return rects;
});
for(const rect of rects)assert.deepEqual(rect,rects[0],`Board moved at viewport ${width}`);
await p.setViewportSize({width:width+100,height:1000});await p.waitForTimeout(100);
const resized=await p.locator('.board-layout .board-wrap').boundingBox();assert.notEqual(resized.width,rects[0].width,'Window resize must still resize the board');
await p.evaluate(()=>{autoPlayState.active=false;render();});assert.equal(await p.locator('#game-screen').evaluate(el=>el.classList.contains('auto-play-no-display')),false);
await p.close();
}
console.log('PASS: board position and size remain fixed across repeated search/solution/deal transitions at 480, 900, and 1200 pixels; window resizing and stopping still work.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
