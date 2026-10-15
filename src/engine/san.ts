import type { Position } from './position';
import { file, rank, squareName, type Move } from './types';

/** Standard Algebraic Notation for a legal move in `pos` (the position before the move). */
export function moveToSan(pos: Position, move: Move, legal: Move[] = pos.legalMoves()): string {
  let san: string;
  if (move.flag === 'castleK') san = 'O-O';
  else if (move.flag === 'castleQ') san = 'O-O-O';
  else {
    const capture = move.captured !== undefined;
    if (move.piece === 'p') {
      san = capture ? 'abcdefgh'[file(move.from)]! + 'x' : '';
      san += squareName(move.to);
      if (move.promotion) san += '=' + move.promotion.toUpperCase();
    } else {
      san = move.piece.toUpperCase();
      const rivals = legal.filter(
        (m) => m.piece === move.piece && m.to === move.to && m.from !== move.from,
      );
      if (rivals.length) {
        const sameFile = rivals.some((m) => file(m.from) === file(move.from));
        const sameRank = rivals.some((m) => rank(m.from) === rank(move.from));
        if (!sameFile) san += 'abcdefgh'[file(move.from)];
        else if (!sameRank) san += rank(move.from) + 1;
        else san += squareName(move.from);
      }
      if (capture) san += 'x';
      san += squareName(move.to);
    }
  }
  const u = pos.makeMove(move);
  if (pos.inCheck()) san += pos.hasLegalMoves() ? '+' : '#';
  pos.unmakeMove(u);
  return san;
}
