const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const net = require("node:net");

const PREFERRED_PORT = Number(process.env.APP_PORT || process.env.PORT || 8866);
const ROOT = path.join(__dirname, "..");
const USER_DATA =
  process.env.TRAINER_ELECTRON_USER_DATA ||
  path.join(process.env.USERPROFILE || ROOT, ".bank-expert-trainer-electron");

app.setPath("userData", USER_DATA);

let child = null;
let win = null;
let usedPort = PREFERRED_PORT;
let spawnedByUs = false;

function resourcesRoot() {
  return app.isPackaged ? process.resourcesPath : ROOT;
}

function webIndexPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "web", "index.html");
  }
  return path.join(ROOT, "dist", "web", "index.html");
}

function serverEntry() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server.cjs");
  }
  return path.join(ROOT, "dist", "server.cjs");
}

function probeHealth(port) {
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

function waitHealth(port, retries = 50) {
  return new Promise((resolve, reject) => {
    const tick = async (left) => {
      if (await probeHealth(port)) return resolve();
      if (left <= 0) return reject(new Error(`health failed on ${port}`));
      setTimeout(() => tick(left - 1), 400);
    };
    tick(retries);
  });
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function pickPort(start) {
  for (let p = start; p < start + 20; p++) {
    if (await probeHealth(p)) return { port: p, reuse: true };
    if (await canListen(p)) return { port: p, reuse: false };
  }
  throw new Error(`端口 ${start}-${start + 19} 均不可用`);
}

function startServer(port) {
  const dataDir = path.join(app.getPath("userData"), "data");
  const staticDir = app.isPackaged
    ? path.join(process.resourcesPath, "web")
    : path.join(ROOT, "dist", "web");
  const env = {
    ...process.env,
    APP_PORT: String(port),
    PORT: String(port),
    DATA_DIR: dataDir,
    STATIC_DIR: staticDir,
    APP_ROOT: app.isPackaged ? process.resourcesPath : ROOT,
  };

  const bundled = serverEntry();
  if (fs.existsSync(bundled)) {
    child = spawn(process.execPath, [bundled], {
      cwd: resourcesRoot(),
      env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: "inherit",
    });
    spawnedByUs = true;
    return;
  }

  const tsx = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const entry = path.join(ROOT, "src", "main.ts");
  child = spawn(tsx, [entry], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  spawnedByUs = true;
}

async function createWindow() {
  if (!fs.existsSync(webIndexPath())) {
    dialog.showErrorBox(
      "Bank Expert Trainer",
      "缺少 Web 静态资源。请先执行：pnpm build:web && pnpm build:server",
    );
    app.quit();
    return;
  }

  const picked = await pickPort(PREFERRED_PORT);
  usedPort = picked.port;
  if (!picked.reuse) {
    startServer(usedPort);
  } else {
    console.log(`复用已运行的 Trainer 服务 :${usedPort}`);
  }
  await waitHealth(usedPort);

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: `Bank Expert Trainer${usedPort !== PREFERRED_PORT ? ` (:${usedPort})` : ""}`,
    webPreferences: { contextIsolation: true },
  });
  await win.loadURL(`http://127.0.0.1:${usedPort}/`);
}

app.whenReady().then(createWindow).catch(async (err) => {
  console.error(err);
  dialog.showErrorBox(
    "Bank Expert Trainer 启动失败",
    `${err && err.message ? err.message : String(err)}\n\n可尝试结束占用 8866 的进程后重试`,
  );
  app.quit();
});

function killChild() {
  if (spawnedByUs && child && !child.killed) {
    child.kill();
  }
}

app.on("window-all-closed", () => {
  killChild();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  killChild();
});
