// Fixed ordered frontiers from the pre-optimization engine on seeded synthetic graphs.
// Test data only: no Splash deals, solutions, openings, or production lookup.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function engine(file){let s=fs.readFileSync(file,'utf8').replace('return {solve,assess,exportProofCache,restoreProofCache}','return {solve,beamSolve,assess,exportProofCache,restoreProofCache}').replace('frontier=heap.sort((a,b)=>b.score-a.score);','frontier=heap.sort((a,b)=>b.score-a.score);globalThis.traces.push(frontier.map(n=>[n.board.slice(),n.score]));if(globalThis.traces.length===4)return "unknown";').replace('frontier.slice(0,16)','frontier.slice(0,0)');const c={module:{exports:{}},traces:[]};vm.runInNewContext(s,c);return c;}
const path=require('node:path'),cases=require('./beam-frontier-baseline.json');
for(const [trial,b] of cases.entries()){
 const c=engine(path.join(__dirname,'..','search.js')),g=c.module.exports.beamSolve(b.tiles,b.adjacency,b.configuration);
 let steps=0;while(!g.next().done)assert(++steps<200000);
 assert.equal(JSON.stringify(c.traces),JSON.stringify(b.frontiers),`ordered frontier and exact floating-point scores, case ${trial}`);
}
console.log(`PASS: ${cases.length} synthetic graphs preserve baseline beam selection, board order, and exact scores through four layers.`);
