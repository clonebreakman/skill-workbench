import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppStore } from "../src/store.js";
import { importTrainingSkill } from "../src/import-skill.js";
import { buildTrainerHandoff, resolveDistillPackageId } from "../src/handoff.js";
import { startServer } from "../src/server.js";

const handles: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  while (handles.length) {
    await handles.pop()?.close();
  }
  vi.unstubAllGlobals();
});

describe("handoff and feedback", () => {
  it("imports sourcePackageId from meta", async () => {
    const root = await mkdtemp(join(tmpdir(), "bet-pkgid-"));
    const store = new AppStore(root);
    await store.init();
    const skillDir = join(root, "incoming", "wang-min-v1");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "meta.json"),
      JSON.stringify({
        source: "distill-studio",
        slug: "wang-min",
        version: 1,
        packageId: "PKG-demo01",
        synthetic: true,
      }),
      "utf8",
    );
    await writeFile(join(skillDir, "SKILL.md"), "---\nname: wang-min\ndescription: demo\n---\n", "utf8");
    await writeFile(
      join(skillDir, "work-skill.json"),
      JSON.stringify({
        scope: "柜面",
        workflows: [],
        decisionRules: [],
        forbidden: [],
        knowledgeRefs: [],
      }),
      "utf8",
    );
    await writeFile(
      join(skillDir, "persona.json"),
      JSON.stringify({
        identity: "王敏",
        expression: [],
        heuristics: [],
        interpersonal: "",
        antiPatterns: [],
        limits: [],
      }),
      "utf8",
    );
    const skill = await importTrainingSkill(store, skillDir);
    expect(skill.sourcePackageId).toBe("PKG-demo01");
  });

  it("buildTrainerHandoff probes distill health", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/health")) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        throw new Error(`unexpected ${url}`);
      }),
    );
    const empty = await mkdtemp(join(tmpdir(), "bet-ho-"));
    const handoff = await buildTrainerHandoff({ exportRoots: [empty] });
    expect(handoff.distill.ok).toBe(true);
    expect(handoff.discoverCount).toBe(0);
    expect(handoff.evolveUrl).toContain("/evolve");
  });

  it("resolveDistillPackageId matches slug+version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            packages: [
              { id: "PKG-a", slug: "wang-min", version: 1, active: false },
              { id: "PKG-b", slug: "wang-min", version: 2, active: true },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    expect(await resolveDistillPackageId({ slug: "wang-min", version: 1 })).toBe("PKG-a");
    expect(await resolveDistillPackageId({ slug: "wang-min" })).toBe("PKG-b");
  });

  it("POST /api/feedback/correction proxies to Distill", async () => {
    const root = await mkdtemp(join(tmpdir(), "bet-fb-"));
    const store = new AppStore(root);
    await store.init();
    const skillDir = join(root, "incoming", "x-v1");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "meta.json"),
      JSON.stringify({
        source: "distill-studio",
        slug: "wang-min",
        version: 1,
        packageId: "PKG-fb01",
        synthetic: true,
      }),
      "utf8",
    );
    await writeFile(join(skillDir, "SKILL.md"), "x", "utf8");
    await writeFile(
      join(skillDir, "work-skill.json"),
      JSON.stringify({
        scope: "x",
        workflows: [],
        decisionRules: [],
        forbidden: [],
        knowledgeRefs: [],
      }),
      "utf8",
    );
    await writeFile(
      join(skillDir, "persona.json"),
      JSON.stringify({
        identity: "x",
        expression: [],
        heuristics: [],
        interpersonal: "",
        antiPatterns: [],
        limits: [],
      }),
      "utf8",
    );
    const skill = await importTrainingSkill(store, skillDir);

    const realFetch = globalThis.fetch.bind(globalThis);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/packages/") && url.includes("/corrections") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            ok: true,
            correction: { id: "COR-1" },
            package: { id: "PKG-new", version: 2 },
          }),
          { status: 200 },
        );
      }
      return realFetch(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    const handle = await startServer({ store, port: 0 });
    handles.push(handle);
    const res = await fetch(`${handle.url}/api/feedback/correction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        skillId: skill.id,
        scene: "代查",
        wrong: "通融",
        right: "需授权",
        republish: true,
      }),
    });
    const body = (await res.json()) as { ok: boolean; packageId: string };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.packageId).toBe("PKG-fb01");
    const distillCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/api/packages/PKG-fb01/corrections"),
    );
    expect(distillCall).toBeTruthy();
  });
});
