// The two user-provided hex boards; row/column coordinates are zero-based.
const cells=[];
for(let r=0;r<8;r++)for(let c=0;c<(r%2?7:8);c++)cells.push([r,c]);
const adj=cells.map(([r,c])=>cells.flatMap(([s,d],i)=>(r===s
  ? Math.abs(c-d)===1
  : Math.abs(r-s)===1 && (r%2?[c,c+1]:[c-1,c]).includes(d))?[i]:[]));
const fromRows=rows=>cells.map(([r,c])=>({'.':0,B:2,Y:4,R:1}[rows[r][c]]));
const good=fromRows(['BB......','.YY....','.YYYB...','...BBR.','....RRR.','.....R.','........','.......']);
const bad=fromRows(['BB......','.YY....','.YYY....','...BBR.','....RRR.','.....RB','........','.......']);
// Legal blob move (3,5) -> (4,6) creates purple and forces the conflict.
const source=19,target=28,after=good.slice();after[source]=0;after[target]=3;
module.exports={good,bad,adj,source,target,after};
