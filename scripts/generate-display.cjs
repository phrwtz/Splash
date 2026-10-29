// Offline only: generate 100 distinct, balanced deals and record verified solutions.
const fs = require('node:fs');
const {solve} = require('../search.js');
const names = ['white','red','blue','purple','yellow','orange','green'];
const cells = []; for(let r=0;r<8;r++) for(let c=0;c<(r%2?7:8);c++) cells.push([r,c]);
const adj = cells.map(([r,c])=>cells.flatMap(([s,d],i)=>((2*c+r%2)-(2*d+s%2))**2+3*(r-s)**2===4?[i]:[]));
// Fixed seed makes the sequence of candidate deals reproducible.
let seed=20261029;
function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
function pathBetween(b,start,end){
 const queue=[[start]],seen=new Set([start]);
 for(const path of queue){const i=path[path.length-1];if(i===end)return path;
  for(const j of adj[i])if(!seen.has(j) && (b[j]===b[i] || (b[i]===b[start] && b[j]===b[end]))){seen.add(j);queue.push([...path,j]);}}
 throw Error('No legal animation path');
}
const boards=[],seen=new Set();let attempts=0;
while(boards.length<100){
 const tiles=Array.from({length:60},(_,i)=>['red','blue','yellow'][i%3]);
 for(let i=59;i>0;i--){const j=Math.floor(random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}
 attempts++;if(seen.has(tiles.join(',')))continue;
 const g=solve(tiles,adj,{hybrid:true}),moves=[];let current=tiles.slice(),step,elapsed=0;
 try {for(;;){const start=performance.now();step=g.next();elapsed+=performance.now()-start;
  if(elapsed>3000)break;if(step.done)break;
  const e=step.value;if(e.type!=='forward')continue;
  if(JSON.stringify(e.before)!==JSON.stringify(current))throw Error('Unexpected board');
  const from=e.sourceIndex,to=e.targetIndex,path=pathBetween(current,from,to);
  const a=names.indexOf(current[from]),b=names.indexOf(current[to]);
  if(!a||!b||(a&b))throw Error('Illegal mix');
  current[from]='white';current[to]=names[(a|b)===7?0:a|b];
  if(JSON.stringify(current)!==JSON.stringify(e.after))throw Error('Incorrect move');
  moves.push({from,to,path,source:e.before[from],result:current[to]});
 }}finally{g.return();}
 if(step.done&&step.value==='solved'&&current.every(c=>c==='white')&&moves.length===40){
  seen.add(tiles.join(','));boards.push({tiles,moves});console.log(`Recorded ${boards.length}/100 (${attempts} attempts)`);
 }
}
// Replace the collection only after all 100 recordings are complete.
fs.writeFileSync('Display/recordings.js','// Generated offline by scripts/generate-display.cjs. No runtime solver needed.\nwindow.SPLASH_RECORDINGS = '+JSON.stringify(boards)+';\n');
