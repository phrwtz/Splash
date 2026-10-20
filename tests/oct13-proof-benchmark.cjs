// A bounded diagnostic, not an assertion of solvability or impossibility.
const {solve}=require('../search.js'),{board,adj}=require('./oct13-board.cjs');
const budgetMs=Number(process.env.BENCHMARK_MS||40000);
if(!Number.isFinite(budgetMs)||budgetMs<=0)throw Error('BENCHMARK_MS must be positive');
const g=solve(board,adj,{moveTreeSearch:true,strategyStates:0,sectionStates:0,bridgeStates:0});
const start=Date.now();let step,last;
try{while(!(step=g.next()).done){last=step.value;if(Date.now()-start>=budgetMs)break;}}
finally{g.return();}
console.log(JSON.stringify({elapsedMs:Date.now()-start,result:step.done?step.value:'unresolved',positions:last?.positions,cache:last?.cacheEntries,proofStats:last?.proofStats}));
