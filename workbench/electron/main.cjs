const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");

const PREFERRED_PORT = Number(process.env.WORKBENCH_PORT || 8855);
const ROOT = path.join(__dirname, "..");
const USER_DATA =
  process.env.WORKBENCH_ELECTRON_USER_DATA ||
  path.join(process.env.USERPROFILE || ROOT, ".skill-workbench-electron");

app.setPath("userData", USER_DATA);

let child = null;
let win = null;
let spawnedByUs = false;
let usedPort = PREFERRED_PORT;

function probe(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitHealth(port, retries = 80) {
  return new Promise((resolve, reject) => {
    const tick = async (left) => {
      if (await probe(port)) return resolve();
      if (left <= 0) return reject(new Error(`workbench health failed on ${port}`));
      setTimeout(() => tick(left - 1), 400);
    };
    tick(retries);
  });
}

function startGateway(port) {
  const tsx = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const entry = path.join(ROOT, "src", "gateway.ts");
  const logDir = path.join(ROOT, "data", "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const out = fs.openSync(path.join(logDir, "gateway.out.log"), "a");
  const err = fs.openSync(path.join(logDir, "gateway.err.log"), "a");
  child = spawn(tsx, [entry], {
    cwd: ROOT,
    env: {
      ...process.env,
      WORKBENCH_PORT: String(port),
      WORKBENCH_AUTO_START: "1",
    },
    stdio: ["ignore", out, err],
    shell: process.platform === "win32",
    windowsHide: true,
  });
  spawnedByUs = true;
}

async function createWindow() {
  const webIndex = path.join(ROOT, "dist", "web", "index.html");
  if (!fs.existsSync(webIndex)) {
    dialog.showErrorBox("Skill Workbench", "缺少 dist/web。请先执行：pnpm build:web");
    app.quit();
    return;
  }

  if (!(await probe(PREFERRED_PORT))) {
    startGateway(PREFERRED_PORT);
  } else {
    console.log(`复用 Workbench :${PREFERRED_PORT}`);
  }
  usedPort = PREFERRED_PORT;
  await waitHealth(usedPort);

  win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "Skill Workbench",
    webPreferences: { contextIsolation: true },
  });
  await win.loadURL(`http://127.0.0.1:${usedPort}/`);
}

app.whenReady().then(createWindow).catch((err) => {
  console.error(err);
  dialog.showErrorBox("Skill Workbench 启动失败", err && err.message ? err.message : String(err));
  app.quit();
});

function killChild() {
  if (spawnedByUs && child && !child.killed) {
    try {
      child.kill();
    } catch (_) {
      /* ignore */
    }
  }
}

app.on("window-all-closed", () => {
  killChild();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", killChild);
