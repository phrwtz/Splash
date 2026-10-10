// September 28 screenshot: silent recovery used to retain Backtracking….
const {adj}=require('./bottleneck.cjs');
const board=['........','.......','..O.....','..RRBYB','.R.RRBY.','Y.R.BYY','.YYB.BYB','RBRB...']
 .join('').split('').map(c=>({'.':'white',R:'red',B:'blue',Y:'yellow',O:'orange'}[c]));
module.exports={board,adj};
