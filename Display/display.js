/* Recorded playback only. No search, workers, game state, or archive downloads. */
(function () {
  'use strict';
  var recordings = window.SPLASH_RECORDINGS;
  var svg = document.getElementById('board');
  var ns = 'http://www.w3.org/2000/svg';
  var colors = {red:'#d94037',blue:'#2763d8',yellow:'#f0c419',purple:'#b45be7',green:'#1fb85f',orange:'#f68b2d',white:'#ffffff'};
  var radius = 34, innerRadius = 24, width = Math.sqrt(3) * radius, padding = 44;
  var boardWidth = padding * 2 + width * 8.5;
  var boardHeight = padding * 2 + radius * 2 + 51 * 7;
  var centers = [], tiles = [];
  svg.setAttribute('viewBox', '0 0 ' + boardWidth + ' ' + boardHeight);

  function polygon(cx, cy, size, className) {
    var points = [];
    for (var i=0; i<6; i++) {
      var angle = (60*i-90)*Math.PI/180;
      points.push((cx+size*Math.cos(angle))+','+(cy+size*Math.sin(angle)));
    }
    var node = document.createElementNS(ns, 'polygon');
    node.setAttribute('points', points.join(' '));
    node.setAttribute('class', className);
    return node;
  }
  // Create the board once; playback changes just two fills and one transform.
  for (var row=0; row<8; row++) {
    for (var col=0; col<(row%2?7:8); col++) {
      var x=padding+width/2+(row%2?width/2:0)+col*width;
      var y=padding+radius+row*51;
      centers.push({x:x,y:y});
      svg.appendChild(polygon(x,y,radius,'outer'));
      var tile=polygon(x,y,innerRadius,'recorded-tile');
      tile.setAttribute('fill', colors.white);
      svg.appendChild(tile); tiles.push(tile);
    }
  }
  var moving=polygon(0,0,innerRadius,'moving-tile');
  moving.setAttribute('visibility','hidden'); svg.appendChild(moving);

  function resize() {
    var wrap=document.querySelector('.board-wrap');
    var availableHeight=Math.max(40,window.innerHeight-wrap.getBoundingClientRect().top-36);
    var availableWidth=Math.max(40,window.innerWidth-48);
    svg.style.setProperty('--display-board-width',Math.floor(Math.min(availableWidth,availableHeight*boardWidth/boardHeight))+'px');
  }
  window.addEventListener('resize',resize); resize();
  function pause(ms) { return new Promise(function(resolve){window.setTimeout(resolve,ms);}); }
  function animate(move) {
    var path=move.path.map(function(i){return centers[i];});
    var duration=Math.max(500,path.length*180);
    tiles[move.from].setAttribute('fill',colors.white);
    moving.setAttribute('fill',colors[move.source]);
    moving.setAttribute('transform','translate('+path[0].x+' '+path[0].y+')');
    moving.setAttribute('visibility','visible');
    return new Promise(function(resolve){
      var start=null;
      function frame(now) {
        if(start===null)start=now;
        var progress=Math.min(1,(now-start)/duration);
        var position=progress*(path.length-1);
        var segment=Math.min(path.length-2,Math.floor(position));
        var fraction=position-segment;
        var a=path[segment],b=path[segment+1];
        moving.setAttribute('transform','translate('+(a.x+(b.x-a.x)*fraction)+' '+(a.y+(b.y-a.y)*fraction)+')');
        if(progress<1)window.requestAnimationFrame(frame);
        else {
          moving.setAttribute('visibility','hidden');
          tiles[move.to].setAttribute('fill',colors[move.result]);
          resolve();
        }
      }
      window.requestAnimationFrame(frame);
    });
  }
  async function play() {
    if(!Array.isArray(recordings)||!recordings.length)throw Error('The recorded boards could not be loaded. Please reload the display.');
    for(var index=0;;index=(index+1)%recordings.length) {
      var board=recordings[index];
      svg.setAttribute('data-board-index',String(index));
      svg.setAttribute('data-move-index','0');
      board.tiles.forEach(function(color,i){tiles[i].setAttribute('fill',colors[color]);});
      await pause(1500);
      for(var m=0;m<board.moves.length;m++) {
        await animate(board.moves[m]);
        svg.setAttribute('data-move-index',String(m+1));
        await pause(250);
      }
      await pause(3000);
    }
  }
  play().catch(function(error){
    var message=document.getElementById('playback-error');
    message.textContent=error.message;message.hidden=false;
  });
}());
