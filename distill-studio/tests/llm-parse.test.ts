import { describe, expect, it } from "vitest";
import {
  normalizeDimensionBundle,
  parseLlmJsonContent,
} from "../src/adapters/llm.js";
import { mockExtract } from "../src/adapters/mock.js";

describe("llm parse helpers", () => {
  it("parses fenced json", () => {
    const raw = parseLlmJsonContent('```json\n{"procedure":{"workflows":["核身"]}}\n```');
    expect((raw as { procedure: { workflows: string[] } }).procedure.workflows[0]).toBe("核身");
  });

  it("normalizes partial llm json onto mock fallback", () => {
    const fallback = mockExtract({
      subjectName: "王敏",
      texts: ["理解您着急，先核对身份。不得口头报完整卡号。"],
    });
    const dims = normalizeDimensionBundle(
      {
        procedure: { scope: "LLM scope", workflows: ["LLM 核身流程"] },
        personality: {
          identity: "LLM identity",
          layers: { hardRules: ["LLM 硬规则"] },
        },
      },
      fallback,
    );
    expect(dims.procedure.scope).toBe("LLM scope");
    expect(dims.procedure.workflows).toEqual(["LLM 核身流程"]);
    expect(dims.procedure.forbidden.length).toBeGreaterThan(0);
    expect(dims.personality.layers?.hardRules).toEqual(["LLM 硬规则"]);
    expect(dims.interaction.expression.length).toBeGreaterThan(0);
  });
});
