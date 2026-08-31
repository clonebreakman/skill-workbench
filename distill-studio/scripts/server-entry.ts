import { join } from "node:path";
import { AppStore } from "../src/store.js";
import { startServer } from "../src/server.js";

/** Packaged / ELECTRON_RUN_AS_NODE entry (no top-level await, no import.meta). */
async function main(): Promise<void> {
  const root = process.env.APP_ROOT ?? process.cwd();
  const dataDir = process.env.DATA_DIR ?? join(root, "data");
  const staticDir = process.env.STATIC_DIR ?? join(root, "dist", "web");
  const port = Number(process.env.PORT ?? process.env.APP_PORT ?? 8877);
  const store = new AppStore(dataDir);
  await store.init();
  const { url } = await startServer({ store, port, staticDir });
  console.log(`Distill Studio 已启动\n打开 ${url}/\n健康检查 ${url}/health`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
