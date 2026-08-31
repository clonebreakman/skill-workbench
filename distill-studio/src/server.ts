import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { AddressInfo } from "node:net";
import { classifySubject } from "./phases/classify.js";
import { validateIntake } from "./phases/intake.js";
import { applyCorrection, correctAndRepublish, rollbackPackage } from "./phases/evolve.js";
import { comparePackages } from "./phases/compare-packages.js";
import { prunePackages } from "./phases/prune-packages.js";
import { zipTrainingSkillDir } from "./phases/zip-export.js";
import { normalizeImportPayload } from "./phases/import-material.js";
import { seedDemoTeller } from "./demo-seed.js";
import { publishRun, runFullPipeline } from "./pipeline.js";
import { llmPing } from "./adapters/llm.js";
import { FeishuClient, parseFeishuDocToken } from "./adapters/feishu.js";
import type { AppStore } from "./store.js";
import type { AdapterKind, MaterialKind, Sensitivity, SubjectType } from "./types.js";

const MAX_BODY = 512 * 1024;

const BAD_REQUEST = new Set([
  "ETHICS_BLOCKED",
  "CONSENT_REQUIRED",
  "PURPOSE_REQUIRED",
  "RAW_PII_CLAIM",
  "INTAKE_INCOMPLETE",
  "RAW_NOT_ALLOWED",
  "EVIDENCE_BELOW_THRESHOLD",
  "INVALID_FILENAME",
  "BODY_TOO_LARGE",
  "RUN_NOT_PUBLISHABLE",
  "RUN_INCOMPLETE",
  "PACKAGE_NOT_FOUND",
  "PACKAGE_VERSION_NOT_FOUND",
  "PACKAGE_SUBJECT_MISMATCH",
  "MATERIAL_NOT_FOUND",
  "EMPTY_IMPORT",
  "INVALID_VERSION",
  "LLM_BASE_URL_REQUIRED",
  "FEISHU_NOT_CONFIGURED",
  "FEISHU_AUTH_FAILED",
  "FEISHU_DOC_NOT_FOUND",
  "FEISHU_FORBIDDEN",
  "FEISHU_BAD_URL",
  "FEISHU_EMPTY_CONTENT",
]);

export interface ServerOptions {
  store: AppStore;
  port?: number;
  staticDir?: string;
}

export async function startServer(
  options: ServerOptions,
): Promise<{ url: string; close(): Promise<void> }> {
  const host = "127.0.0.1";
  const port = options.port ?? 8877;
  const server = createServer((req, res) => {
    void handle(req, res, options);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address() as AddressInfo;
  return {
    url: `http://${host}:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  options: ServerOptions,
): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const method = request.method ?? "GET";

    if (method === "GET" && path === "/health") {
      return writeJson(response, 200, { ok: true });
    }

    if (method === "GET" && path === "/api/handoff") {
      const packages = await options.store.listPackages();
      const subjects = await options.store.listSubjects();
      const activeIds = new Set(
        subjects.map((s) => s.activePackageId).filter((id): id is string => Boolean(id)),
      );
      const active = packages.filter((p) => activeIds.has(p.id));
      let trainer: { ok: boolean; url: string; detail?: string } = {
        ok: false,
        url: "http://127.0.0.1:8866/",
      };
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1500);
        const res = await fetch("http://127.0.0.1:8866/health", { signal: controller.signal });
        clearTimeout(timer);
        trainer = {
          ok: res.ok,
          url: "http://127.0.0.1:8866/",
          detail: res.ok ? "培训端在线" : `HTTP ${res.status}`,
        };
      } catch (e) {
        trainer = {
          ok: false,
          url: "http://127.0.0.1:8866/",
          detail: e instanceof Error && e.name === "AbortError" ? "超时" : "未启动或不可达",
        };
      }
      return writeJson(response, 200, {
        ok: true,
        trainer,
        activePackages: active.map((p) => ({
          id: p.id,
          version: p.version,
          slug: p.slug,
          subjectName: p.subjectName,
          trainingSkillPath: p.trainingSkillPath,
        })),
        importUrl: "http://127.0.0.1:8866/import",
      });
    }

    if (method === "GET" && path === "/api/dashboard") {
      const db = await options.store.load();
      return writeJson(response, 200, {
        ok: true,
        summary: {
          subjects: db.subjects.length,
          materials: db.materials.length,
          runs: db.runs.length,
          packages: db.packages.length,
          drafts: db.runs.filter((r) => r.status === "draft").length,
          published: db.packages.length,
        },
      });
    }

    if (method === "GET" && path === "/api/subjects") {
      return writeJson(response, 200, { ok: true, subjects: await options.store.listSubjects() });
    }

    if (method === "POST" && path === "/api/subjects") {
      const body = await readJson(request);
      const hint = typeof body.hint === "string" ? body.hint : undefined;
      const classified = classifySubject({
        hint,
        explicitType: body.type as SubjectType | undefined,
      });
      const subject = await options.store.createSubject({
        slug: String(body.slug ?? "subject"),
        name: String(body.name ?? "未命名"),
        type: classified.type,
        profile: (body.profile as { title?: string; org?: string }) ?? {},
      });
      if (classified.tags.length > 0) {
        await options.store.updateSubject(subject.id, { tags: classified.tags });
        subject.tags = classified.tags;
      }
      return writeJson(response, 200, { ok: true, subject });
    }

    if (method === "GET" && path.startsWith("/api/subjects/") && path.split("/").length === 4) {
      const id = decodeURIComponent(path.split("/")[3]!);
      const subject = await options.store.getSubject(id);
      if (!subject) return writeJson(response, 404, { ok: false, reason: "SUBJECT_NOT_FOUND" });
      return writeJson(response, 200, { ok: true, subject });
    }

    if (method === "POST" && path.match(/^\/api\/subjects\/[^/]+\/ethics$/)) {
      const id = decodeURIComponent(path.split("/")[3]!);
      const body = await readJson(request);
      const subject = await options.store.updateSubject(id, {
        ethics: {
          consent: Boolean(body.consent),
          purposeOk: Boolean(body.purposeOk),
          noRawPiiClaim: Boolean(body.noRawPiiClaim),
          checkedAt: new Date().toISOString(),
        },
      });
      return writeJson(response, 200, { ok: true, subject });
    }

    if (method === "POST" && path.match(/^\/api\/subjects\/[^/]+\/intake$/)) {
      const id = decodeURIComponent(path.split("/")[3]!);
      const body = await readJson(request);
      const intake = {
        purpose: String(body.purpose ?? ""),
        scope: String(body.scope ?? ""),
        taboo: String(body.taboo ?? ""),
      };
      const gate = validateIntake(intake);
      if (!gate.ok) throw new Error(gate.reason ?? "INTAKE_INCOMPLETE");
      const subject = await options.store.updateSubject(id, { intake });
      return writeJson(response, 200, { ok: true, subject });
    }

    if (method === "GET" && path === "/api/materials") {
      const subjectId = url.searchParams.get("subjectId");
      if (subjectId) {
        return writeJson(response, 200, {
          ok: true,
          materials: await options.store.listMaterials(subjectId),
        });
      }
      const db = await options.store.load();
      return writeJson(response, 200, { ok: true, materials: db.materials });
    }

    if (method === "GET" && path.match(/^\/api\/materials\/[^/]+$/)) {
      const id = decodeURIComponent(path.split("/")[3]!);
      const db = await options.store.load();
      const material = db.materials.find((m) => m.id === id);
      if (!material) return writeJson(response, 404, { ok: false, reason: "MATERIAL_NOT_FOUND" });
      const content = await options.store.readMaterialContent(id);
      return writeJson(response, 200, { ok: true, material, content });
    }

    if (method === "POST" && path === "/api/materials") {
      const body = await readJson(request);
      const material = await options.store.addMaterial({
        subjectId: String(body.subjectId ?? ""),
        kind: (body.kind as MaterialKind) ?? "script",
        title: String(body.title ?? "material"),
        sensitivity: (body.sensitivity as Sensitivity) ?? "synthetic",
        fileName: String(body.fileName ?? "material.md"),
        content: String(body.content ?? ""),
      });
      return writeJson(response, 200, { ok: true, material });
    }

    if (method === "POST" && path === "/api/materials/import") {
      const body = await readJson(request);
      const normalized = normalizeImportPayload(
        String(body.raw ?? ""),
        String(body.title ?? "导入素材"),
      );
      const material = await options.store.addMaterial({
        subjectId: String(body.subjectId ?? ""),
        kind: normalized.kind,
        title: normalized.title,
        sensitivity: (body.sensitivity as Sensitivity) ?? "synthetic",
        fileName: normalized.fileName,
        content: normalized.content,
      });
      return writeJson(response, 200, { ok: true, material, normalized });
    }

    if (method === "POST" && path === "/api/materials/feishu-doc") {
      const body = await readJson(request);
      const db = await options.store.load();
      const feishu = {
        appId: String(body.appId ?? db.settings.feishu?.appId ?? ""),
        appSecret: String(body.appSecret ?? db.settings.feishu?.appSecret ?? ""),
      };
      if (!feishu.appId.trim() || !feishu.appSecret.trim()) {
        return writeJson(response, 400, { ok: false, reason: "FEISHU_NOT_CONFIGURED" });
      }
      const subjectId = String(body.subjectId ?? "");
      const rawRef = String(body.docToken ?? body.url ?? "");
      const docToken = parseFeishuDocToken(rawRef);
      const client = new FeishuClient(feishu);
      const content = await client.fetchDocPlainText(docToken);
      const title = String(body.title ?? `飞书文档 ${docToken.slice(0, 8)}`);
      const material = await options.store.addMaterial({
        subjectId,
        kind: "script",
        title,
        sensitivity: (body.sensitivity as Sensitivity) ?? "synthetic",
        fileName: `feishu-${docToken.slice(0, 12)}.md`,
        content,
      });
      return writeJson(response, 200, { ok: true, material, docToken });
    }

    if (method === "POST" && path === "/api/demo/seed") {
      const samplesDir = join(options.store.rootDir, "..", "samples");
      const result = await seedDemoTeller(options.store, {
        samplesDir,
        publish: true,
      });
      return writeJson(response, 200, { ok: true, ...result });
    }

    if (method === "POST" && path === "/api/runs") {
      const body = await readJson(request);
      const materialIds = Array.isArray(body.materialIds)
        ? body.materialIds.map(String)
        : [];
      const run = await runFullPipeline(options.store, {
        subjectId: String(body.subjectId ?? ""),
        materialIds,
      });
      return writeJson(response, 200, { ok: true, run });
    }

    if (method === "GET" && path.match(/^\/api\/runs\/[^/]+$/)) {
      const id = decodeURIComponent(path.split("/")[3]!);
      const run = await options.store.getRun(id);
      if (!run) return writeJson(response, 404, { ok: false, reason: "RUN_NOT_FOUND" });
      return writeJson(response, 200, { ok: true, run });
    }

    if (method === "POST" && path.match(/^\/api\/runs\/[^/]+\/publish$/)) {
      const id = decodeURIComponent(path.split("/")[3]!);
      const result = await publishRun(options.store, id);
      return writeJson(response, 200, { ok: true, ...result });
    }

    if (method === "GET" && path === "/api/packages") {
      const packages = await options.store.listPackages();
      const subjects = await options.store.listSubjects();
      const activeIds = new Set(
        subjects.map((s) => s.activePackageId).filter((id): id is string => Boolean(id)),
      );
      return writeJson(response, 200, {
        ok: true,
        packages: packages.map((p) => ({ ...p, active: activeIds.has(p.id) })),
      });
    }

    if (method === "GET" && path === "/api/packages/compare") {
      const a = url.searchParams.get("a") ?? "";
      const b = url.searchParams.get("b") ?? "";
      if (!a || !b) {
        return writeJson(response, 400, { ok: false, reason: "PACKAGE_NOT_FOUND" });
      }
      const diff = await comparePackages(options.store, a, b);
      return writeJson(response, 200, { ok: true, diff });
    }

    if (method === "POST" && path === "/api/packages/prune") {
      const body = await readJson(request);
      const result = await prunePackages(options.store, {
        keepPerSubject: Number(body.keepPerSubject ?? 2),
        deleteFiles: body.deleteFiles === true || body.deleteFiles === "true",
      });
      return writeJson(response, 200, {
        ok: true,
        kept: result.kept.length,
        removed: result.removed.length,
        deletedDirs: result.deletedDirs.length,
        removedIds: result.removed.map((p) => p.id),
      });
    }

    if (method === "POST" && path.match(/^\/api\/subjects\/[^/]+\/rollback$/)) {
      const subjectId = decodeURIComponent(path.split("/")[3]!);
      const body = await readJson(request);
      const version = Number(body.version);
      if (!Number.isFinite(version) || version < 1) {
        return writeJson(response, 400, { ok: false, reason: "INVALID_VERSION" });
      }
      const pkg = await rollbackPackage(options.store, subjectId, version);
      return writeJson(response, 200, { ok: true, package: { ...pkg, active: true } });
    }

    if (method === "GET" && path.match(/^\/api\/packages\/[^/]+\/preview$/)) {
      const id = decodeURIComponent(path.split("/")[3]!);
      const pkg = await options.store.getPackage(id);
      if (!pkg) return writeJson(response, 404, { ok: false, reason: "PACKAGE_NOT_FOUND" });
      let skillMarkdown = "";
      let meta: Record<string, unknown> = {};
      try {
        skillMarkdown = await readFile(join(pkg.trainingSkillPath, "SKILL.md"), "utf8");
      } catch {
        /* empty */
      }
      try {
        meta = JSON.parse(await readFile(join(pkg.trainingSkillPath, "meta.json"), "utf8")) as Record<
          string,
          unknown
        >;
      } catch {
        /* empty */
      }
      return writeJson(response, 200, { ok: true, package: pkg, skillMarkdown, meta });
    }

    if (method === "POST" && path.match(/^\/api\/packages\/[^/]+\/corrections$/)) {
      const id = decodeURIComponent(path.split("/")[3]!);
      const body = await readJson(request);
      const payload = {
        packageId: id,
        scene: String(body.scene ?? ""),
        wrong: String(body.wrong ?? ""),
        right: String(body.right ?? ""),
      };
      if (body.republish === true || body.republish === "true") {
        const result = await correctAndRepublish(options.store, payload);
        return writeJson(response, 200, { ok: true, ...result });
      }
      const correction = await applyCorrection(options.store, payload);
      return writeJson(response, 200, { ok: true, correction });
    }

    if (method === "GET" && path.match(/^\/api\/packages\/[^/]+\/corrections$/)) {
      const id = decodeURIComponent(path.split("/")[3]!);
      const pkg = await options.store.getPackage(id);
      if (!pkg) return writeJson(response, 404, { ok: false, reason: "PACKAGE_NOT_FOUND" });
      const corrections = await options.store.listCorrections(id);
      return writeJson(response, 200, { ok: true, corrections });
    }

    if (method === "POST" && path.match(/^\/api\/packages\/[^/]+\/zip$/)) {
      const id = decodeURIComponent(path.split("/")[3]!);
      const pkg = await options.store.getPackage(id);
      if (!pkg) return writeJson(response, 404, { ok: false, reason: "PACKAGE_NOT_FOUND" });
      const zipPath = await zipTrainingSkillDir(pkg.trainingSkillPath);
      return writeJson(response, 200, {
        ok: true,
        zipPath,
        trainingSkillPath: pkg.trainingSkillPath,
      });
    }

    if (method === "GET" && path.match(/^\/api\/packages\/[^/]+\/download$/)) {
      const id = decodeURIComponent(path.split("/")[3]!);
      const pkg = await options.store.getPackage(id);
      if (!pkg) return writeJson(response, 404, { ok: false, reason: "PACKAGE_NOT_FOUND" });
      const zipPath = await zipTrainingSkillDir(pkg.trainingSkillPath);
      const info = await stat(zipPath);
      const fileName = basename(zipPath);
      response.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Length": info.size,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      });
      createReadStream(zipPath).pipe(response);
      return;
    }

    if (method === "GET" && path === "/api/settings") {
      const db = await options.store.load();
      return writeJson(response, 200, { ok: true, settings: db.settings });
    }

    if (method === "PUT" && path === "/api/settings") {
      const body = await readJson(request);
      const settings = await options.store.updateSettings({
        adapter: body.adapter as AdapterKind | undefined,
        llm: body.llm as
          | { baseUrl: string; apiKey: string; model: string }
          | undefined,
        feishu: body.feishu as { appId: string; appSecret: string } | undefined,
      });
      return writeJson(response, 200, { ok: true, settings });
    }

    if (method === "POST" && path === "/api/settings/llm-ping") {
      const body = await readJson(request);
      const db = await options.store.load();
      const llm = {
        baseUrl: String(body.baseUrl ?? db.settings.llm?.baseUrl ?? ""),
        apiKey: String(body.apiKey ?? db.settings.llm?.apiKey ?? ""),
        model: String(body.model ?? db.settings.llm?.model ?? "gpt-4o-mini"),
      };
      if (!llm.baseUrl) {
        return writeJson(response, 400, { ok: false, reason: "LLM_BASE_URL_REQUIRED" });
      }
      const result = await llmPing(llm);
      return writeJson(response, 200, { ok: true, ping: result });
    }

    if (method === "POST" && path === "/api/settings/feishu-ping") {
      const body = await readJson(request);
      const db = await options.store.load();
      const feishu = {
        appId: String(body.appId ?? db.settings.feishu?.appId ?? ""),
        appSecret: String(body.appSecret ?? db.settings.feishu?.appSecret ?? ""),
      };
      if (!feishu.appId.trim() || !feishu.appSecret.trim()) {
        return writeJson(response, 400, { ok: false, reason: "FEISHU_NOT_CONFIGURED" });
      }
      const client = new FeishuClient(feishu);
      const ping = await client.ping();
      return writeJson(response, 200, { ok: true, ping });
    }

    if (method === "GET" && options.staticDir) {
      const served = await serveStatic(response, options.staticDir, path);
      if (served) return;
    }

    writeJson(response, 404, { ok: false, reason: "NOT_FOUND" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const status =
      reason === "SUBJECT_NOT_FOUND" ||
      reason === "RUN_NOT_FOUND" ||
      reason === "PACKAGE_NOT_FOUND" ||
      reason === "MATERIAL_NOT_FOUND"
        ? 404
        : BAD_REQUEST.has(reason)
          ? 400
          : 500;
    if (!response.headersSent) {
      writeJson(response, status, { ok: false, reason });
    }
  }
}

async function serveStatic(
  response: ServerResponse,
  staticDir: string,
  pathName: string,
): Promise<boolean> {
  let relative = pathName === "/" ? "/index.html" : pathName;
  if (!relative.includes(".")) {
    relative = "/index.html";
  }
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
    response.writeHead(200, { "content-type": type });
    response.end(data);
    return true;
  } catch {
    return false;
  }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY) {
      throw new Error("BODY_TOO_LARGE");
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
