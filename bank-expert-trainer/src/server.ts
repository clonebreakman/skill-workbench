import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { AddressInfo } from "node:net";
import { runDistillJob } from "./distill/pipeline.js";
import { markReviewed, publishJob } from "./distill/publish.js";
import { strongEvidenceRatio } from "./distill/evidence.js";
import { defaultExportRoots, discoverTrainingSkills } from "./discover-skills.js";
import { importTrainingSkill } from "./import-skill.js";
import { importTrainingSkillZip, importTrainingSkillZipBase64 } from "./import-skill-zip.js";
import {
  buildTrainerHandoff,
  postCorrectionToDistill,
  resolveDistillPackageId,
} from "./handoff.js";
import { listScenarios } from "./training/scenarios.js";
import { renderSessionTranscript } from "./training/export-transcript.js";
import {
  buildProgress,
  completeTrainingSession,
  startTrainingSession,
  submitTraineeTurn,
} from "./training/session.js";
import type { AppStore } from "./store.js";

const MAX_BODY = 512 * 1024;
const MAX_ZIP_BODY = 16 * 1024 * 1024;

export interface ServerOptions {
  store: AppStore;
  port?: number;
  staticDir?: string;
}

export async function startServer(options: ServerOptions): Promise<{ url: string; close(): Promise<void> }> {
  const host = "127.0.0.1";
  const port = options.port ?? 0;
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
      return writeJson(response, 200, { ok: true, syntheticOnly: true });
    }

    if (method === "GET" && path === "/api/dashboard") {
      const db = await options.store.load();
      return writeJson(response, 200, {
        ok: true,
        summary: {
          employees: db.employees.length,
          materials: db.materials.length,
          jobs: db.jobs.length,
          publishedSkills: db.skills.length,
          pendingMaterials: db.materials.length,
          trainingSessions: db.sessions?.length ?? 0,
          completedTrainings: (db.sessions ?? []).filter((s) => s.status === "completed").length,
        },
      });
    }

    if (method === "GET" && path === "/api/handoff") {
      const handoff = await buildTrainerHandoff();
      return writeJson(response, 200, { ok: true, ...handoff });
    }

    if (method === "POST" && path === "/api/feedback/correction") {
      const body = await readJson(request);
      let packageId = body.packageId ? String(body.packageId) : "";
      const skillId = body.skillId ? String(body.skillId) : "";
      let slug: string | undefined;
      let version: number | undefined;
      if (skillId) {
        const skill = await options.store.getSkillById(skillId);
        if (!skill) {
          return writeJson(response, 404, { ok: false, reason: "SKILL_NOT_FOUND" });
        }
        if (!packageId && skill.sourcePackageId) packageId = skill.sourcePackageId;
        slug = skill.slug;
        version = skill.version;
      }
      if (!packageId) {
        const resolved = await resolveDistillPackageId({ packageId, slug, version });
        packageId = resolved ?? "";
      }
      if (!packageId) {
        return writeJson(response, 400, { ok: false, reason: "PACKAGE_ID_REQUIRED" });
      }
      const result = await postCorrectionToDistill({
        packageId,
        scene: String(body.scene ?? ""),
        wrong: String(body.wrong ?? ""),
        right: String(body.right ?? ""),
        republish: body.republish !== false && body.republish !== "false",
      });
      if (!result.ok) {
        return writeJson(response, 502, { ok: false, reason: result.reason ?? "DISTILL_ERROR" });
      }
      return writeJson(response, 200, {
        ok: true,
        packageId,
        correction: result.correction,
        package: result.package,
      });
    }

    if (method === "GET" && path === "/api/employees") {
      const db = await options.store.load();
      return writeJson(response, 200, { ok: true, employees: db.employees });
    }

    if (method === "POST" && path === "/api/employees") {
      const body = await readJson(request);
      const employee = await options.store.createEmployee({
        name: String(body.name ?? ""),
        title: String(body.title ?? "柜员"),
        branch: String(body.branch ?? "演示支行"),
        slug: body.slug ? String(body.slug) : undefined,
      });
      return writeJson(response, 200, { ok: true, employee });
    }

    if (method === "GET" && path === "/api/materials") {
      const db = await options.store.load();
      return writeJson(response, 200, { ok: true, materials: db.materials });
    }

    if (method === "POST" && path === "/api/materials") {
      const body = await readJson(request);
      const material = await options.store.addMaterial({
        employeeId: String(body.employeeId ?? ""),
        kind: body.kind as "transcript" | "script" | "case" | "policy",
        title: String(body.title ?? "未命名素材"),
        sensitivity: (body.sensitivity as "synthetic" | "redacted") ?? "synthetic",
        fileName: "inline.md",
        content: String(body.content ?? ""),
      });
      return writeJson(response, 200, { ok: true, material });
    }

    if (method === "POST" && path === "/api/distill/jobs") {
      const body = await readJson(request);
      const job = await runDistillJob(options.store, {
        employeeId: String(body.employeeId ?? ""),
        materialIds: Array.isArray(body.materialIds)
          ? body.materialIds.map(String)
          : [],
      });
      return writeJson(response, 200, {
        ok: job.status !== "failed",
        job,
        strongEvidenceRatio: job.draft ? strongEvidenceRatio(job.draft.evidence) : 0,
      });
    }

    if (method === "GET" && path.startsWith("/api/distill/jobs/")) {
      const id = decodeURIComponent(path.slice("/api/distill/jobs/".length));
      const job = await options.store.getJob(id);
      if (!job) {
        return writeJson(response, 404, { ok: false, reason: "JOB_NOT_FOUND" });
      }
      return writeJson(response, 200, {
        ok: true,
        job,
        strongEvidenceRatio: job.draft ? strongEvidenceRatio(job.draft.evidence) : 0,
      });
    }

    if (method === "POST" && path.match(/^\/api\/distill\/jobs\/[^/]+\/review$/)) {
      const id = decodeURIComponent(path.split("/")[4]);
      const job = await options.store.getJob(id);
      if (!job) {
        return writeJson(response, 404, { ok: false, reason: "JOB_NOT_FOUND" });
      }
      const reviewed = await markReviewed(job);
      await options.store.upsertJob(reviewed);
      return writeJson(response, 200, { ok: true, job: reviewed });
    }

    if (method === "POST" && path.match(/^\/api\/skills\/[^/]+\/publish$/)) {
      // path: /api/skills/:employeeId/publish — but we publish by jobId in body for clarity
      const body = await readJson(request);
      const skill = await publishJob(options.store, String(body.jobId ?? ""));
      return writeJson(response, 200, { ok: true, skill });
    }

    if (method === "POST" && path === "/api/skills/import") {
      const body = await readJson(request);
      const skill = await importTrainingSkill(options.store, String(body.dirPath ?? ""));
      return writeJson(response, 200, { ok: true, skill });
    }

    if (method === "POST" && path === "/api/skills/import-zip") {
      const body = await readJson(request, MAX_ZIP_BODY);
      let skill;
      if (body.zipBase64) {
        skill = await importTrainingSkillZipBase64(
          options.store,
          String(body.zipBase64),
          String(body.fileName ?? "skill.zip"),
        );
      } else {
        skill = await importTrainingSkillZip(options.store, String(body.zipPath ?? ""));
      }
      return writeJson(response, 200, { ok: true, skill });
    }

    if (method === "GET" && path === "/api/skills/discover") {
      const rootParam = url.searchParams.get("root");
      const roots = rootParam ? [rootParam] : defaultExportRoots();
      const result = await discoverTrainingSkills(roots);
      return writeJson(response, 200, { ok: true, ...result });
    }

    if (method === "GET" && path === "/api/skills") {
      const skills = await options.store.listSkills();
      return writeJson(response, 200, { ok: true, skills });
    }

    if (method === "GET" && path.startsWith("/api/skills/") && !path.endsWith("/export") && !path.endsWith("/publish") && path !== "/api/skills/discover") {
      const id = decodeURIComponent(path.slice("/api/skills/".length));
      const skills = await options.store.listSkills();
      const skill = skills.find((item) => item.id === id);
      if (!skill) {
        return writeJson(response, 404, { ok: false, reason: "SKILL_NOT_FOUND" });
      }
      return writeJson(response, 200, { ok: true, skill });
    }

    if (method === "GET" && path.match(/^\/api\/skills\/[^/]+\/export$/)) {
      const id = decodeURIComponent(path.split("/")[3]);
      const skills = await options.store.listSkills();
      const skill = skills.find((item) => item.id === id);
      if (!skill) {
        return writeJson(response, 404, { ok: false, reason: "SKILL_NOT_FOUND" });
      }
      const md = await readFile(join(skill.dirPath, "SKILL.md"), "utf8");
      return writeJson(response, 200, {
        ok: true,
        dirPath: skill.dirPath,
        skillMarkdown: md,
      });
    }

    if (method === "GET" && path === "/api/training/scenarios") {
      return writeJson(response, 200, { ok: true, scenarios: listScenarios() });
    }

    if (method === "GET" && path === "/api/training/progress") {
      const sessions = await options.store.listSessions();
      return writeJson(response, 200, { ok: true, progress: buildProgress(sessions), sessions });
    }

    if (method === "POST" && path === "/api/training/sessions") {
      const body = await readJson(request);
      const session = await startTrainingSession(options.store, {
        traineeId: String(body.traineeId ?? "TRAINEE-DEMO"),
        skillId: String(body.skillId ?? ""),
        scenarioId: String(body.scenarioId ?? ""),
      });
      return writeJson(response, 200, { ok: true, session });
    }

    if (method === "GET" && path.match(/^\/api\/training\/sessions\/[^/]+\/transcript\.md$/)) {
      const id = decodeURIComponent(path.split("/")[4]!);
      const session = await options.store.getSession(id);
      if (!session) {
        return writeJson(response, 404, { ok: false, reason: "SESSION_NOT_FOUND" });
      }
      const skill = await options.store.getSkillById(session.skillId);
      const markdown = renderSessionTranscript({ session, skill });
      const fileName = `training-${id}.md`;
      response.writeHead(200, {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${fileName}"`,
      });
      response.end(markdown);
      return;
    }

    if (method === "GET" && path.match(/^\/api\/training\/sessions\/[^/]+\/transcript$/)) {
      const id = decodeURIComponent(path.split("/")[4]!);
      const session = await options.store.getSession(id);
      if (!session) {
        return writeJson(response, 404, { ok: false, reason: "SESSION_NOT_FOUND" });
      }
      const skill = await options.store.getSkillById(session.skillId);
      const markdown = renderSessionTranscript({ session, skill });
      return writeJson(response, 200, { ok: true, markdown });
    }

    if (method === "GET" && path.match(/^\/api\/training\/sessions\/[^/]+$/)) {
      const id = decodeURIComponent(path.split("/")[4]!);
      const session = await options.store.getSession(id);
      if (!session) {
        return writeJson(response, 404, { ok: false, reason: "SESSION_NOT_FOUND" });
      }
      return writeJson(response, 200, { ok: true, session });
    }

    if (method === "POST" && path.match(/^\/api\/training\/sessions\/[^/]+\/turn$/)) {
      const id = decodeURIComponent(path.split("/")[4]);
      const body = await readJson(request);
      const session = await submitTraineeTurn(options.store, id, String(body.text ?? ""));
      return writeJson(response, 200, { ok: true, session });
    }

    if (method === "POST" && path.match(/^\/api\/training\/sessions\/[^/]+\/complete$/)) {
      const id = decodeURIComponent(path.split("/")[4]);
      const session = await completeTrainingSession(options.store, id);
      return writeJson(response, 200, { ok: true, session });
    }

    if (method === "GET" && options.staticDir) {
      const served = await serveStatic(response, options.staticDir, path);
      if (served) return;
    }

    writeJson(response, 404, { ok: false, reason: "NOT_FOUND" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const status =
      reason === "EMPTY_MATERIAL" ||
      reason === "RAW_MATERIAL_NOT_ALLOWED" ||
      reason === "EVIDENCE_BELOW_THRESHOLD" ||
      reason === "JOB_NOT_REVIEWED" ||
      reason === "UNSUPPORTED_SKILL_SOURCE" ||
      reason === "ENOENT" ||
      reason === "EMPTY_TURN" ||
      reason === "SESSION_NOT_ACTIVE" ||
      reason === "SKILL_NOT_FOUND" ||
      reason === "SCENARIO_NOT_FOUND"
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

async function readJson(
  request: IncomingMessage,
  maxBytes = MAX_BODY,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
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
