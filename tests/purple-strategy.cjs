const {adj}=require('./bottleneck.cjs');
const board=['....P..Y','YPPR..R','.P..RBOB','Y.O.BY.','BYRBRRY.','BYBBYY.','RBYOB.O.','BY.....']
 .join('').split('').map(c=>({'.':'white',R:'red',B:'blue',Y:'yellow',P:'purple',O:'orange'}[c]));
module.exports={board,adj};
