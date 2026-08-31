import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AppStore } from "./store.js";
import type { PublishedSkill } from "./types.js";
import { importTrainingSkill } from "./import-skill.js";

const execFileAsync = promisify(execFile);

async function findSkillRoot(dir: string): Promise<string> {
  try {
    await readFile(join(dir, "meta.json"), "utf8");
    await readFile(join(dir, "SKILL.md"), "utf8");
    return dir;
  } catch {
    /* look one level down */
  }
  const entries = await readdir(dir);
  for (const name of entries) {
    const child = join(dir, name);
    try {
      const st = await stat(child);
      if (!st.isDirectory()) continue;
      await readFile(join(child, "meta.json"), "utf8");
      await readFile(join(child, "SKILL.md"), "utf8");
      return child;
    } catch {
      /* continue */
    }
  }
  throw new Error("ZIP_SKILL_ROOT_NOT_FOUND");
}

async function expandZip(zipPath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  if (process.platform === "win32") {
    const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath.replace(/'/g, "''")}', '${destDir.replace(/'/g, "''")}')
`;
    await execFileAsync("powershell.exe", ["-NoProfile", "-Command", ps], { timeout: 60_000 });
  } else {
    await execFileAsync("unzip", ["-qo", zipPath, "-d", destDir]);
  }
}

async function accessZip(zipPath: string): Promise<void> {
  const st = await stat(zipPath);
  if (!st.isFile() || !zipPath.toLowerCase().endsWith(".zip")) {
    throw new Error("INVALID_ZIP");
  }
}

/** Import a Distill Studio training-skill ZIP (local path). */
export async function importTrainingSkillZip(
  store: AppStore,
  zipPath: string,
): Promise<PublishedSkill> {
  await accessZip(zipPath);
  const work = await mkdtemp(join(tmpdir(), "bet-zip-"));
  try {
    await expandZip(zipPath, work);
    const root = await findSkillRoot(work);
    return await importTrainingSkill(store, root);
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Import from base64 payload (browser upload). Max ~12MB decoded. */
export async function importTrainingSkillZipBase64(
  store: AppStore,
  zipBase64: string,
  fileName = "skill.zip",
): Promise<PublishedSkill> {
  const raw = zipBase64.includes(",") ? zipBase64.split(",").pop()! : zipBase64;
  const buf = Buffer.from(raw, "base64");
  if (buf.length < 32) throw new Error("INVALID_ZIP");
  if (buf.length > 12 * 1024 * 1024) throw new Error("ZIP_TOO_LARGE");
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error("INVALID_ZIP");

  const work = await mkdtemp(join(tmpdir(), "bet-zipb-"));
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "skill.zip";
  const zipPath = join(work, safeName.endsWith(".zip") ? safeName : `${safeName}.zip`);
  try {
    await writeFile(zipPath, buf);
    const out = join(work, "out");
    await expandZip(zipPath, out);
    const root = await findSkillRoot(out);
    return await importTrainingSkill(store, root);
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}
