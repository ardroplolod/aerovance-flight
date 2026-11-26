// AEROVANCE: Advanced Flight Experience — the make.fun entry program (Node 22, standard library only).
//
// The game itself is game/: static files a desktop browser plays offline (game/index.html, its ES
// modules under game/src/ and three.js vendored as game/vendor/three.module.min.js). This program
// hands it in: it copies game/ and screenshots/ from beside this file into the output directory and
// writes dossier.json with buildDossier from the kit's vendored library (vendor/makefun-game.ts).
//
// Play locally:  node serve.ts   then open http://localhost:8080
// Hand in:       mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   (the grader uses /output)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The gate's own limits (the same numbers the kit's scorer enforces).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
