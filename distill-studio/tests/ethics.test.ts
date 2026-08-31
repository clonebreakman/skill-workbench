import { evaluateEthics } from "../src/phases/ethics.js";
import { describe, expect, it } from "vitest";

describe("evaluateEthics", () => {
  it("blocks when consent missing", () => {
    const r = evaluateEthics({ consent: false, purposeOk: true, noRawPiiClaim: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("CONSENT_REQUIRED");
  });

  it("passes with all checks", () => {
    expect(evaluateEthics({ consent: true, purposeOk: true, noRawPiiClaim: true }).ok).toBe(true);
  });
});
