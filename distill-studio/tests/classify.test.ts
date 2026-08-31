import { classifySubject } from "../src/phases/classify.js";
import { describe, expect, it } from "vitest";

describe("classifySubject", () => {
  it("maps bank teller hint to known", () => {
    const r = classifySubject({ hint: "银行柜员优秀员工", explicitType: undefined });
    expect(r.type).toBe("known");
    expect(r.tags).toContain("bank-teller");
  });

  it("respects explicit type", () => {
    expect(classifySubject({ explicitType: "archetype" }).type).toBe("archetype");
  });
});
