# SkyRoute – Airline Route Manager (DSA Project 3)

React + TypeScript + Vite website demonstrating trees, graphs and algorithm analysis on a 15-airport Indian network.
All data structures and algorithms are hand-written (no graph/tree/priority-queue libraries).
Fares, flight numbers and schedules are **simulated demonstration data**, not real airline information.

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 25 automated tests in the terminal (same tests appear on the in-app Self-Tests page)
npm run build    # type-check + production build into dist/
```

## Deploy to GitHub Pages
1. Create a repo, upload these files (drag and drop works: there are only 18), commit to `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**. `.github/workflows/deploy.yml` tests, builds and publishes.
   (The `.github` folder is hidden on some file managers; make sure it is uploaded, or add the file via **Add file → Create new file** with the path `.github/workflows/deploy.yml`.)

## Files
| File | Contents |
|---|---|
| `src/algorithms.ts` | Graph ADTs (list + matrix), BFS, DFS + edge classification, components, Kosaraju SCC, Kahn topological sort, Dijkstra, Prim, Kruskal + union-find, BST, AVL (rotations, trace, `verify()`), general tree, expression tree, validation, seeded RNG, benchmarks |
| `src/data.ts` | 15 airports + 34 demo routes (single central routes array) |
| `src/types.ts` | TypeScript interfaces |
| `src/store.ts` | State + localStorage + CRUD validation |
| `src/components.tsx` | Tree drawing, Leaflet map, stat card |
| `src/pages.tsx` | All pages |
| `src/tests.ts`, `src/cli.ts` | 25 self-tests and terminal runner |
| `src/App.tsx`, `src/main.tsx`, `src/styles.css` | App shell (collapsible/hideable sidebar), entry, styling |

Routes are stored once; every graph is derived from that array. Deleting an airport also deletes its flights.
