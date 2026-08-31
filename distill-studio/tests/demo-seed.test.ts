import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { seedDemoTeller } from "../src/demo-seed.js";

describe("demo seed", () => {
  it(
    "creates subject material run and publishes package",
    async () => {
      const dir = await mkdtemp(join(tmpdir(), "ds-seed-"));
      const store = new AppStore(dir);
      await store.init();
      const samplesDir = join(process.cwd(), "samples");
      const result = await seedDemoTeller(store, { samplesDir, publish: true });
      expect(result.subject.type).toBe("known");
      expect(result.package?.version).toBe(1);
      expect(result.package?.trainingSkillPath).toContain("training-skill");
    },
    30_000,
  );
});
