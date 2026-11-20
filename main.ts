// main.ts — hands in the Leonida Ledger guide for gta6-trophy-guide-01.
// Copies app/ and screenshots/ from this repository into the output
// directory (MAKEFUN_OUTPUT_DIR, or /output in the grader) and writes the
// entry's dossier.json there with the kit's own buildDossier, under the
// same caps the bounty gate uses, so the dossier is byte for byte the one
// the scorer rebuilds. Node 22, standard library only.
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// The gate's caps for this bounty (competition reference limits): dossier
// text at most 163,840 bytes, at most 4 screenshots of at most 256 KiB,
// app/ at most 993 entries and 48 MiB, paths at most 1,000 bytes.
const GATE_CAPS = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  app_max_files: 993,
  app_max_bytes: 48 * 1024 * 1024,
  app_path_max_bytes: 1000,
};

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, "app"), join(outDir, "app"), { recursive: true, force: true });
cpSync(join(repoRoot, "screenshots"), join(outDir, "screenshots"), { recursive: true, force: true });

const dossier = buildDossier(outDir, GATE_CAPS);
writeFileSync(join(outDir, "dossier.json"), dossier);

console.log(`main.ts: copied app/ and screenshots/ to ${outDir}`);
console.log(`main.ts: wrote dossier.json (${dossier.byteLength} bytes)`);
