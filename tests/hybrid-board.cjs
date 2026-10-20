// User-solved board requiring grouped bridge construction.
const rows=['BYBRBYBB','BYRRYRR','YBYRBRYB','YYYBRBR','BYBYRYRR','YYRRBYR','YRBBRBRY','BBYRBYR'];
const board=rows.join('').split('').map(c=>({R:'red',B:'blue',Y:'yellow'}[c]));
const cells=[];for(let r=0;r<8;r++)for(let c=0;c<(r%2?7:8);c++)cells.push([r,c]);
const adj=cells.map(([r,c])=>cells.flatMap(([s,d],i)=>(r===s?Math.abs(c-d)===1:Math.abs(r-s)===1&&(r%2?[c,c+1]:[c-1,c]).includes(d))?[i]:[]));
module.exports={board,adj};
