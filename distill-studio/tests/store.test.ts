import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";

describe("AppStore", () => {
  it("creates subject and persists materials", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ds-"));
    const store = new AppStore(dir);
    await store.init();
    const s = await store.createSubject({
      slug: "wang-min",
      name: "王敏",
      type: "known",
      profile: { title: "柜员", org: "演示支行" },
    });
    expect(s.id).toMatch(/^SUB-/);
    const m = await store.addMaterial({
      subjectId: s.id,
      kind: "script",
      title: "话术",
      sensitivity: "synthetic",
      fileName: "a.md",
      content: "理解您着急，先核身。",
    });
    expect((await store.listMaterials(s.id)).map((x) => x.id)).toContain(m.id);
    expect(m.path).not.toContain("\\");
    expect(m.path).toBe(`${s.id}/a.md`);
  });

  it("rejects invalid material fileName", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ds-"));
    const store = new AppStore(dir);
    await store.init();
    const s = await store.createSubject({
      slug: "wang-min",
      name: "王敏",
      type: "known",
      profile: {},
    });
    await expect(
      store.addMaterial({
        subjectId: s.id,
        kind: "script",
        title: "bad",
        sensitivity: "synthetic",
        fileName: "../escape.md",
        content: "x",
      }),
    ).rejects.toThrow("INVALID_FILENAME");
  });
});
