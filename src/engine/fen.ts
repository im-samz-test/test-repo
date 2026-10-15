import { Position, CASTLE_K, CASTLE_Q, CASTLE_k, CASTLE_q } from './position';
import { START_FEN, parseSquare, sq, squareName, type Color, type Piece, type PieceType } from './types';

const TYPES = new Set(['p', 'n', 'b', 'r', 'q', 'k']);

export function pieceToChar(p: Piece): string {
  return p.color === 'w' ? p.type.toUpperCase() : p.type;
}

export function parseFen(fen: string = START_FEN): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4 || parts.length > 6) throw new Error('Invalid FEN: expected 4 to 6 fields');
  const [placement, turnStr, castleStr, epStr, halfStr = '0', fullStr = '1'] = parts as [
    string, string, string, string, string?, string?,
  ];

  const board: (Piece | null)[] = new Array(64).fill(null);
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error('Invalid FEN: expected 8 ranks');
  rows.forEach((row, i) => {
    const r = 7 - i;
    let f = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        f += Number(ch);
      } else {
        const type = ch.toLowerCase();
        if (!TYPES.has(type)) throw new Error(`Invalid FEN: bad piece '${ch}'`);
        if (f > 7) throw new Error('Invalid FEN: rank too long');
        const color: Color = ch === ch.toUpperCase() ? 'w' : 'b';
        board[sq(f, r)] = { color, type: type as PieceType };
        f++;
      }
    }
    if (f !== 8) throw new Error('Invalid FEN: rank does not have 8 files');
  });

  if (turnStr !== 'w' && turnStr !== 'b') throw new Error('Invalid FEN: bad side to move');

  let castling = 0;
  if (castleStr !== '-') {
    for (const ch of castleStr) {
      if (ch === 'K') castling |= CASTLE_K;
      else if (ch === 'Q') castling |= CASTLE_Q;
      else if (ch === 'k') castling |= CASTLE_k;
      else if (ch === 'q') castling |= CASTLE_q;
      else throw new Error('Invalid FEN: bad castling field');
    }
  }

  const ep = epStr === '-' ? -1 : parseSquare(epStr);
  const halfmove = Number(halfStr);
  const fullmove = Number(fullStr);
  if (!Number.isInteger(halfmove) || halfmove < 0) throw new Error('Invalid FEN: bad halfmove clock');
  if (!Number.isInteger(fullmove) || fullmove < 1) throw new Error('Invalid FEN: bad fullmove number');

  const pos = new Position(board, turnStr, castling, ep, halfmove, fullmove);
  const kings = { w: 0, b: 0 };
  for (const p of board) if (p?.type === 'k') kings[p.color]++;
  if (kings.w !== 1 || kings.b !== 1) throw new Error('Invalid FEN: each side needs exactly one king');
  pos.sanitizeCastling();
  return pos;
}

export function toFen(pos: Position): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.board[sq(f, r)];
      if (!p) {
        empty++;
      } else {
        if (empty) row += empty;
        empty = 0;
        row += pieceToChar(p);
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  let c = '';
  if (pos.castling & CASTLE_K) c += 'K';
  if (pos.castling & CASTLE_Q) c += 'Q';
  if (pos.castling & CASTLE_k) c += 'k';
  if (pos.castling & CASTLE_q) c += 'q';
  return [
    rows.join('/'),
    pos.turn,
    c || '-',
    pos.ep >= 0 ? squareName(pos.ep) : '-',
    pos.halfmove,
    pos.fullmove,
  ].join(' ');
}
