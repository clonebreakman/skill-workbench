import { describe, expect, it } from "vitest";
import { llmPing } from "../src/adapters/llm.js";

describe("llmPing", () => {
  it("returns failure for unreachable host without throwing", async () => {
    const r = await llmPing({
      baseUrl: "http://127.0.0.1:9",
      apiKey: "x",
      model: "m",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail.length).toBeGreaterThan(0);
  }, 15_000);
});
