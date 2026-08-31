import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverTrainingSkills } from "../src/discover-skills.js";

describe("discoverTrainingSkills", () => {
  it("lists distill-studio packages under export roots", async () => {
    const root = await mkdtemp(join(tmpdir(), "bet-disc-"));
    const pkg = join(root, "wang-min-v1");
    await mkdir(pkg, { recursive: true });
    await writeFile(
      join(pkg, "meta.json"),
      JSON.stringify({ source: "distill-studio", slug: "wang-min", version: 1, name: "王敏" }),
      "utf8",
    );
    await writeFile(join(pkg, "SKILL.md"), "---\nname: wang-min\n---\n", "utf8");
    await writeFile(join(root, "readme.txt"), "x", "utf8");
    await mkdir(join(root, "broken"), { recursive: true });

    const { skills, roots } = await discoverTrainingSkills([root]);
    expect(roots).toEqual([root]);
    expect(skills).toHaveLength(1);
    expect(skills[0]!.slug).toBe("wang-min");
    expect(skills[0]!.dirPath).toBe(pkg);
    expect(skills[0]!.recommended).toBe(false);
    expect(skills[0]!.isZip).toBe(false);
    expect(skills[0]!.qualityScore).toBeUndefined();
  });

  it("reads quality score from meta.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "bet-disc-q-"));
    const pkg = join(root, "q-v1");
    await mkdir(pkg, { recursive: true });
    await writeFile(
      join(pkg, "meta.json"),
      JSON.stringify({
        source: "distill-studio",
        slug: "q",
        version: 1,
        name: "质检",
        quality: { score: 88 },
      }),
      "utf8",
    );
    await writeFile(join(pkg, "SKILL.md"), "x", "utf8");
    const { skills } = await discoverTrainingSkills([root]);
    expect(skills[0]!.qualityScore).toBe(88);
  });

  it("marks active-pointer.json packages as recommended first", async () => {
    const root = await mkdtemp(join(tmpdir(), "bet-disc-ptr-"));
    const v1 = join(root, "wang-min-v1");
    const v2 = join(root, "wang-min-v2");
    for (const [dir, ver] of [
      [v1, 1],
      [v2, 2],
    ] as const) {
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, "meta.json"),
        JSON.stringify({ source: "distill-studio", slug: "wang-min", version: ver, name: "王敏" }),
        "utf8",
      );
      await writeFile(join(dir, "SKILL.md"), "x", "utf8");
    }
    await writeFile(
      join(root, "active-pointer.json"),
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        bySlug: { "wang-min": { dirName: "wang-min-v1", version: 1 } },
      }),
      "utf8",
    );

    const { skills } = await discoverTrainingSkills([root]);
    expect(skills).toHaveLength(2);
    expect(skills[0]!.dirPath).toBe(v1);
    expect(skills[0]!.recommended).toBe(true);
    expect(skills[1]!.recommended).toBe(false);
  });

  it("lists zip archives alongside directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "bet-disc-zip-"));
    await writeFile(join(root, "wang-min-v2.zip"), "PK\u0003\u0004dummy", "utf8");
    const { skills } = await discoverTrainingSkills([root]);
    expect(skills.some((s) => s.isZip && s.dirPath.endsWith("wang-min-v2.zip"))).toBe(true);
    expect(skills.find((s) => s.isZip)?.version).toBe(2);
  });

  it("skips missing roots", async () => {
    const { skills, roots } = await discoverTrainingSkills([
      join(tmpdir(), "no-such-distill-exports-xyz"),
    ]);
    expect(roots).toEqual([]);
    expect(skills).toEqual([]);
  });
});
