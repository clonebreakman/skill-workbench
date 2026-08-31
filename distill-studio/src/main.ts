import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AppStore } from "./store.js";
import { startServer } from "./server.js";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = process.env.DATA_DIR ?? join(root, "data");
const staticDir = process.env.STATIC_DIR ?? join(root, "dist", "web");
const store = new AppStore(dataDir);
await store.init();
const { url } = await startServer({
  store,
  port: Number(process.env.PORT ?? 8877),
  staticDir,
});
console.log(`Distill Studio 已启动\n打开 ${url}/\n健康检查 ${url}/health`);
