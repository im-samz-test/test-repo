export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PromotionType = 'q' | 'r' | 'b' | 'n';

export interface Piece {
  color: Color;
  type: PieceType;
}

/** Square index 0..63 with a1 = 0, b1 = 1, ..., h1 = 7, a2 = 8, ..., h8 = 63. */
export type Square = number;

export type MoveFlag = 'normal' | 'double' | 'ep' | 'castleK' | 'castleQ';

export interface Move {
  from: Square;
  to: Square;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PromotionType;
  flag: MoveFlag;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const file = (sq: Square): number => sq & 7;
export const rank = (sq: Square): number => sq >> 3;
export const sq = (f: number, r: number): Square => r * 8 + f;

export function squareName(s: Square): string {
  return 'abcdefgh'[file(s)]! + (rank(s) + 1);
}

export function parseSquare(name: string): Square {
  if (!/^[a-h][1-8]$/.test(name)) throw new Error(`Invalid square: ${name}`);
  return sq(name.charCodeAt(0) - 97, name.charCodeAt(1) - 49);
}

export const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');
