/** @typedef {'red'|'blue'|'yellow'|'purple'|'green'|'orange'|'white'} TileColor */

const ROW_LENGTHS = [8, 7, 8, 7, 8, 7, 8, 7];
const PRIMARY_COLORS = new Set(['red', 'blue', 'yellow']);
const SVG_NS = 'http://www.w3.org/2000/svg';

const HEX_RADIUS = 34;
const INNER_RADIUS = 24;
const HEX_WIDTH = Math.sqrt(3) * HEX_RADIUS;
const ROW_SPACING = 1.5 * HEX_RADIUS;
const BOARD_PADDING = HEX_RADIUS + 10;

const COLOR_HEX = {
  red: '#d94037',
  blue: '#2763d8',
  yellow: '#f0c419',
  purple: '#7a3db8',
  green: '#2fa36b',
  orange: '#e18223',
  white: '#ffffff'
};

const MIX_RESULTS = {
  'blue:red': 'purple',
  'red:blue': 'purple',
  'yellow:red': 'orange',
  'red:yellow': 'orange',
  'blue:yellow': 'green',
  'yellow:blue': 'green'
};

/** @typedef {{index:number,row:number,col:number,cx:number,cy:number}} TileMeta */

/**
 * @typedef {Object} DragState
 * @property {number|null} sourceIndex
 * @property {TileColor|null} sourceColor
 * @property {number} startPointerX
 * @property {number} startPointerY
 * @property {number} pointerX
 * @property {number} pointerY
 * @property {number|null} hoverTarget
 * @property {number} containmentRatio
 * @property {number} overlapRatio
 */

/**
 * @typedef {Object} GameState
 * @property {TileColor[]} tiles
 * @property {TileColor[]} initialTiles
 * @property {DragState} dragState
 */

const boardSvg = document.getElementById('board');
const resetBtn = document.getElementById('reset-btn');
const newBoardBtn = document.getElementById('new-board-btn');

const tilesMeta = buildTileMeta();
const indexByRowCol = new Map(tilesMeta.map((tile) => [keyOf(tile.row, tile.col), tile.index]));

const boardPixelWidth = BOARD_PADDING * 2 + HEX_WIDTH * 8.5;
const boardPixelHeight = BOARD_PADDING * 2 + HEX_RADIUS * 2 + ROW_SPACING * (ROW_LENGTHS.length - 1);
boardSvg.setAttribute('viewBox', `0 0 ${boardPixelWidth} ${boardPixelHeight}`);

const outerLayer = createSvgEl('g', { id: 'outer-layer' });
const innerLayer = createSvgEl('g', { id: 'inner-layer' });
const previewLayer = createSvgEl('g', { id: 'preview-layer' });
const dragLayer = createSvgEl('g', { id: 'drag-layer' });
boardSvg.append(outerLayer, innerLayer, previewLayer, dragLayer);

/** @type {GameState} */
const state = {
  tiles: createShuffledBoard(),
  initialTiles: [],
  dragState: createEmptyDragState()
};
state.initialTiles = [...state.tiles];

initializeBoardStatic();
render();

boardSvg.addEventListener('pointerdown', onPointerDown);
boardSvg.addEventListener('pointermove', onPointerMove);
boardSvg.addEventListener('pointerup', onPointerUp);
boardSvg.addEventListener('pointercancel', cancelDrag);
boardSvg.addEventListener('lostpointercapture', cancelDrag);

resetBtn.addEventListener('click', () => {
  state.tiles = [...state.initialTiles];
  state.dragState = createEmptyDragState();
  render();
});

newBoardBtn.addEventListener('click', () => {
  const fresh = createShuffledBoard();
  state.tiles = [...fresh];
  state.initialTiles = [...fresh];
  state.dragState = createEmptyDragState();
  render();
});

/** @returns {DragState} */
function createEmptyDragState() {
  return {
    sourceIndex: null,
    sourceColor: null,
    startPointerX: 0,
    startPointerY: 0,
    pointerX: 0,
    pointerY: 0,
    hoverTarget: null,
    containmentRatio: 0,
    overlapRatio: 0
  };
}

/** @returns {TileColor[]} */
function createShuffledBoard() {
  /** @type {TileColor[]} */
  const colors = [];
  for (let i = 0; i < 20; i += 1) {
    colors.push('red', 'blue', 'yellow');
  }

  for (let i = colors.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }

  return colors;
}

/**
 * @param {number} index
 * @returns {number[]}
 */
function getNeighbors(index) {
  const tile = tilesMeta[index];
  const row = tile.row;
  const col = tile.col;
  const length = ROW_LENGTHS[row];
  const neighbors = [];

  const sameRowCandidates = [col - 1, col + 1];
  for (const c of sameRowCandidates) {
    const idx = indexByRowCol.get(keyOf(row, c));
    if (typeof idx === 'number') neighbors.push(idx);
  }

  const crossRows = [row - 1, row + 1];
  for (const r of crossRows) {
    if (r < 0 || r >= ROW_LENGTHS.length) continue;

    const candidateCols =
      length === 8
        ? [col - 1, col]
        : [col, col + 1];

    for (const c of candidateCols) {
      const idx = indexByRowCol.get(keyOf(r, c));
      if (typeof idx === 'number') neighbors.push(idx);
    }
  }

  return [...new Set(neighbors)];
}

/**
 * @param {TileColor} color
 * @returns {boolean}
 */
function isPrimary(color) {
  return PRIMARY_COLORS.has(color);
}

/**
 * @param {TileColor} sourceColor
 * @param {TileColor} targetColor
 * @returns {TileColor|null}
 */
function mix(sourceColor, targetColor) {
  const key = `${sourceColor}:${targetColor}`;
  return MIX_RESULTS[key] || null;
}

/**
 * @param {number} sourceIndex
 * @param {number} targetIndex
 * @param {GameState} gameState
 * @returns {boolean}
 */
function canDrop(sourceIndex, targetIndex, gameState) {
  if (sourceIndex === targetIndex) return false;

  const source = gameState.tiles[sourceIndex];
  const target = gameState.tiles[targetIndex];
  if (!isPrimary(source) || !isPrimary(target)) return false;
  if (source === target) return false;

  const neighborSet = new Set(getNeighbors(sourceIndex));
  if (!neighborSet.has(targetIndex)) return false;

  return mix(source, target) !== null;
}

/**
 * @param {number} sourceIndex
 * @param {number} targetIndex
 * @param {GameState} gameState
 * @returns {GameState}
 */
function applyMove(sourceIndex, targetIndex, gameState) {
  const sourceColor = gameState.tiles[sourceIndex];
  const targetColor = gameState.tiles[targetIndex];
  const mixed = mix(sourceColor, targetColor);
  if (!mixed) return gameState;

  const nextTiles = [...gameState.tiles];
  nextTiles[sourceIndex] = 'white';
  nextTiles[targetIndex] = mixed;

  return {
    ...gameState,
    tiles: nextTiles
  };
}

/**
 * @param {PointerEvent} event
 */
function onPointerDown(event) {
  const sourceIndex = readIndexFromEvent(event);
  if (sourceIndex === null) return;

  const color = state.tiles[sourceIndex];
  if (!isPrimary(color)) return;

  const point = svgPointFromClient(event.clientX, event.clientY);
  state.dragState = {
    ...createEmptyDragState(),
    sourceIndex,
    sourceColor: color,
    startPointerX: point.x,
    startPointerY: point.y,
    pointerX: point.x,
    pointerY: point.y
  };

  boardSvg.setPointerCapture(event.pointerId);
  render();
}

/**
 * @param {PointerEvent} event
 */
function onPointerMove(event) {
  if (state.dragState.sourceIndex === null) return;

  const point = svgPointFromClient(event.clientX, event.clientY);
  state.dragState.pointerX = point.x;
  state.dragState.pointerY = point.y;

  updateHoverTarget();
  render();
}

/**
 * @param {PointerEvent} event
 */
function onPointerUp(event) {
  if (state.dragState.sourceIndex === null) return;

  const sourceIndex = state.dragState.sourceIndex;
  const target = state.dragState.hoverTarget;
  const containment = state.dragState.containmentRatio;
  const canCommit =
    typeof target === 'number' &&
    canDrop(sourceIndex, target, state) &&
    containment >= 0.9;

  if (canCommit) {
    const updated = applyMove(sourceIndex, target, state);
    state.tiles = updated.tiles;
  }

  if (boardSvg.hasPointerCapture(event.pointerId)) {
    boardSvg.releasePointerCapture(event.pointerId);
  }

  state.dragState = createEmptyDragState();
  render();
}

function cancelDrag() {
  if (state.dragState.sourceIndex === null) return;
  state.dragState = createEmptyDragState();
  render();
}

function updateHoverTarget() {
  const sourceIndex = state.dragState.sourceIndex;
  if (sourceIndex === null || state.dragState.sourceColor === null) {
    state.dragState.hoverTarget = null;
    state.dragState.containmentRatio = 0;
    state.dragState.overlapRatio = 0;
    return;
  }

  const draggedPoly = getDraggedInnerPolygon();
  const draggedArea = Math.abs(polygonArea(draggedPoly));
  if (draggedArea <= 0) {
    state.dragState.hoverTarget = null;
    state.dragState.containmentRatio = 0;
    state.dragState.overlapRatio = 0;
    return;
  }

  let bestTarget = null;
  let bestContainment = 0;
  let bestOverlap = 0;

  const neighbors = getNeighbors(sourceIndex);
  for (const idx of neighbors) {
    if (!canDrop(sourceIndex, idx, state)) continue;

    const targetPoly = getInnerPolygonAtIndex(idx);
    const clipped = clipPolygonConvex(draggedPoly, targetPoly);
    const overlapArea = Math.abs(polygonArea(clipped));

    if (overlapArea <= 0) continue;

    const containment = overlapArea / draggedArea;
    if (containment > bestContainment) {
      bestContainment = containment;
      bestOverlap = overlapArea / Math.abs(polygonArea(targetPoly));
      bestTarget = idx;
    }
  }

  state.dragState.hoverTarget = bestTarget;
  state.dragState.containmentRatio = bestContainment;
  state.dragState.overlapRatio = bestOverlap;
}

function initializeBoardStatic() {
  outerLayer.innerHTML = '';
  innerLayer.innerHTML = '';

  for (const tile of tilesMeta) {
    const outerGroup = createSvgEl('g', {
      class: 'tile-shell'
    });
    const innerGroup = createSvgEl('g', {
      class: 'tile-group',
      'data-index': String(tile.index),
      role: 'img'
    });

    const outer = createSvgEl('polygon', {
      class: 'outer',
      points: pointsToAttr(hexPoints(tile.cx, tile.cy, HEX_RADIUS))
    });

    const inner = createSvgEl('polygon', {
      class: 'inner',
      points: pointsToAttr(hexPoints(tile.cx, tile.cy, INNER_RADIUS))
    });

    outerGroup.append(outer);
    innerGroup.append(inner);
    outerLayer.appendChild(outerGroup);
    innerLayer.appendChild(innerGroup);
  }
}

function render() {
  renderInnerTiles();
  renderPreview();
  renderDragLayer();
}

function renderInnerTiles() {
  const sourceIndex = state.dragState.sourceIndex;

  const groups = innerLayer.querySelectorAll('.tile-group');
  groups.forEach((group) => {
    const idx = Number(group.getAttribute('data-index'));
    const color = state.tiles[idx];
    const inner = group.querySelector('.inner');

    const displayColor = sourceIndex === idx ? 'white' : color;
    inner.setAttribute('fill', COLOR_HEX[displayColor]);

    group.classList.toggle('draggable', isPrimary(color));
    group.classList.toggle('dragging-source', sourceIndex === idx);
    group.setAttribute(
      'aria-label',
      `Row ${tilesMeta[idx].row + 1}, Column ${tilesMeta[idx].col + 1}, ${displayColor} tile`
    );
  });
}

function renderPreview() {
  previewLayer.innerHTML = '';

  const sourceIndex = state.dragState.sourceIndex;
  const targetIndex = state.dragState.hoverTarget;
  if (sourceIndex === null || targetIndex === null) return;

  if (!canDrop(sourceIndex, targetIndex, state)) return;

  const sourceColor = state.tiles[sourceIndex];
  const targetColor = state.tiles[targetIndex];
  const mixed = mix(sourceColor, targetColor);
  if (!mixed) return;

  const draggedPoly = getDraggedInnerPolygon();
  const targetPoly = getInnerPolygonAtIndex(targetIndex);
  const overlapPoly = clipPolygonConvex(draggedPoly, targetPoly);
  if (overlapPoly.length < 3) return;

  const preview = createSvgEl('polygon', {
    class: 'overlap-preview',
    points: pointsToAttr(overlapPoly),
    fill: COLOR_HEX[mixed]
  });

  previewLayer.appendChild(preview);
}

function renderDragLayer() {
  dragLayer.innerHTML = '';
  const sourceIndex = state.dragState.sourceIndex;
  if (sourceIndex === null || state.dragState.sourceColor === null) return;

  const draggedPoly = getDraggedInnerPolygon();
  const piece = createSvgEl('polygon', {
    class: 'drag-inner',
    points: pointsToAttr(draggedPoly),
    fill: COLOR_HEX[state.dragState.sourceColor]
  });
  dragLayer.appendChild(piece);
}

/** @returns {{x:number,y:number}[]} */
function getDraggedInnerPolygon() {
  const sourceIndex = state.dragState.sourceIndex;
  if (sourceIndex === null) return [];

  const sourceTile = tilesMeta[sourceIndex];
  const dx = state.dragState.pointerX - state.dragState.startPointerX;
  const dy = state.dragState.pointerY - state.dragState.startPointerY;
  return hexPoints(sourceTile.cx + dx, sourceTile.cy + dy, INNER_RADIUS);
}

/**
 * @param {number} index
 * @returns {{x:number,y:number}[]}
 */
function getInnerPolygonAtIndex(index) {
  const tile = tilesMeta[index];
  return hexPoints(tile.cx, tile.cy, INNER_RADIUS);
}

/**
 * Build center positions using pointy-top hexes with alternating 8/7 row offsets.
 * @returns {TileMeta[]}
 */
function buildTileMeta() {
  const tiles = [];
  let index = 0;

  for (let row = 0; row < ROW_LENGTHS.length; row += 1) {
    const len = ROW_LENGTHS[row];
    const rowOffsetX = len === 7 ? HEX_WIDTH / 2 : 0;
    const cy = BOARD_PADDING + HEX_RADIUS + row * ROW_SPACING;

    for (let col = 0; col < len; col += 1) {
      const cx = BOARD_PADDING + HEX_WIDTH / 2 + rowOffsetX + col * HEX_WIDTH;
      tiles.push({ index, row, col, cx, cy });
      index += 1;
    }
  }

  return tiles;
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @returns {{x:number,y:number}[]}
 */
function hexPoints(cx, cy, radius) {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angleDeg = 60 * i - 90;
    const angleRad = (Math.PI / 180) * angleDeg;
    points.push({
      x: cx + radius * Math.cos(angleRad),
      y: cy + radius * Math.sin(angleRad)
    });
  }
  return points;
}

/**
 * @param {{x:number,y:number}[]} points
 * @returns {number}
 */
function polygonArea(points) {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return area / 2;
}

/**
 * Sutherland-Hodgman clipping for convex polygons.
 * @param {{x:number,y:number}[]} subject
 * @param {{x:number,y:number}[]} clipper
 * @returns {{x:number,y:number}[]}
 */
function clipPolygonConvex(subject, clipper) {
  if (subject.length < 3 || clipper.length < 3) return [];

  const clipperArea = polygonArea(clipper);
  let output = [...subject];

  for (let i = 0; i < clipper.length; i += 1) {
    const a = clipper[i];
    const b = clipper[(i + 1) % clipper.length];
    const input = output;
    output = [];

    if (input.length === 0) break;

    let prev = input[input.length - 1];
    for (const curr of input) {
      const currInside = isInsideEdge(curr, a, b, clipperArea);
      const prevInside = isInsideEdge(prev, a, b, clipperArea);

      if (currInside) {
        if (!prevInside) {
          output.push(lineIntersection(prev, curr, a, b));
        }
        output.push(curr);
      } else if (prevInside) {
        output.push(lineIntersection(prev, curr, a, b));
      }

      prev = curr;
    }
  }

  return output;
}

/**
 * @param {{x:number,y:number}} p
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {number} windingArea
 * @returns {boolean}
 */
function isInsideEdge(p, a, b, windingArea) {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  return windingArea >= 0 ? cross >= -1e-7 : cross <= 1e-7;
}

/**
 * Line intersection between segment p1->p2 and infinite edge a->b.
 * @param {{x:number,y:number}} p1
 * @param {{x:number,y:number}} p2
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {{x:number,y:number}}
 */
function lineIntersection(p1, p2, a, b) {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  const x3 = a.x;
  const y3 = a.y;
  const x4 = b.x;
  const y4 = b.y;

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-8) {
    return { x: x2, y: y2 };
  }

  const determinant1 = x1 * y2 - y1 * x2;
  const determinant2 = x3 * y4 - y3 * x4;

  const x = (determinant1 * (x3 - x4) - (x1 - x2) * determinant2) / denominator;
  const y = (determinant1 * (y3 - y4) - (y1 - y2) * determinant2) / denominator;
  return { x, y };
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{x:number,y:number}}
 */
function svgPointFromClient(clientX, clientY) {
  const pt = boardSvg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const transformed = pt.matrixTransform(boardSvg.getScreenCTM().inverse());
  return { x: transformed.x, y: transformed.y };
}

/**
 * @param {PointerEvent} event
 * @returns {number|null}
 */
function readIndexFromEvent(event) {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  if (!target.classList.contains('inner')) return null;
  const group = target.closest('.tile-group');
  if (!group) return null;

  const idx = Number(group.getAttribute('data-index'));
  return Number.isInteger(idx) ? idx : null;
}

/**
 * @param {string} row
 * @param {string} col
 * @returns {string}
 */
function keyOf(row, col) {
  return `${row}:${col}`;
}

/**
 * @param {string} name
 * @param {Record<string,string>} attrs
 * @returns {SVGElement}
 */
function createSvgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

/**
 * @param {{x:number,y:number}[]} points
 * @returns {string}
 */
function pointsToAttr(points) {
  return points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
}
