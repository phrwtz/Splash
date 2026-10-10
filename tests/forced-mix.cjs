const {adj}=require('./bottleneck.cjs');
const rows=[
  '........','....R..','....B...','....P..',
  'BY..YP..','GB.RYRY','BRRBYR..','.YYRBY.'
];
const board=rows.join('').split('').map(c=>({
  '.':'white',R:'red',B:'blue',Y:'yellow',P:'purple',G:'green'
}[c]));
module.exports={board,adj,source:12,target:19};
