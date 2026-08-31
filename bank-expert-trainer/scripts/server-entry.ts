import { join } from "node:path";
import { AppStore } from "../src/store.js";
import { startServer } from "../src/server.js";

async function main(): Promise<void> {
  const root = process.env.APP_ROOT ?? process.cwd();
  const dataDir = process.env.DATA_DIR ?? process.env.APP_DATA_DIR ?? join(root, "data");
  const staticDir = process.env.STATIC_DIR ?? join(root, "dist", "web");
  const port = Number(process.env.APP_PORT ?? process.env.PORT ?? 8866);
  const store = new AppStore(dataDir);
  await store.init();
  const handle = await startServer({ store, port, staticDir });
  console.log("银行优秀员工 Skill 培训平台已启动（合成环境 only）");
  console.log(`打开 ${handle.url}/`);
  console.log(`健康检查 ${handle.url}/health`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
