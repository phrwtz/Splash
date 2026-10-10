const {adj}=require('./bottleneck.cjs');
const rows=[
  '.Y....R.','B....RB','.B.....B','OY....R',
  '.BB.BRRY','OYGR.G.','.YYR.G..','BRYBRR.'
];
const board=rows.join('').split('').map(c=>({
  '.':'white',R:'red',B:'blue',Y:'yellow',O:'orange',G:'green'
}[c]));
module.exports={board,adj};
