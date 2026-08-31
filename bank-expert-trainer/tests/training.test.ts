import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { runDistillJob } from "../src/distill/pipeline.js";
import { markReviewed, publishJob } from "../src/distill/publish.js";
import { listScenarios } from "../src/training/scenarios.js";
import {
  buildProgress,
  completeTrainingSession,
  startTrainingSession,
  submitTraineeTurn,
} from "../src/training/session.js";
import { renderSessionTranscript } from "../src/training/export-transcript.js";
import { scoreTraineeAgainstSkill } from "../src/training/score.js";

async function publishDemoSkill(store: AppStore) {
  const employee = await store.createEmployee({
    name: "王敏",
    title: "柜员",
    branch: "演示支行",
    slug: "wang-min",
  });
  const material = await store.addMaterial({
    employeeId: employee.id,
    kind: "script",
    title: "话术",
    sensitivity: "synthetic",
    fileName: "x.md",
    content: "柜员：理解您着急，先核对身份。\n\n柜员：只读查询余额。\n\n柜员：转账需转主管。",
  });
  const job = await runDistillJob(store, {
    employeeId: employee.id,
    materialIds: [material.id],
  });
  const reviewed = await markReviewed(job);
  await store.upsertJob(reviewed);
  return publishJob(store, reviewed.id);
}

describe("training module", () => {
  it("lists synthetic scenarios", () => {
    expect(listScenarios().length).toBeGreaterThanOrEqual(3);
  });

  it("scores higher for compliant empathetic replies", () => {
    const skill = {
      id: "s1",
      employeeId: "e1",
      version: 1,
      slug: "demo",
      workSkill: {
        scope: "x",
        workflows: [],
        decisionRules: [],
        forbidden: ["不得口报完整证件号/卡号"],
        knowledgeRefs: [],
      },
      persona: {
        identity: "x",
        expression: ["先共情"],
        heuristics: [],
        interpersonal: "耐心",
        antiPatterns: [],
        limits: [],
      },
      evidence: [],
      publishedAt: new Date().toISOString(),
      synthetic: true as const,
      dirPath: ".",
    };
    const scenario = listScenarios().find((item) => item.id === "scn-family-proxy")!;
    const good = scoreTraineeAgainstSkill({
      skill,
      scenario,
      turns: [
        { role: "customer", text: "代查", at: "" },
        {
          role: "trainee",
          text: "理解您着急。必须本人或合法授权，我不能通融代查他人账户。",
          at: "",
        },
      ],
    });
    const bad = scoreTraineeAgainstSkill({
      skill,
      scenario,
      turns: [
        { role: "customer", text: "代查", at: "" },
        { role: "trainee", text: "行吧通融一下先帮你查，密码告诉我。", at: "" },
      ],
    });
    expect(good.overall).toBeGreaterThan(bad.overall);
    expect(good.compliance).toBeGreaterThan(bad.compliance);
    expect(good.matchedSuccess?.length).toBeGreaterThan(0);
    expect(bad.matchedFail?.length).toBeGreaterThan(0);
    expect(bad.tips?.length).toBeGreaterThan(0);
  });

  it("runs roleplay session against published skill", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bet-train-"));
    const store = new AppStore(dir);
    await store.init();
    const skill = await publishDemoSkill(store);

    const session = await startTrainingSession(store, {
      traineeId: "TRAINEE-1",
      skillId: skill.id,
      scenarioId: "scn-balance-inquiry",
    });
    expect(session.turns[0]?.role).toBe("customer");

    const after = await submitTraineeTurn(
      store,
      session.id,
      "理解您着急。我们先核对身份和账户归属，再做只读余额查询，不会口头报完整卡号。",
    );
    expect(after.turns.some((turn) => turn.role === "trainee")).toBe(true);
    expect(after.turns.at(-1)?.role).toBe("customer");

    const done = await completeTrainingSession(store, session.id);
    expect(done.status).toBe("completed");
    expect(done.score?.overall).toBeGreaterThan(50);

    const progress = buildProgress(await store.listSessions());
    expect(progress.completed).toBe(1);
    expect(progress.averageOverall).not.toBeNull();

    const md = renderSessionTranscript({ session: done, skill });
    expect(md).toContain("# 对练记录");
    expect(md).toContain("## 对话");
    expect(md).toContain("## 评分");
    expect(md).toContain(skill.slug);
    expect(md).toContain("余额");
  });
});
