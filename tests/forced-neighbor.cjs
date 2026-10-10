const {adj}=require('./bottleneck.cjs');
const rows=[
  '..BRBG..','...BRB.','....RBY.','..BYB.B',
  '.RBRBR..','YYRRYRY','YBYRRRY.','YRYY.B.'
];
const board=rows.join('').split('').map(c=>({
  '.':'white',R:'red',B:'blue',Y:'yellow',G:'green'
}[c]));
module.exports={board,adj,source:29,target:21};
