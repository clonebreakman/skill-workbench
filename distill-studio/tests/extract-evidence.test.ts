import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mockExtract } from "../src/adapters/mock.js";
import { gradeEvidence, strongEvidenceRatio, canPublish } from "../src/phases/evidence.js";
import { runExtract } from "../src/phases/extract.js";
import { scoreDistillQuality } from "../src/phases/quality.js";

describe("extract and evidence", () => {
  it("mock extract fills four dimensions and evidence", async () => {
    const texts = [
      "理解您着急，先核对身份。只读查询余额。不得口头报完整卡号。转账需转主管。",
    ];
    const dims = mockExtract({
      subjectName: "王敏",
      texts,
    });
    expect(dims.procedure.workflows.length).toBeGreaterThan(0);
    expect(dims.interaction.expression.length).toBeGreaterThan(0);
    expect(dims.personality.layers?.hardRules.length).toBeGreaterThan(0);
    expect(dims.procedure.outputPreferences?.length).toBeGreaterThan(0);
    const quality = scoreDistillQuality(dims);
    expect(quality.score).toBeGreaterThanOrEqual(50);
    const ev = gradeEvidence(dims, texts);
    expect(ev.some((e) => e.level === "L1")).toBe(true);
    expect(strongEvidenceRatio(ev)).toBeGreaterThanOrEqual(0.6);
  });

  it("rich sample covers proxy and complaint cues", async () => {
    const sample = await readFile(
      join(process.cwd(), "samples", "teller-wang-synthetic.md"),
      "utf8",
    );
    const dims = mockExtract({ subjectName: "王敏", texts: [sample] });
    expect(dims.procedure.forbidden.some((f) => /代查|密码|卡号/.test(f))).toBe(true);
    expect(dims.interaction.heuristics.some((h) => /投诉|核身/.test(h))).toBe(true);
    expect(scoreDistillQuality(dims).score).toBeGreaterThanOrEqual(70);
  });

  it("canPublish respects 60% gate", () => {
    expect(canPublish([{ level: "L4" }, { level: "L4" }] as any).ok).toBe(false);
    expect(canPublish([{ level: "L1" }, { level: "L2" }] as any).ok).toBe(true);
  });

  it("falls back to mock when llm throws", async () => {
    const r = await runExtract({
      adapter: "llm",
      subjectName: "x",
      texts: ["核身"],
      llm: { baseUrl: "http://127.0.0.1:9", apiKey: "x", model: "x" },
    });
    expect(r.adapterUsed).toBe("mock");
    expect(r.dimensions.procedure.workflows.length).toBeGreaterThan(0);
  });
});
