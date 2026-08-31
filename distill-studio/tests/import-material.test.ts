import { describe, expect, it } from "vitest";
import { normalizeImportPayload, tryParseFeishuExport } from "../src/phases/import-material.js";

describe("import-material", () => {
  it("keeps plain text as script", () => {
    const m = normalizeImportPayload("理解您着急，先核身。", "话术");
    expect(m.kind).toBe("script");
    expect(m.content).toContain("核身");
  });

  it("parses feishu-like message array", () => {
    const raw = JSON.stringify([
      { sender_name: "客户", content: "能不能通融代查？" },
      { sender_name: "王敏", body: { content: "必须本人或合法授权。" } },
    ]);
    const m = normalizeImportPayload(raw, "飞书导出");
    expect(m.kind).toBe("transcript");
    expect(m.content).toContain("客户：能不能通融代查？");
    expect(m.content).toContain("王敏：必须本人或合法授权。");
  });

  it("parses nested data.items shape", () => {
    const parsed = {
      data: {
        items: [{ name: "王敏", text: "不得口头报完整卡号。" }],
      },
    };
    const m = tryParseFeishuExport(parsed, "x");
    expect(m?.content).toContain("王敏：不得口头报完整卡号。");
  });

  it("rejects empty", () => {
    expect(() => normalizeImportPayload("  ")).toThrow("EMPTY_IMPORT");
  });
});
