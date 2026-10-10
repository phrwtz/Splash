const {adj}=require('./bottleneck.cjs');
const board=['........','.......','.....P..','Y..G.PG','RYB.R.R.','YYBPRR.','BRRYBBB.','YRYYY..']
 .join('').split('').map(c=>({'.':'white',R:'red',B:'blue',Y:'yellow',P:'purple',G:'green'}[c]));
module.exports={board,adj};
if(require.main===module)require('./planning-benchmark.cjs').verifyFixture(board,adj);
