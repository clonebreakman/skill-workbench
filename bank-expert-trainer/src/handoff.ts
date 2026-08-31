import { defaultExportRoots, discoverTrainingSkills } from "./discover-skills.js";

const DEFAULT_DISTILL = "http://127.0.0.1:8877";

export type DistillProbe = {
  ok: boolean;
  url: string;
  detail?: string;
};

export async function probeDistill(baseUrl = DEFAULT_DISTILL): Promise<DistillProbe> {
  const url = baseUrl.replace(/\/$/, "") + "/";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${url}health`, { signal: controller.signal });
    clearTimeout(timer);
    return {
      ok: res.ok,
      url,
      detail: res.ok ? "蒸馏端在线" : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      url,
      detail: e instanceof Error && e.name === "AbortError" ? "超时" : "未启动或不可达",
    };
  }
}

export async function buildTrainerHandoff(options?: {
  distillUrl?: string;
  exportRoots?: string[];
}) {
  const distill = await probeDistill(options?.distillUrl ?? DEFAULT_DISTILL);
  const roots = options?.exportRoots ?? defaultExportRoots();
  const discovered = await discoverTrainingSkills(roots);
  const skills = discovered.skills;
  const recommended = skills.filter((s) => s.recommended);
  return {
    distill,
    recommended,
    evolveUrl: `${distill.url.replace(/\/$/, "")}/evolve`,
    discoverCount: skills.length,
  };
}

/** Resolve Distill package id: prefer explicit, else match slug+version via Distill API. */
export async function resolveDistillPackageId(options: {
  distillUrl?: string;
  packageId?: string;
  slug?: string;
  version?: number;
}): Promise<string | null> {
  if (options.packageId) return options.packageId;
  if (!options.slug) return null;
  const base = (options.distillUrl ?? DEFAULT_DISTILL).replace(/\/$/, "");
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${base}/api/packages`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      packages?: Array<{ id: string; slug?: string; version: number; active?: boolean }>;
    };
    const list = body.packages ?? [];
    if (options.version != null) {
      const hit = list.find((p) => p.slug === options.slug && p.version === options.version);
      if (hit) return hit.id;
    }
    const active = list.find((p) => p.slug === options.slug && p.active);
    if (active) return active.id;
    const newest = list
      .filter((p) => p.slug === options.slug)
      .sort((a, b) => b.version - a.version)[0];
    return newest?.id ?? null;
  } catch {
    return null;
  }
}

export async function postCorrectionToDistill(options: {
  distillUrl?: string;
  packageId: string;
  scene: string;
  wrong: string;
  right: string;
  republish?: boolean;
}): Promise<{ ok: boolean; correction?: unknown; package?: unknown; reason?: string }> {
  const base = (options.distillUrl ?? DEFAULT_DISTILL).replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${base}/api/packages/${encodeURIComponent(options.packageId)}/corrections`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scene: options.scene,
        wrong: options.wrong,
        right: options.right,
        republish: options.republish !== false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = (await res.json()) as {
      ok?: boolean;
      reason?: string;
      correction?: unknown;
      package?: unknown;
    };
    if (!res.ok || data.ok === false) {
      return { ok: false, reason: data.reason ?? `HTTP_${res.status}` };
    }
    return { ok: true, correction: data.correction, package: data.package };
  } catch (e) {
    clearTimeout(timer);
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "DISTILL_UNREACHABLE",
    };
  }
}
