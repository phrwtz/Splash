const {adj}=require('./bottleneck.cjs');
const board=['........','OOY....','..BY....','..Y....','YYRRB...','RBGB...','RRGYYBR.','BRRBPB.']
 .join('').split('').map(c=>({'.':'white',R:'red',B:'blue',Y:'yellow',O:'orange',P:'purple',G:'green'}[c]));
module.exports={board,adj};
