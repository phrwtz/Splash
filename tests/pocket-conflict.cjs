// Screenshots use one-based (row, column) coordinates; arrays are zero-based.
const {adj}=require('./bottleneck.cjs');
const fromRows=rows=>rows.join('').split('').map(c=>({
  '.':'white',R:'red',B:'blue',Y:'yellow',O:'orange',G:'green'
}[c]));
const board=fromRows([
  '........','.......','......YB','......Y',
  '......BR','..RBY.Y','..BBRBRR','.RBOYY.'
]);
const earlier=fromRows([
  '....R...','...BB..','....GRB.','....B.R',
  '....B...','.RRRY..','.YYOBYB.','RRY.YG.'
]);
// A legal red (6,6) -> yellow (8,4) blob transfer creates `board`.
// Keeping this red instead supplies a bypass and the predecessor is solvable.
const before=board.slice();before[43]='red';before[56]='yellow';
module.exports={board,earlier,before,adj,source:43,target:56};
