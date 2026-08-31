import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { importTrainingSkill } from "../src/import-skill.js";

describe("importTrainingSkill", () => {
  it("imports training-skill directory into store", async () => {
    const root = await mkdtemp(join(tmpdir(), "bet-imp-"));
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
        synthetic: true,
        packageId: "PKG-test",
      }),
      "utf8",
    );
    await writeFile(join(skillDir, "SKILL.md"), "---\nname: wang-min\ndescription: demo\n---\n", "utf8");
    await writeFile(
      join(skillDir, "work-skill.json"),
      JSON.stringify({
        scope: "柜面",
        workflows: ["核身"],
        decisionRules: [],
        forbidden: ["完整卡号"],
        knowledgeRefs: [],
      }),
      "utf8",
    );
    await writeFile(
      join(skillDir, "persona.json"),
      JSON.stringify({
        identity: "王敏",
        expression: ["理解您着急"],
        heuristics: [],
        interpersonal: "耐心",
        antiPatterns: [],
        limits: [],
      }),
      "utf8",
    );
    await writeFile(
      join(skillDir, "evidence.jsonl"),
      JSON.stringify({ id: "EV-1", level: "L1", claim: "核身", quote: "核对身份" }) + "\n",
      "utf8",
    );

    const skill = await importTrainingSkill(store, skillDir);
    expect(skill.slug).toBe("wang-min");
    expect(skill.sourcePackageId).toBe("PKG-test");
    expect((await store.listSkills()).length).toBe(1);
    expect(skill.workSkill.workflows[0]).toBe("核身");
  });
});
