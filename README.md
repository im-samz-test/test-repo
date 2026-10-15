# GitHub Facts

1. GitHub was founded in 2008.
2. GitHub uses Git as its version control system.
3. Pull requests let developers review and discuss code changes before merging.
4. GitHub Actions provides built-in CI/CD automation workflows.
5. GitHub supports both public and private repositories.

# Chess

A browser chess game with a hand-rolled TypeScript rules engine and a framework-free Vite UI.

## Run

```sh
npm install
npm run dev        # start the dev server (http://localhost:5173)
npm test           # vitest: perft counts and rules tests
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
```

## Layout

- `src/engine/` - rules engine (no UI dependency): board, legal move generation, check/checkmate/stalemate, castling, en passant, promotion, 50-move / threefold / insufficient-material draws, FEN import/export, SAN.
- `src/main.ts`, `src/ui/`, `index.html`, `src/style.css` - UI: click-to-move and drag-and-drop, legal-move / last-move / check highlights, promotion picker, SAN move list, undo, new game, flip board.
- `tests/` - perft (start position, Kiwipete, positions 3-5) and rule-specific tests.
