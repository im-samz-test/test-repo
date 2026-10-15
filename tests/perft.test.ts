import { describe, expect, it } from 'vitest';
import { parseFen } from '../src/engine';

const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const POSITION_3 = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';
const POSITION_4 = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1';
const POSITION_5 = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8';

function perft(fen: string, depth: number): number {
  return parseFen(fen).perft(depth);
}

describe('perft', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  it.each([
    [1, 20],
    [2, 400],
    [3, 8902],
    [4, 197281],
  ])('start position depth %i = %i', (d, n) => {
    expect(perft(start, d)).toBe(n);
  });

  it.each([
    [1, 48],
    [2, 2039],
    [3, 97862],
  ])('kiwipete depth %i = %i', (d, n) => {
    expect(perft(KIWIPETE, d)).toBe(n);
  });

  it.each([
    [1, 14],
    [2, 191],
    [3, 2812],
    [4, 43238],
  ])('position 3 depth %i = %i', (d, n) => {
    expect(perft(POSITION_3, d)).toBe(n);
  });

  it.each([
    [1, 6],
    [2, 264],
    [3, 9467],
  ])('position 4 depth %i = %i', (d, n) => {
    expect(perft(POSITION_4, d)).toBe(n);
  });

  it.each([
    [1, 44],
    [2, 1486],
    [3, 62379],
  ])('position 5 depth %i = %i', (d, n) => {
    expect(perft(POSITION_5, d)).toBe(n);
  });
});
