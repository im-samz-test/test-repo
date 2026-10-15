import {
  file, rank, sq, opposite,
  type Color, type Move, type Piece, type PieceType, type PromotionType, type Square,
} from './types';

export const CASTLE_K = 1;
export const CASTLE_Q = 2;
export const CASTLE_k = 4;
export const CASTLE_q = 8;

const KNIGHT_DELTAS: ReadonlyArray<[number, number]> = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING_DELTAS: ReadonlyArray<[number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const BISHOP_DIRS: ReadonlyArray<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS: ReadonlyArray<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const PROMOTIONS: PromotionType[] = ['q', 'r', 'b', 'n'];

/** Castling rights that are lost when a piece moves from / to a given square. */
const CASTLE_MASK: Record<number, number> = {
  0: CASTLE_Q, 4: CASTLE_K | CASTLE_Q, 7: CASTLE_K,
  56: CASTLE_q, 60: CASTLE_k | CASTLE_q, 63: CASTLE_k,
};

export interface Undo {
  move: Move;
  castling: number;
  ep: number;
  halfmove: number;
  fullmove: number;
  captured: Piece | null;
}

export class Position {
  readonly kings: [Square, Square] = [-1, -1]; // index 0 = white, 1 = black

  constructor(
    public board: (Piece | null)[],
    public turn: Color,
    public castling: number,
    public ep: Square,
    public halfmove: number,
    public fullmove: number,
  ) {
    board.forEach((p, i) => {
      if (p?.type === 'k') this.kings[p.color === 'w' ? 0 : 1] = i;
    });
  }

  clone(): Position {
    return new Position([...this.board], this.turn, this.castling, this.ep, this.halfmove, this.fullmove);
  }

  /** Drop castling rights that do not match the king / rook placement. */
  sanitizeCastling(): void {
    const has = (s: Square, color: Color, type: PieceType): boolean => {
      const p = this.board[s];
      return !!p && p.color === color && p.type === type;
    };
    if (!has(4, 'w', 'k')) this.castling &= ~(CASTLE_K | CASTLE_Q);
    if (!has(60, 'b', 'k')) this.castling &= ~(CASTLE_k | CASTLE_q);
    if (!has(7, 'w', 'r')) this.castling &= ~CASTLE_K;
    if (!has(0, 'w', 'r')) this.castling &= ~CASTLE_Q;
    if (!has(63, 'b', 'r')) this.castling &= ~CASTLE_k;
    if (!has(56, 'b', 'r')) this.castling &= ~CASTLE_q;
  }

  kingSquare(color: Color): Square {
    return this.kings[color === 'w' ? 0 : 1];
  }

  isAttacked(target: Square, by: Color): boolean {
    const b = this.board;
    const tf = file(target);
    const tr = rank(target);

    // Pawns: a white pawn attacks diagonally upward, so it sits one rank below the target.
    const pr = by === 'w' ? tr - 1 : tr + 1;
    if (pr >= 0 && pr < 8) {
      for (const df of [-1, 1]) {
        const f = tf + df;
        if (f < 0 || f > 7) continue;
        const p = b[sq(f, pr)];
        if (p && p.color === by && p.type === 'p') return true;
      }
    }
    for (const [df, dr] of KNIGHT_DELTAS) {
      const f = tf + df;
      const r = tr + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const p = b[sq(f, r)];
      if (p && p.color === by && p.type === 'n') return true;
    }
    for (const [df, dr] of KING_DELTAS) {
      const f = tf + df;
      const r = tr + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const p = b[sq(f, r)];
      if (p && p.color === by && p.type === 'k') return true;
    }
    const slide = (dirs: ReadonlyArray<[number, number]>, t1: PieceType): boolean => {
      for (const [df, dr] of dirs) {
        let f = tf + df;
        let r = tr + dr;
        while (f >= 0 && f < 8 && r >= 0 && r < 8) {
          const p = b[sq(f, r)];
          if (p) {
            if (p.color === by && (p.type === t1 || p.type === 'q')) return true;
            break;
          }
          f += df;
          r += dr;
        }
      }
      return false;
    };
    return slide(BISHOP_DIRS, 'b') || slide(ROOK_DIRS, 'r');
  }

  inCheck(color: Color = this.turn): boolean {
    return this.isAttacked(this.kingSquare(color), opposite(color));
  }

  /** Pseudo-legal moves for the side to move (may leave own king in check). */
  private pseudoMoves(): Move[] {
    const moves: Move[] = [];
    const us = this.turn;
    const them = opposite(us);
    const b = this.board;

    const add = (from: Square, to: Square, piece: PieceType): void => {
      const t = b[to];
      if (t && t.color === us) return;
      const m: Move = { from, to, piece, flag: 'normal' };
      if (t) m.captured = t.type;
      moves.push(m);
    };

    for (let from = 0; from < 64; from++) {
      const p = b[from];
      if (!p || p.color !== us) continue;
      const f0 = file(from);
      const r0 = rank(from);
      switch (p.type) {
        case 'p': {
          const dir = us === 'w' ? 1 : -1;
          const startRank = us === 'w' ? 1 : 6;
          const lastRank = us === 'w' ? 7 : 0;
          const r1 = r0 + dir;
          if (r1 < 0 || r1 > 7) break;
          const pushPawn = (to: Square, captured: PieceType | undefined, flag: Move['flag']): void => {
            const base: Move = { from, to, piece: 'p', flag };
            if (captured) base.captured = captured;
            if (rank(to) === lastRank) {
              for (const promotion of PROMOTIONS) moves.push({ ...base, promotion });
            } else {
              moves.push(base);
            }
          };
          const one = sq(f0, r1);
          if (!b[one]) {
            pushPawn(one, undefined, 'normal');
            if (r0 === startRank) {
              const two = sq(f0, r1 + dir);
              if (!b[two]) moves.push({ from, to: two, piece: 'p', flag: 'double' });
            }
          }
          for (const df of [-1, 1]) {
            const f = f0 + df;
            if (f < 0 || f > 7) continue;
            const to = sq(f, r1);
            const t = b[to];
            if (t && t.color === them) pushPawn(to, t.type, 'normal');
            else if (!t && to === this.ep) pushPawn(to, 'p', 'ep');
          }
          break;
        }
        case 'n':
        case 'k': {
          const deltas = p.type === 'n' ? KNIGHT_DELTAS : KING_DELTAS;
          for (const [df, dr] of deltas) {
            const f = f0 + df;
            const r = r0 + dr;
            if (f < 0 || f > 7 || r < 0 || r > 7) continue;
            add(from, sq(f, r), p.type);
          }
          break;
        }
        default: {
          const dirs =
            p.type === 'b' ? BISHOP_DIRS : p.type === 'r' ? ROOK_DIRS : [...BISHOP_DIRS, ...ROOK_DIRS];
          for (const [df, dr] of dirs) {
            let f = f0 + df;
            let r = r0 + dr;
            while (f >= 0 && f < 8 && r >= 0 && r < 8) {
              const to = sq(f, r);
              const t = b[to];
              if (t) {
                if (t.color === them) add(from, to, p.type);
                break;
              }
              add(from, to, p.type);
              f += df;
              r += dr;
            }
          }
        }
      }
    }

    // Castling (destination square safety is verified by the legality filter).
    const home = us === 'w' ? 0 : 56;
    const kRight = us === 'w' ? CASTLE_K : CASTLE_k;
    const qRight = us === 'w' ? CASTLE_Q : CASTLE_q;
    if (this.castling & (kRight | qRight) && this.kings[us === 'w' ? 0 : 1] === home + 4 && !this.inCheck(us)) {
      if (
        this.castling & kRight &&
        !b[home + 5] && !b[home + 6] &&
        !this.isAttacked(home + 5, them)
      ) {
        moves.push({ from: home + 4, to: home + 6, piece: 'k', flag: 'castleK' });
      }
      if (
        this.castling & qRight &&
        !b[home + 1] && !b[home + 2] && !b[home + 3] &&
        !this.isAttacked(home + 3, them)
      ) {
        moves.push({ from: home + 4, to: home + 2, piece: 'k', flag: 'castleQ' });
      }
    }
    return moves;
  }

  legalMoves(): Move[] {
    const us = this.turn;
    const legal: Move[] = [];
    for (const m of this.pseudoMoves()) {
      const u = this.makeMove(m);
      if (!this.isAttacked(this.kingSquare(us), this.turn)) legal.push(m);
      this.unmakeMove(u);
    }
    return legal;
  }

  hasLegalMoves(): boolean {
    return this.legalMoves().length > 0;
  }

  makeMove(m: Move): Undo {
    const b = this.board;
    const us = this.turn;
    const piece = b[m.from]!;
    const undo: Undo = {
      move: m,
      castling: this.castling,
      ep: this.ep,
      halfmove: this.halfmove,
      fullmove: this.fullmove,
      captured: null,
    };

    if (m.flag === 'ep') {
      const capSq = m.to + (us === 'w' ? -8 : 8);
      undo.captured = b[capSq]!;
      b[capSq] = null;
    } else {
      undo.captured = b[m.to];
    }
    b[m.from] = null;
    b[m.to] = m.promotion ? { color: us, type: m.promotion } : piece;

    if (m.flag === 'castleK') {
      b[m.to - 1] = b[m.to + 1];
      b[m.to + 1] = null;
    } else if (m.flag === 'castleQ') {
      b[m.to + 1] = b[m.to - 2];
      b[m.to - 2] = null;
    }
    if (m.piece === 'k') this.kings[us === 'w' ? 0 : 1] = m.to;

    this.castling &= ~((CASTLE_MASK[m.from] ?? 0) | (CASTLE_MASK[m.to] ?? 0));
    this.ep = m.flag === 'double' ? (m.from + m.to) >> 1 : -1;
    this.halfmove = m.piece === 'p' || undo.captured ? 0 : this.halfmove + 1;
    if (us === 'b') this.fullmove++;
    this.turn = opposite(us);
    return undo;
  }

  unmakeMove(u: Undo): void {
    const m = u.move;
    const b = this.board;
    this.turn = opposite(this.turn);
    const us = this.turn;

    b[m.from] = { color: us, type: m.piece };
    if (m.flag === 'ep') {
      b[m.to] = null;
      b[m.to + (us === 'w' ? -8 : 8)] = u.captured;
    } else {
      b[m.to] = u.captured;
    }
    if (m.flag === 'castleK') {
      b[m.to + 1] = b[m.to - 1];
      b[m.to - 1] = null;
    } else if (m.flag === 'castleQ') {
      b[m.to - 2] = b[m.to + 1];
      b[m.to + 1] = null;
    }
    if (m.piece === 'k') this.kings[us === 'w' ? 0 : 1] = m.from;

    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.fullmove = u.fullmove;
  }

  /** Counts leaf nodes of the legal move tree. */
  perft(depth: number): number {
    if (depth === 0) return 1;
    const moves = this.legalMoves();
    if (depth === 1) return moves.length;
    let n = 0;
    for (const m of moves) {
      const u = this.makeMove(m);
      n += this.perft(depth - 1);
      this.unmakeMove(u);
    }
    return n;
  }
}
