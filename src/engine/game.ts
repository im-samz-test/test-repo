import { parseFen, toFen, pieceToChar } from './fen';
import { Position, type Undo } from './position';
import { moveToSan } from './san';
import {
  START_FEN, file,
  type Color, type Move, type Piece, type PromotionType, type Square,
} from './types';

export type DrawReason = 'stalemate' | 'insufficient-material' | 'fifty-move' | 'threefold';
export type GameStatus =
  | { over: false; check: boolean }
  | { over: true; reason: 'checkmate'; winner: Color; check: true }
  | { over: true; reason: DrawReason; winner: null; check: boolean };

export interface HistoryEntry {
  move: Move;
  san: string;
}

/** True when neither side can possibly deliver checkmate. */
export function hasInsufficientMaterial(board: ReadonlyArray<Piece | null>): boolean {
  const minors: { type: string; squareColor: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p.type === 'k') continue;
    if (p.type === 'p' || p.type === 'r' || p.type === 'q') return false;
    minors.push({ type: p.type, squareColor: (file(i) + (i >> 3)) & 1 });
  }
  if (minors.length <= 1) return true; // K v K, K+minor v K
  // Only bishops, all on the same square colour (any number, any side).
  return minors.every((m) => m.type === 'b' && m.squareColor === minors[0]!.squareColor);
}

/** Position identity for repetition: placement, side to move, castling and a *capturable* ep square. */
function repetitionKey(pos: Position): string {
  let placement = '';
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    placement += p ? pieceToChar(p) : '.';
  }
  let ep = '-';
  if (pos.ep >= 0 && pos.legalMoves().some((m) => m.flag === 'ep')) ep = String(pos.ep);
  return `${placement} ${pos.turn} ${pos.castling} ${ep}`;
}

export class Game {
  readonly position: Position;
  private undos: Undo[] = [];
  private keys: string[] = [];
  readonly history: HistoryEntry[] = [];
  readonly startFen: string;

  constructor(fen: string = START_FEN) {
    this.position = parseFen(fen);
    this.startFen = toFen(this.position);
    this.keys.push(repetitionKey(this.position));
  }

  get turn(): Color {
    return this.position.turn;
  }

  fen(): string {
    return toFen(this.position);
  }

  pieceAt(s: Square): Piece | null {
    return this.position.board[s] ?? null;
  }

  legalMoves(): Move[] {
    return this.position.legalMoves();
  }

  movesFrom(from: Square): Move[] {
    return this.legalMoves().filter((m) => m.from === from);
  }

  get lastMove(): Move | null {
    return this.history.at(-1)?.move ?? null;
  }

  /** Plays a legal move given as squares; returns it, or null when illegal. */
  move(from: Square, to: Square, promotion?: PromotionType): Move | null {
    const legal = this.legalMoves();
    const m = legal.find(
      (c) => c.from === from && c.to === to && (!c.promotion || c.promotion === (promotion ?? 'q')),
    );
    return m ? this.play(m, legal) : null;
  }

  /** Plays a move given in SAN (e.g. "Nf3", "O-O", "e8=Q+"); returns it, or null when not legal. */
  moveSan(san: string): Move | null {
    const legal = this.legalMoves();
    const clean = (s: string): string => s.replace(/[+#!?]+$/, '').replace('0', 'O').replace('=', '');
    const target = clean(san);
    const m = legal.find((c) => clean(moveToSan(this.position, c, legal)) === target);
    return m ? this.play(m, legal) : null;
  }

  private play(m: Move, legal: Move[]): Move {
    const san = moveToSan(this.position, m, legal);
    this.undos.push(this.position.makeMove(m));
    this.history.push({ move: m, san });
    this.keys.push(repetitionKey(this.position));
    return m;
  }

  undo(): Move | null {
    const u = this.undos.pop();
    if (!u) return null;
    this.position.unmakeMove(u);
    this.history.pop();
    this.keys.pop();
    return u.move;
  }

  status(): GameStatus {
    const pos = this.position;
    const check = pos.inCheck();
    if (!pos.hasLegalMoves()) {
      return check
        ? { over: true, reason: 'checkmate', winner: pos.turn === 'w' ? 'b' : 'w', check: true }
        : { over: true, reason: 'stalemate', winner: null, check: false };
    }
    if (hasInsufficientMaterial(pos.board)) {
      return { over: true, reason: 'insufficient-material', winner: null, check };
    }
    if (pos.halfmove >= 100) return { over: true, reason: 'fifty-move', winner: null, check };
    const last = this.keys.at(-1)!;
    if (this.keys.filter((k) => k === last).length >= 3) {
      return { over: true, reason: 'threefold', winner: null, check };
    }
    return { over: false, check };
  }

  isGameOver(): boolean {
    return this.status().over;
  }
}

