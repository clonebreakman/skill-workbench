import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { homedir } from "node:os";

export type DiscoveredSkill = {
  dirPath: string;
  slug: string;
  version: number;
  name: string;
  synthetic: boolean;
  mtimeMs: number;
  /** Distill Studio active-pointer.json recommends this package. */
  recommended?: boolean;
  /** true when entry is a .zip archive */
  isZip?: boolean;
  /** Distill meta.quality.score when present */
  qualityScore?: number;
};

const trainerRoot = process.env.APP_ROOT ?? process.cwd();

/** Candidate Distill Studio training-skill export roots. */
export function defaultExportRoots(extra?: string[]): string[] {
  const home = homedir();
  const roots = [
    process.env.DISTILL_EXPORTS_DIR,
    ...(extra ?? []),
    join(home, "DistillStudio", "data", "exports", "training-skill"),
    join(trainerRoot, "..", "DistillStudio", "data", "exports", "training-skill"),
    join(trainerRoot, "..", "distill-studio", "data", "exports", "training-skill"),
    join(trainerRoot, "..", "..", "DistillStudio", "data", "exports", "training-skill"),
  ].filter((x): x is string => Boolean(x && String(x).trim()));
  return [...new Set(roots)];
}

type PointerEntry = { dirName?: string; version?: number; slug?: string };

async function loadRecommendedDirNames(root: string): Promise<Set<string>> {
  const recommended = new Set<string>();
  try {
    const raw = JSON.parse(await readFile(join(root, "active-pointer.json"), "utf8")) as {
      bySlug?: Record<string, PointerEntry>;
    };
    for (const [slug, entry] of Object.entries(raw.bySlug ?? {})) {
      if (entry.dirName) recommended.add(entry.dirName);
      else if (entry.version != null) recommended.add(`${slug}-v${entry.version}`);
    }
  } catch {
    /* no pointer file */
  }
  return recommended;
}

export async function discoverTrainingSkills(
  roots: string[],
): Promise<{ roots: string[]; skills: DiscoveredSkill[] }> {
  const skills: DiscoveredSkill[] = [];
  const scanned: string[] = [];

  for (const root of roots) {
    let entries: string[];
    try {
      const st = await stat(root);
      if (!st.isDirectory()) continue;
      entries = await readdir(root);
      scanned.push(root);
    } catch {
      continue;
    }

    const recommendedDirs = await loadRecommendedDirNames(root);

    for (const name of entries) {
      if (name === "active-pointer.json") continue;
      const dirPath = join(root, name);
      try {
        const st = await stat(dirPath);
        if (st.isFile() && name.toLowerCase().endsWith(".zip")) {
          const base = name.replace(/\.zip$/i, "");
          const versionMatch = base.match(/-v(\d+)$/i);
          const version = versionMatch ? Number(versionMatch[1]) : 1;
          const slug = versionMatch ? base.slice(0, -versionMatch[0].length) : base;
          skills.push({
            dirPath,
            slug,
            version,
            name: base,
            synthetic: true,
            mtimeMs: st.mtimeMs,
            recommended: recommendedDirs.has(base) || recommendedDirs.has(slug),
            isZip: true,
          });
          continue;
        }
        if (!st.isDirectory()) continue;
        const metaRaw = await readFile(join(dirPath, "meta.json"), "utf8");
        const meta = JSON.parse(metaRaw.replace(/^\uFEFF/, "")) as {
          source?: string;
          slug?: string;
          version?: number;
          synthetic?: boolean;
          name?: string;
          quality?: { score?: number };
        };
        if (meta.source && meta.source !== "distill-studio") continue;
        await readFile(join(dirPath, "SKILL.md"), "utf8");
        const dirName = basename(dirPath);
        const qualityScore =
          typeof meta.quality?.score === "number" ? meta.quality.score : undefined;
        skills.push({
          dirPath,
          slug: meta.slug ?? name,
          version: Number(meta.version ?? 1),
          name: meta.name ?? meta.slug ?? name,
          synthetic: meta.synthetic !== false,
          mtimeMs: st.mtimeMs,
          recommended: recommendedDirs.has(dirName),
          isZip: false,
          qualityScore,
        });
      } catch {
        /* skip invalid package dirs */
      }
    }
  }

  skills.sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return b.mtimeMs - a.mtimeMs;
  });
  return { roots: scanned, skills };
}
