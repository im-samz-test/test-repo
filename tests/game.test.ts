import { describe, expect, it } from 'vitest';
import { Game, parseFen, parseSquare, toFen, START_FEN } from '../src/engine';

function play(game: Game, moves: string): Game {
  for (const san of moves.split(/\s+/).filter(Boolean)) {
    if (!game.moveSan(san)) throw new Error(`Illegal move ${san} at ${game.fen()}`);
  }
  return game;
}
const sqr = parseSquare;

describe('FEN', () => {
  it('round-trips the start position and others', () => {
    for (const fen of [
      START_FEN,
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
      '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 b - - 12 40',
    ]) {
      expect(toFen(parseFen(fen))).toBe(fen);
    }
  });
  it('rejects malformed FENs', () => {
    expect(() => parseFen('nonsense')).toThrow();
    expect(() => parseFen('8/8/8/8/8/8/8/8 w - - 0 1')).toThrow();
    expect(() => parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN w KQkq - 0 1')).toThrow();
  });
  it('defaults missing clocks', () => {
    expect(toFen(parseFen('4k3/8/8/8/8/8/8/4K3 w - -'))).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  });
});

describe('checkmate and stalemate', () => {
  it("detects fool's mate", () => {
    const g = play(new Game(), 'f3 e5 g4 Qh4#');
    expect(g.status()).toMatchObject({ over: true, reason: 'checkmate', winner: 'b' });
    expect(g.legalMoves()).toHaveLength(0);
  });
  it("detects scholar's mate", () => {
    const g = play(new Game(), 'e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#');
    expect(g.status()).toMatchObject({ over: true, reason: 'checkmate', winner: 'w' });
    expect(g.history.at(-1)!.san).toBe('Qxf7#');
  });
  it('detects stalemate', () => {
    const g = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(g.status()).toMatchObject({ over: true, reason: 'stalemate' });
  });
  it('reports check without game over', () => {
    const g = play(new Game(), 'e4 f6 Qh5+');
    expect(g.status()).toEqual({ over: false, check: true });
  });
  it('must resolve check', () => {
    // Rook on e2 checks the king on e1; only capturing it (protected by nothing) or stepping aside is legal.
    const g = new Game('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
    expect(g.position.inCheck()).toBe(true);
    expect(g.legalMoves().map((m) => m.to).sort()).toEqual([sqr('d1'), sqr('e2'), sqr('f1')].sort());
  });
  it('cannot move pinned pieces off the pin line', () => {
    const pinned = new Game('4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1');
    expect(pinned.movesFrom(sqr('e2'))).toHaveLength(0);
  });
});

describe('castling', () => {
  it('allows both castles when clear and safe', () => {
    const g = new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const sans = g.legalMoves().map((m) => m.flag);
    expect(sans).toContain('castleK');
    expect(sans).toContain('castleQ');
  });
  it('moves king and rook, and exports FEN without rights', () => {
    const g = play(new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'O-O O-O-O');
    expect(g.fen()).toBe('2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2');
  });
  it('is illegal while in check', () => {
    const g = new Game('4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1');
    expect(g.position.inCheck()).toBe(true);
    expect(g.legalMoves().some((m) => m.flag.startsWith('castle'))).toBe(false);
  });
  it('is illegal through an attacked square', () => {
    // Black rook on f2 attacks f1: kingside is illegal, queenside is fine.
    const g = new Game('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1');
    const flags = g.legalMoves().map((m) => m.flag);
    expect(g.position.inCheck()).toBe(false);
    expect(flags).not.toContain('castleK');
    expect(flags).toContain('castleQ');
  });
  it('is illegal into an attacked square', () => {
    // Black rook on g8 attacks g1.
    const g = new Game('4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    const flags = g.legalMoves().map((m) => m.flag);
    expect(flags).not.toContain('castleK');
    expect(flags).toContain('castleQ');
  });
  it('is allowed when only the b-file square is attacked (queenside)', () => {
    const g = new Game('1r2k3/8/8/8/8/8/8/R3K3 w Q - 0 1');
    expect(g.legalMoves().map((m) => m.flag)).toContain('castleQ');
  });
  it('is illegal when pieces are in the way', () => {
    const g = new Game('r3k2r/8/8/8/8/8/8/RN2K1NR w KQkq - 0 1');
    expect(g.legalMoves().some((m) => m.flag.startsWith('castle'))).toBe(false);
  });
  it('is lost after the king or a rook moves', () => {
    const g = play(new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'Rh2 Rb8 Rh1');
    expect(g.fen().split(' ')[2]).toBe('Qk');
    const g2 = play(new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'Ke2 Ke7 Ke1 Ke8');
    expect(g2.fen().split(' ')[2]).toBe('-');
  });
  it('is lost when a rook is captured on its home square', () => {
    const g = play(new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'Rxa8+ Kd7 Raxh8');
    expect(g.fen().split(' ')[2]).toBe('K');
  });
});

describe('en passant', () => {
  it('captures en passant and removes the pawn', () => {
    const g = play(new Game(), 'e4 a6 e5 d5');
    expect(g.fen()).toContain(' d6 ');
    const m = g.move(sqr('e5'), sqr('d6'));
    expect(m?.flag).toBe('ep');
    expect(g.pieceAt(sqr('d5'))).toBeNull();
    expect(g.history.at(-1)!.san).toBe('exd6');
    g.undo();
    expect(g.pieceAt(sqr('d5'))).toEqual({ color: 'b', type: 'p' });
  });
  it('is only available immediately', () => {
    const g = play(new Game(), 'e4 a6 e5 d5 Nf3 a5');
    expect(g.move(sqr('e5'), sqr('d6'))).toBeNull();
  });
  it('is illegal if it exposes the king', () => {
    // White king a5, black rook h5: capturing b5xc6 e.p. would open the rank for the rook.
    const g = new Game('4k3/8/8/KPp4r/8/8/8/8 w - c6 0 1');
    expect(g.legalMoves().some((m) => m.flag === 'ep')).toBe(false);
  });
});

describe('promotion', () => {
  it('generates four promotions and applies the chosen piece', () => {
    const g = new Game('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    const promos = g.movesFrom(sqr('a7')).map((m) => m.promotion).sort();
    expect(promos).toEqual(['b', 'n', 'q', 'r']);
    g.move(sqr('a7'), sqr('a8'), 'n');
    expect(g.pieceAt(sqr('a8'))).toEqual({ color: 'w', type: 'n' });
    expect(g.history[0]!.san).toBe('a8=N');
    g.undo();
    expect(g.pieceAt(sqr('a7'))).toEqual({ color: 'w', type: 'p' });
  });
  it('defaults to queen and supports capture-promotion with check', () => {
    const g = new Game('1n5k/P7/8/8/8/8/8/K7 w - - 0 1');
    g.move(sqr('a7'), sqr('b8'));
    expect(g.pieceAt(sqr('b8'))).toEqual({ color: 'w', type: 'q' });
    expect(g.history[0]!.san).toBe('axb8=Q+');
  });
});

describe('SAN', () => {
  it('disambiguates by file, rank or both', () => {
    const san = (fen: string, from: string, to: string): string => {
      const g = new Game(fen);
      g.move(sqr(from), sqr(to));
      return g.history[0]!.san;
    };
    expect(san('4k3/8/8/8/8/8/8/N3K3 w - - 0 1', 'a1', 'b3')).toBe('Nb3');
    expect(san('4k3/8/8/8/8/8/8/N1N1K3 w - - 0 1', 'a1', 'b3')).toBe('Nab3');
    expect(san('4k3/8/8/N7/8/8/8/N3K3 w - - 0 1', 'a1', 'b3')).toBe('N1b3');
    expect(san('4k3/8/8/8/8/Q7/8/Q1Q4K w - - 0 1', 'a1', 'b2')).toBe('Qa1b2');
  });
  it('rejects illegal SAN', () => {
    expect(new Game().moveSan('e5')).toBeNull();
  });
});

describe('draws', () => {
  it('detects threefold repetition', () => {
    const g = play(new Game(), 'Nf3 Nf6 Ng1 Ng8');
    expect(g.status().over).toBe(false);
    play(g, 'Nf3 Nf6 Ng1 Ng8');
    expect(g.status()).toMatchObject({ over: true, reason: 'threefold' });
    g.undo();
    expect(g.status().over).toBe(false);
  });
  it('does not count positions with different castling rights as equal', () => {
    const g = play(new Game(), 'e4 e5 Ke2 Ke7 Ke1 Ke8 Ke2 Ke7 Ke1 Ke8');
    expect(g.status().over).toBe(false);
  });
  it('detects the fifty-move rule', () => {
    const g = new Game('4k3/8/8/8/8/8/R7/4K3 w - - 99 80');
    expect(g.status().over).toBe(false);
    g.move(sqr('a2'), sqr('a3'));
    expect(g.status()).toMatchObject({ over: true, reason: 'fifty-move' });
  });
  it('lets checkmate on move 100 override the fifty-move rule', () => {
    const g = new Game('7k/8/6K1/8/8/8/8/R7 w - - 99 80');
    g.move(sqr('a1'), sqr('a8'));
    expect(g.status()).toMatchObject({ over: true, reason: 'checkmate', winner: 'w' });
  });
  it('resets the halfmove clock on pawn moves and captures', () => {
    const g = new Game('4k3/8/8/8/8/8/P3R3/4K3 w - - 50 80');
    g.move(sqr('a2'), sqr('a3'));
    expect(g.position.halfmove).toBe(0);
  });
  it.each([
    ['K v K', '4k3/8/8/8/8/8/8/4K3 w - - 0 1', true],
    ['K+N v K', '4k3/8/8/8/8/8/8/4KN2 w - - 0 1', true],
    ['K+B v K', '4k3/8/8/8/8/8/8/4KB2 w - - 0 1', true],
    ['K+B v K+B same colour', '2b1k3/8/8/8/8/8/8/4KB2 w - - 0 1', true],
    ['K+B v K+B opposite colour', '4kb2/8/8/8/8/8/8/4KB2 w - - 0 1', false],
    ['K+N+N v K', '4k3/8/8/8/8/8/8/3NKN2 w - - 0 1', false],
    ['K+P v K', '4k3/8/8/8/8/8/P7/4K3 w - - 0 1', false],
    ['K+R v K', '4k3/8/8/8/8/8/8/4KR2 w - - 0 1', false],
  ])('insufficient material: %s', (_name, fen, expected) => {
    const s = new Game(fen).status();
    expect(s.over && s.reason === 'insufficient-material').toBe(expected);
  });
});

describe('undo', () => {
  it('restores the exact position after many moves', () => {
    const g = new Game();
    play(g, 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Be7 Qf3 Qc7 O-O-O Nbd7');
    while (g.undo());
    expect(g.fen()).toBe(START_FEN);
    expect(g.history).toHaveLength(0);
  });
});
