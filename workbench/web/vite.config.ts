import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  build: {
    outDir: join(root, "..", "dist", "web"),
    emptyOutDir: true,
  },
  server: {
    port: 8856,
    proxy: {
      "/api": "http://127.0.0.1:8855",
    },
  },
});
