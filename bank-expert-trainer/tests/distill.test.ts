import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { runDistillJob } from "../src/distill/pipeline.js";
import { markReviewed, publishJob } from "../src/distill/publish.js";
import { canPublish, strongEvidenceRatio } from "../src/distill/evidence.js";
import { sliceText } from "../src/distill/slice.js";

describe("distill pipeline", () => {
  it("rejects empty materials", () => {
    expect(() =>
      sliceText({ materialId: "m1", employeeId: "e1", text: "   \n\n  " }),
    ).toThrow(/EMPTY_MATERIAL/);
  });

  it("runs mock distill, review, publish and export SKILL.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bet-"));
    const store = new AppStore(dir);
    await store.init();

    const employee = await store.createEmployee({
      name: "王敏",
      title: "柜员",
      branch: "演示支行",
      slug: "wang-min",
    });

    const material = await store.addMaterial({
      employeeId: employee.id,
      kind: "script",
      title: "咨询话术",
      sensitivity: "synthetic",
      fileName: "x.md",
      content: [
        "柜员：理解您着急。我们先核对身份与账户归属。",
        "",
        "柜员：身份一致后查询余额，完整卡号不会口头报出。",
        "",
        "柜员：涉及转账需转主管授权。",
      ].join("\n"),
    });

    const job = await runDistillJob(store, {
      employeeId: employee.id,
      materialIds: [material.id],
    });
    expect(job.status).toBe("draft");
    expect(job.draft?.workSkill.workflows.length).toBeGreaterThan(0);
    expect(job.draft?.persona.identity).toContain("柜员");
    expect(strongEvidenceRatio(job.draft!.evidence)).toBeGreaterThanOrEqual(0.6);
    expect(canPublish(job.draft!.evidence).ok).toBe(true);

    const reviewed = await markReviewed(job);
    await store.upsertJob(reviewed);
    const skill = await publishJob(store, reviewed.id);
    expect(skill.version).toBe(1);
    const md = await readFile(join(skill.dirPath, "SKILL.md"), "utf8");
    expect(md).toContain("name:");
    expect(md).toContain("description:");
    expect(md).toContain("Work Skill");
  });
});
