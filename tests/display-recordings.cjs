const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../Display/recordings.js'),'utf8'),context);
const boards=JSON.parse(JSON.stringify(context.window.SPLASH_RECORDINGS));
assert.equal(boards.length,100);
assert.equal(new Set(boards.map(b=>b.tiles.join(','))).size,100);
const names=['white','red','blue','purple','yellow','orange','green'];
const cells=[];for(let r=0;r<8;r++)for(let c=0;c<(r%2?7:8);c++)cells.push([r,c]);
const adj=cells.map(([r,c])=>cells.flatMap(([s,d],i)=>(r===s?Math.abs(c-d)===1:Math.abs(r-s)===1&&(r%2?[c,c+1]:[c-1,c]).includes(d))?[i]:[]));
for(const board of boards){
 assert.equal(board.tiles.length,60);assert.equal(board.moves.length,40);
 for(const color of ['red','blue','yellow'])assert.equal(board.tiles.filter(c=>c===color).length,20);
 const b=board.tiles.slice();
 const blob=i=>{const q=[i],seen=new Set(q);for(const x of q)for(const y of adj[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 for(const move of board.moves){
  const {from,to,path,source,result}=move,a=names.indexOf(b[from]),c=names.indexOf(b[to]);
  assert(a>0&&c>0&&!(a&c));assert.equal(source,b[from]);
  const sources=new Set(blob(from)),targets=new Set(blob(to));
  assert([...sources].some(x=>adj[x].some(y=>targets.has(y))));
  assert.equal(path[0],from);assert.equal(path.at(-1),to);assert(path.length>=2);
  let crossed=false;
  path.forEach((p,i)=>{assert(sources.has(p)||targets.has(p));if(targets.has(p))crossed=true;else assert(!crossed);if(i)assert(adj[path[i-1]].includes(p));});
  b[from]='white';b[to]=names[(a|c)===7?0:a|c];assert.equal(result,b[to]);
 }
 assert(b.every(c=>c==='white'));
}
console.log('PASS: 100 unique balanced boards, 4,000 legal recorded moves and animation paths, every board completely cleared.');
