import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const outfile = join(root, "dist", "server.cjs");
await mkdir(dirname(outfile), { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "scripts", "server-entry.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile,
  sourcemap: false,
  logLevel: "info",
});

console.log(`wrote ${outfile}`);
