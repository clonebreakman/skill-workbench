import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import http from "node:http";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = join(root, "..");
const distillRoot = join(workspace, "distill-studio");
const trainerRoot = join(workspace, "bank-expert-trainer");
const staticDir = join(root, "dist", "web");
const logDir = join(root, "data", "logs");

const WORKBENCH_PORT = Number(process.env.WORKBENCH_PORT ?? 8855);
const DISTILL_PORT = Number(process.env.DISTILL_PORT ?? 8877);
const TRAINER_PORT = Number(process.env.TRAINER_PORT ?? 8866);
const AUTO_START = process.env.WORKBENCH_AUTO_START !== "0";

const children: ChildProcess[] = [];

function resolveExportsDir(): string {
  const candidates = [
    process.env.DISTILL_EXPORTS_DIR,
    join(distillRoot, "data", "exports", "training-skill"),
    join(homedir(), "DistillStudio", "data", "exports", "training-skill"),
  ].filter((x): x is string => Boolean(x && String(x).trim()));
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0] ?? join(distillRoot, "data", "exports", "training-skill");
}

function probe(port: number): Promise<boolean> {
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

async function waitHealth(port: number, label: string, retries = 40): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    if (await probe(port)) {
      console.log(`[workbench] ${label} ready :${port}`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.warn(`[workbench] ${label} not ready on :${port}`);
  return false;
}

function startApp(cwd: string, envPortKey: string, port: number, label: string): void {
  const tsx = join(cwd, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const entry = join(cwd, "src", "main.ts");
  if (!existsSync(tsx) || !existsSync(entry)) {
    console.warn(`[workbench] skip start ${label}: missing tsx or main.ts under ${cwd}`);
    return;
  }
  mkdirSync(logDir, { recursive: true });
  const out = createWriteStream(join(logDir, `${label}.out.log`), { flags: "a" });
  const err = createWriteStream(join(logDir, `${label}.err.log`), { flags: "a" });
  const env = {
    ...process.env,
    [envPortKey]: String(port),
    PORT: String(port),
    APP_PORT: String(port),
    DISTILL_EXPORTS_DIR: resolveExportsDir(),
  };
  const child = spawn(tsx, [entry], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    windowsHide: true,
    detached: false,
  });
  child.stdout?.pipe(out);
  child.stderr?.pipe(err);
  child.on("exit", (code) => {
    console.warn(`[workbench] ${label} exited code=${code}`);
  });
  children.push(child);
  console.log(`[workbench] started ${label} on ${port} (pid ${child.pid})`);
}

async function ensureServices(): Promise<{ distill: boolean; trainer: boolean }> {
  let distill = await probe(DISTILL_PORT);
  let trainer = await probe(TRAINER_PORT);
  if (!AUTO_START) return { distill, trainer };

  if (!distill) {
    startApp(distillRoot, "PORT", DISTILL_PORT, "distill-studio");
    distill = await waitHealth(DISTILL_PORT, "distill-studio");
  } else {
    console.log(`[workbench] reuse distill :${DISTILL_PORT}`);
  }
  if (!trainer) {
    startApp(trainerRoot, "APP_PORT", TRAINER_PORT, "bank-expert-trainer");
    trainer = await waitHealth(TRAINER_PORT, "bank-expert-trainer");
  } else {
    console.log(`[workbench] reuse trainer :${TRAINER_PORT}`);
  }
  return { distill, trainer };
}

async function serveStatic(res: ServerResponse, pathName: string): Promise<boolean> {
  let relative = pathName === "/" ? "/index.html" : pathName;
  if (!relative.includes(".")) relative = "/index.html";
  try {
    const filePath = join(staticDir, relative.replace(/^\//, ""));
    const data = await readFile(filePath);
    const type =
      extname(filePath) === ".js"
        ? "text/javascript"
        : extname(filePath) === ".css"
          ? "text/css"
          : extname(filePath) === ".html"
            ? "text/html; charset=utf-8"
            : "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${WORKBENCH_PORT}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  if (method === "GET" && path === "/health") {
    return writeJson(res, 200, { ok: true, role: "workbench" });
  }

  if (method === "GET" && path === "/api/status") {
    const [distill, trainer] = await Promise.all([probe(DISTILL_PORT), probe(TRAINER_PORT)]);
    return writeJson(res, 200, {
      ok: true,
      distill: { ok: distill, url: `http://127.0.0.1:${DISTILL_PORT}/` },
      trainer: { ok: trainer, url: `http://127.0.0.1:${TRAINER_PORT}/` },
      workbench: { url: `http://127.0.0.1:${WORKBENCH_PORT}/` },
    });
  }

  if (method === "POST" && path === "/api/start-services") {
    const prev = process.env.WORKBENCH_AUTO_START;
    process.env.WORKBENCH_AUTO_START = "1";
    const result = await ensureServices();
    process.env.WORKBENCH_AUTO_START = prev;
    return writeJson(res, 200, { ok: true, ...result });
  }

  if (method === "POST" && path === "/api/demo/seed") {
    if (!(await probe(DISTILL_PORT))) {
      await ensureServices();
    }
    if (!(await probe(DISTILL_PORT))) {
      return writeJson(res, 502, { ok: false, reason: "DISTILL_OFFLINE" });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const upstream = await fetch(`http://127.0.0.1:${DISTILL_PORT}/api/demo/seed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        signal: controller.signal,
      });
      clearTimeout(timer);
      const body = (await upstream.json()) as Record<string, unknown>;
      if (!upstream.ok || body.ok === false) {
        return writeJson(res, upstream.status || 502, {
          ok: false,
          reason: body.reason ?? `HTTP_${upstream.status}`,
        });
      }
      return writeJson(res, 200, {
        ok: true,
        ...body,
        trainerImportUrl: `http://127.0.0.1:${TRAINER_PORT}/import`,
        exportsDir: resolveExportsDir(),
      });
    } catch (e) {
      clearTimeout(timer);
      return writeJson(res, 502, {
        ok: false,
        reason: e instanceof Error ? e.message : "SEED_FAILED",
      });
    }
  }

  if (method === "POST" && path === "/api/demo/run") {
    // seed → import training-skill → return autostart training URL
    if (!(await probe(DISTILL_PORT)) || !(await probe(TRAINER_PORT))) {
      await ensureServices();
    }
    if (!(await probe(DISTILL_PORT))) {
      return writeJson(res, 502, { ok: false, reason: "DISTILL_OFFLINE" });
    }
    if (!(await probe(TRAINER_PORT))) {
      return writeJson(res, 502, { ok: false, reason: "TRAINER_OFFLINE" });
    }

    const seedRes = await fetch(`http://127.0.0.1:${DISTILL_PORT}/api/demo/seed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const seedBody = (await seedRes.json()) as {
      ok?: boolean;
      reason?: string;
      subject?: { name?: string };
      package?: { trainingSkillPath?: string; version?: number; id?: string };
    };
    if (!seedRes.ok || seedBody.ok === false) {
      return writeJson(res, seedRes.status || 502, {
        ok: false,
        reason: seedBody.reason ?? "SEED_FAILED",
      });
    }

    let dirPath = String(seedBody.package?.trainingSkillPath ?? "");
    if (!dirPath || !existsSync(dirPath)) {
      const discRes = await fetch(`http://127.0.0.1:${TRAINER_PORT}/api/skills/discover`);
      const disc = (await discRes.json()) as {
        skills?: Array<{ dirPath: string; recommended?: boolean; isZip?: boolean }>;
      };
      const pick =
        disc.skills?.find((s) => s.recommended && !s.isZip) ??
        disc.skills?.find((s) => !s.isZip);
      dirPath = pick?.dirPath ?? "";
    }
    if (!dirPath) {
      return writeJson(res, 502, { ok: false, reason: "NO_TRAINING_SKILL_PATH" });
    }

    const importRes = await fetch(`http://127.0.0.1:${TRAINER_PORT}/api/skills/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dirPath }),
    });
    const importBody = (await importRes.json()) as {
      ok?: boolean;
      reason?: string;
      skill?: { id?: string; slug?: string; version?: number };
    };
    if (!importRes.ok || importBody.ok === false || !importBody.skill?.id) {
      return writeJson(res, importRes.status || 502, {
        ok: false,
        reason: importBody.reason ?? "IMPORT_FAILED",
        dirPath,
      });
    }

    const skillId = importBody.skill.id;
    const trainingUrl = `http://127.0.0.1:${TRAINER_PORT}/training?skillId=${encodeURIComponent(skillId)}&autostart=1`;
    return writeJson(res, 200, {
      ok: true,
      subject: seedBody.subject,
      package: seedBody.package,
      skill: importBody.skill,
      dirPath,
      trainingUrl,
      trainerImportUrl: `http://127.0.0.1:${TRAINER_PORT}/import`,
    });
  }

  if (existsSync(staticDir) && (await serveStatic(res, path))) return;

  writeJson(res, 404, { ok: false, reason: "NOT_FOUND", hint: "run pnpm build:web" });
}

const boot = await ensureServices();

const server = createServer((req, res) => {
  void handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) writeJson(res, 500, { ok: false, reason: "INTERNAL_ERROR" });
  });
});

await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(WORKBENCH_PORT, "127.0.0.1", () => resolve());
});

console.log(`Skill Workbench 已启动 http://127.0.0.1:${WORKBENCH_PORT}/`);
console.log(`蒸馏 ${DISTILL_PORT}=${boot.distill} · 培训 ${TRAINER_PORT}=${boot.trainer}`);

function shutdown() {
  for (const child of children) {
    try {
      if (!child.killed) child.kill();
    } catch {
      /* ignore */
    }
  }
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
