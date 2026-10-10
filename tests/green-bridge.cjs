// September 29 screenshot. Coordinates in the report are one-based.
const {adj}=require('./bottleneck.cjs');
const board=['........','.......','....GB..','....Y.Y',
 '..Y.B.RR','BRRGBRR','YRYRB.R.','YYBB...']
 .join('').split('').map(c=>({'.':'white',R:'red',B:'blue',Y:'yellow',G:'green'}[c]));
module.exports={board,adj};
if(require.main===module)require('./planning-benchmark.cjs').verifyFixture(module.exports.board,adj,{expected:'unsolvable'});
