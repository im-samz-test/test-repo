import './style.css';
import { Game, squareName, type Color, type Move, type PieceType, type PromotionType, type Square } from './engine';
import { statusText } from './ui/status';

const GLYPHS: Record<PieceType, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const glyph = (t: PieceType): string => GLYPHS[t] + '︎'; // force text (non-emoji) presentation

const boardEl = document.getElementById('board')!;
const statusEl = document.getElementById('status')!;
const movesEl = document.getElementById('moves')!;
const wrapEl = boardEl.parentElement!;
const undoBtn = document.getElementById('undo') as HTMLButtonElement;

let game = new Game();
let selected: Square | null = null;
let targets: Move[] = [];
let flipped = false;
let promoting = false;

interface Drag {
  from: Square;
  ghost: HTMLElement;
  pointerId: number;
}
let drag: Drag | null = null;

function squareAtPoint(x: number, y: number): Square | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.sq');
  return el ? Number(el.dataset.square) : null;
}

function render(): void {
  const status = game.status();
  const last = game.lastMove;
  const side: Color = game.turn;
  const checkedKing = status.check ? game.position.kingSquare(side) : -1;
  const targetMap = new Map(targets.map((m) => [m.to, m]));

  boardEl.replaceChildren();
  for (let i = 0; i < 64; i++) {
    const r = flipped ? i >> 3 : 7 - (i >> 3);
    const f = flipped ? 7 - (i & 7) : i & 7;
    const s = r * 8 + f;
    const el = document.createElement('div');
    el.className = 'sq ' + ((r + f) % 2 === 0 ? 'dark' : 'light');
    el.dataset.square = String(s);
    el.dataset.name = squareName(s);
    el.setAttribute('role', 'gridcell');
    if (last && (last.from === s || last.to === s)) el.classList.add('last');
    if (selected === s) el.classList.add('selected');
    if (s === checkedKing) el.classList.add('in-check');
    const t = targetMap.get(s);
    if (t) el.classList.add('target', ...(t.captured ? ['capture'] : []));

    const p = game.pieceAt(s);
    if (p) {
      const pe = document.createElement('span');
      pe.className = `piece ${p.color}`;
      pe.textContent = glyph(p.type);
      pe.setAttribute('aria-label', `${p.color === 'w' ? 'white' : 'black'} ${p.type}`);
      el.append(pe);
    }
    if (i >> 3 === 7) el.append(coord('f', 'abcdefgh'[f]!));
    if ((i & 7) === 0) el.append(coord('r', String(r + 1)));
    boardEl.append(el);
  }

  statusEl.textContent = statusText(game);
  statusEl.className = 'status' + (status.over ? ' over' : status.check ? ' check' : '');
  undoBtn.disabled = game.history.length === 0;
  renderMoves();
}

function coord(kind: 'f' | 'r', text: string): HTMLElement {
  const c = document.createElement('span');
  c.className = `coord ${kind}`;
  c.textContent = text;
  return c;
}

function renderMoves(): void {
  movesEl.replaceChildren();
  const h = game.history;
  for (let i = 0; i < h.length; i += 2) {
    const li = document.createElement('li');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = `${i / 2 + 1}.`;
    li.append(num);
    for (const j of [i, i + 1]) {
      const cell = document.createElement('span');
      cell.textContent = h[j]?.san ?? '';
      if (j === h.length - 1) cell.className = 'cur';
      li.append(cell);
    }
    movesEl.append(li);
  }
  movesEl.scrollTop = movesEl.scrollHeight;
}

function select(s: Square | null): void {
  selected = s;
  targets = s === null ? [] : game.movesFrom(s);
  if (targets.length === 0) selected = null;
}

function tryMove(from: Square, to: Square): boolean {
  const candidates = game.movesFrom(from).filter((m) => m.to === to);
  if (candidates.length === 0) return false;
  if (candidates[0]!.promotion) {
    askPromotion(from, to);
    return true;
  }
  game.move(from, to);
  select(null);
  render();
  return true;
}

function askPromotion(from: Square, to: Square): void {
  promoting = true;
  const color = game.turn;
  const overlay = document.createElement('div');
  overlay.className = 'promo';
  const box = document.createElement('div');
  box.className = 'promo-choices';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Choose promotion piece');
  const close = (): void => {
    promoting = false;
    overlay.remove();
  };
  for (const t of ['q', 'r', 'b', 'n'] as PromotionType[]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = color;
    b.dataset.promo = t;
    b.textContent = glyph(t);
    b.title = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[t];
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      game.move(from, to, t);
      select(null);
      render();
    });
    box.append(b);
  }
  overlay.append(box);
  overlay.addEventListener('click', () => {
    close();
    select(null);
    render();
  });
  wrapEl.append(overlay);
}

function endDrag(): void {
  if (!drag) return;
  drag.ghost.remove();
  drag = null;
  boardEl.querySelectorAll('.dragging').forEach((e) => e.classList.remove('dragging'));
}

boardEl.addEventListener('pointerdown', (e) => {
  if (promoting || e.button !== 0) return;
  const s = squareAtPoint(e.clientX, e.clientY);
  if (s === null || game.status().over) return;

  // Click-to-move: a square highlighted as a target completes the move.
  if (selected !== null && targets.some((m) => m.to === s)) {
    tryMove(selected, s);
    return;
  }
  const p = game.pieceAt(s);
  if (p && p.color === game.turn) {
    select(s);
    render();
    if (selected === s) {
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost piece ' + p.color;
      ghost.textContent = glyph(p.type);
      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;
      document.body.append(ghost);
      drag = { from: s, ghost, pointerId: e.pointerId };
      boardEl.querySelector(`.sq[data-square="${s}"] .piece`)?.classList.add('dragging');
      boardEl.setPointerCapture(e.pointerId);
    }
  } else {
    select(null);
    render();
  }
});

boardEl.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  drag.ghost.style.left = `${e.clientX}px`;
  drag.ghost.style.top = `${e.clientY}px`;
});

boardEl.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const from = drag.from;
  const to = squareAtPoint(e.clientX, e.clientY);
  endDrag();
  if (to !== null && to !== from) {
    if (!tryMove(from, to)) render();
  }
});

boardEl.addEventListener('pointercancel', () => {
  endDrag();
  render();
});

document.getElementById('new-game')!.addEventListener('click', () => {
  game = new Game();
  select(null);
  render();
});
undoBtn.addEventListener('click', () => {
  if (promoting) return;
  game.undo();
  select(null);
  render();
});
document.getElementById('flip')!.addEventListener('click', () => {
  flipped = !flipped;
  render();
});

render();
