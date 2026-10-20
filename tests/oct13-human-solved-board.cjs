// User solved by building an orange bridge and preserving balance during blue clearances.
const rows=['RRYRRBYR','YRYBBYB','RBYRYRBY','YRRBYBB','YRBYYBYY','RRRRRYB','BYBBYYBY','BRRRBBB'];const board=rows.join('').split('').map(c=>({R:'red',B:'blue',Y:'yellow'}[c]));const {adj}=require('./oct13-board.cjs');module.exports={rows,board,adj};
