import type { Game } from '../engine';

const REASONS = {
  stalemate: 'Draw by stalemate.',
  'insufficient-material': 'Draw by insufficient material.',
  'fifty-move': 'Draw by the fifty-move rule.',
  threefold: 'Draw by threefold repetition.',
} as const;

export function statusText(game: Game): string {
  const s = game.status();
  const name = (c: 'w' | 'b'): string => (c === 'w' ? 'White' : 'Black');
  if (s.over) {
    return s.reason === 'checkmate'
      ? `Checkmate. ${name(s.winner)} wins.`
      : `Game over. ${REASONS[s.reason]}`;
  }
  return `${name(game.turn)} to move${s.check ? ' (in check)' : ''}`;
}
