const {adj}=require('./bottleneck.cjs');
const board=['RR.YRYY.','YRBYRR.','.YYRYRYB','Y.RPRBY','.GGYPBYB','.YBB..R','..PBB...','..PPRG.'].join('').split('').map(c=>({'.':'white',R:'red',Y:'yellow',B:'blue',P:'purple',G:'green'}[c]));
module.exports={board,adj};
if(require.main===module)require('./planning-benchmark.cjs').verifyFixture(module.exports.board,adj,{});
