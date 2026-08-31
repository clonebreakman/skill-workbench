import { describe, expect, it } from "vitest";
import { validateIntake } from "../src/phases/intake.js";
import { assertPublishableSensitivity } from "../src/phases/materials.js";

describe("intake and materials", () => {
  it("requires three intake answers", () => {
    expect(validateIntake({ purpose: "", scope: "x", taboo: "y" }).ok).toBe(false);
    expect(validateIntake({ purpose: "培训", scope: "话术", taboo: "不报完整卡号" }).ok).toBe(true);
  });

  it("rejects raw sensitivity for publish path", () => {
    expect(assertPublishableSensitivity("raw").ok).toBe(false);
    expect(assertPublishableSensitivity("synthetic").ok).toBe(true);
  });
});
