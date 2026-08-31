import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AppStore } from "./store.js";
import { startServer } from "./server.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR ?? process.env.APP_DATA_DIR ?? join(root, "data");
const port = Number(process.env.APP_PORT ?? process.env.PORT ?? 8866);
const staticDir = process.env.STATIC_DIR ?? join(root, "dist", "web");

const store = new AppStore(dataDir);
await store.init();

const handle = await startServer({ store, port, staticDir });

console.log("银行优秀员工 Skill 培训平台已启动（合成环境 only）");
console.log(`打开 ${handle.url}/`);
console.log(`健康检查 ${handle.url}/health`);
console.log("按 Ctrl+C 停止");

const shutdown = async () => {
  await handle.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
