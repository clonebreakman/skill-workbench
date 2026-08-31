import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { importTrainingSkillZip, importTrainingSkillZipBase64 } from "../src/import-skill-zip.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("importTrainingSkillZip", () => {
  it(
    "imports from local zip path",
    async () => {
      const zipPath = join(fixtures, "wang-zip-v1.zip");
      const storeRoot = await mkdtemp(join(tmpdir(), "bet-store-"));
      const store = new AppStore(storeRoot);
      await store.init();
      const skill = await importTrainingSkillZip(store, zipPath);
      expect(skill.slug).toBe("wang-zip");
      expect(skill.workSkill.forbidden[0]).toContain("卡号");
      expect((await store.listSkills()).length).toBe(1);
    },
    60_000,
  );

  it(
    "imports from base64 zip",
    async () => {
      const b64 = (await readFile(join(fixtures, "wang-zip-v1.b64.txt"), "utf8")).trim();
      const storeRoot = await mkdtemp(join(tmpdir(), "bet-storeb-"));
      const store = new AppStore(storeRoot);
      await store.init();
      const skill = await importTrainingSkillZipBase64(store, b64, "wang-zip-v1.zip");
      expect(skill.slug).toBe("wang-zip");
    },
    60_000,
  );
});
