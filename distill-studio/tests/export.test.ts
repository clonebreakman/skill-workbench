import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { exportPackages } from "../src/phases/export-packages.js";
import type { DimensionBundle, EvidenceItem } from "../src/types.js";

describe("exportPackages", () => {
  it("writes openpersona and training-skill trees", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ds-exp-"));
    const store = new AppStore(dir);
    await store.init();
    const subject = await store.createSubject({
      slug: "wang-min",
      name: "王敏",
      type: "known",
      profile: { title: "柜员", org: "演示支行" },
    });

    const dimensions: DimensionBundle = {
      procedure: {
        scope: "柜面查询",
        workflows: ["核身", "只读查询"],
        decisionRules: ["转账转主管"],
        forbidden: ["不得口头报完整卡号"],
        knowledgeRefs: [],
      },
      interaction: {
        expression: ["先共情"],
        heuristics: ["急事先安抚"],
        interpersonal: "耐心",
      },
      memory: { refs: [] },
      personality: {
        identity: "优秀柜员王敏",
        antiPatterns: ["通融代查"],
        limits: ["不做合规终审"],
      },
    };
    const evidence: EvidenceItem[] = [
      { id: "EV-1", level: "L1", claim: "核身", quote: "核对身份" },
    ];

    const paths = await exportPackages(store, {
      subjectId: subject.id,
      version: 1,
      dimensions,
      evidence,
    });

    const skillMd = await readFile(join(paths.trainingSkillPath, "SKILL.md"), "utf8");
    expect(skillMd).toContain("name:");
    const meta = JSON.parse(await readFile(join(paths.trainingSkillPath, "meta.json"), "utf8"));
    expect(meta.source).toBe("distill-studio");
    expect(meta.packageId).toBe(paths.package.id);
    await readFile(join(paths.openPersonaPath, "persona.json"), "utf8");
    await readFile(join(paths.openPersonaPath, "soul", "constitution.md"), "utf8");
    // also assert store recorded package
    const pkgs = await store.listPackages(subject.id);
    expect(pkgs.length).toBe(1);
    expect(pkgs[0]?.version).toBe(1);
  });
});
