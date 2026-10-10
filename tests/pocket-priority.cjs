const assert=require('node:assert/strict'),{solve}=require('../search.js');
const {adj}=require('./bottleneck.cjs');
const names=['white','red','blue','purple','yellow','orange','green'];
const board=['........','YB.....','.B..R...','.R.RBB.','..RBRBB.','..O.YRY','..RYYYB.','.GG.YRR']
 .join('').split('').map(c=>({'.':0,R:1,B:2,Y:4,G:6,O:5}[c]));
module.exports={board:board.map(c=>names[c]),adj};
if(require.main===module)require('./planning-benchmark.cjs').verifyFixture(module.exports.board,adj);
