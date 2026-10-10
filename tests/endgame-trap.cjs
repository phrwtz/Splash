const {adj}=require('./bottleneck.cjs');
const board=['........','.......','..RB..O.','...BPY.','....BRR.','...RR.Y','....BYYB','....YBY']
 .join('').split('').map(c=>({'.':'white',R:'red',B:'blue',Y:'yellow',O:'orange',P:'purple'}[c]));
module.exports={board,adj};
