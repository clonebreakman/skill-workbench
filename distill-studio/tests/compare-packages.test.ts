import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { comparePackages } from "../src/phases/compare-packages.js";
import type { PackageRecord } from "../src/types.js";

async function writePkg(
  store: AppStore,
  subjectId: string,
  version: number,
  work: object,
  persona: object,
): Promise<PackageRecord> {
  const folder = join(store.exportsDir, "training-skill", `cmp-v${version}`);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "work-skill.json"), JSON.stringify(work), "utf8");
  await writeFile(join(folder, "persona.json"), JSON.stringify(persona), "utf8");
  await writeFile(join(folder, "SKILL.md"), "# x\n", "utf8");
  await writeFile(
    join(folder, "meta.json"),
    JSON.stringify({ source: "distill-studio", version, slug: "cmp" }),
    "utf8",
  );
  const pkg: PackageRecord = {
    id: `PKG-v${version}`,
    subjectId,
    version,
    openPersonaPath: folder,
    trainingSkillPath: folder,
    publishedAt: new Date().toISOString(),
    synthetic: true,
  };
  await store.addPackage(pkg);
  return pkg;
}

describe("comparePackages", () => {
  it("reports added forbidden and antiPatterns", async () => {
    const root = await mkdtemp(join(tmpdir(), "ds-cmp-"));
    const store = new AppStore(root);
    await store.init();
    const subject = await store.createSubject({
      slug: "cmp",
      name: "对比",
      type: "known",
      profile: {},
    });

    const baseWork = {
      scope: "柜面",
      workflows: ["核身"],
      decisionRules: ["转主管"],
      forbidden: ["完整卡号"],
      knowledgeRefs: [],
    };
    const basePersona = {
      identity: "柜员",
      expression: ["理解您着急"],
      heuristics: [],
      interpersonal: "耐心",
      antiPatterns: ["通融代查"],
      limits: [],
    };
    const a = await writePkg(store, subject.id, 1, baseWork, basePersona);
    const b = await writePkg(
      store,
      subject.id,
      2,
      { ...baseWork, forbidden: ["完整卡号", "索要密码"], workflows: ["核身", "只读查询"] },
      { ...basePersona, antiPatterns: ["通融代查", "口头报卡号"] },
    );

    const diff = await comparePackages(store, a.id, b.id);
    expect(diff.work.addedForbidden).toContain("索要密码");
    expect(diff.work.addedWorkflows).toContain("只读查询");
    expect(diff.persona.addedAntiPatterns).toContain("口头报卡号");
    expect(diff.summary.some((s) => s.includes("禁区") || s.includes("流程"))).toBe(true);
  });
});
