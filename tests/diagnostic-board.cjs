// Latest screenshot: solved offline but missed by bridge-only Auto Play.
const rows=['RBYRBRRY', 'BBBYYBR', 'RYRYRBYY', 'YYYRRBB', 'BRBRYBYR', 'YRBRBYB', 'RYRYBRBB', 'RYYYRBB'];
const board=rows.join('').split('').map(c=>({R:'red',B:'blue',Y:'yellow'}[c]));
const {adj}=require('./interacting-bridge-board.cjs');
module.exports={rows,board,adj};
