const assert=require('node:assert/strict'),{solve}=require('../search.js');
const {adj}=require('./bottleneck.cjs');
const names=['white','red','blue','purple','yellow','orange','green'];
const board=['.....RR.','....BBR','.....BRB','....B.B','..YBYYBR','.YRYYRB','..YYYRBB','..YRYRR']
 .join('').split('').map(c=>({'.':0,R:1,B:2,Y:4}[c]));
module.exports={board:board.map(c=>names[c]),adj};
if(require.main===module)require('./planning-benchmark.cjs').verifyFixture(module.exports.board,adj,{});
