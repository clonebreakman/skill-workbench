async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json()) as T & { ok?: boolean; reason?: string };
  if (!res.ok || (body as { ok?: boolean }).ok === false) {
    throw new Error((body as { reason?: string }).reason ?? `HTTP_${res.status}`);
  }
  return body;
}

export const api = {
  dashboard: () => request<{ summary: Record<string, number> }>("/api/dashboard"),
  handoff: () =>
    request<{
      trainer: { ok: boolean; url: string; detail?: string };
      activePackages: Array<{
        id: string;
        version: number;
        slug?: string;
        subjectName?: string;
        trainingSkillPath: string;
      }>;
      importUrl: string;
    }>("/api/handoff"),
  subjects: () => request<{ subjects: Subject[] }>("/api/subjects"),
  createSubject: (body: Record<string, unknown>) =>
    request<{ subject: Subject }>("/api/subjects", { method: "POST", body: JSON.stringify(body) }),
  ethics: (id: string, body: Record<string, boolean>) =>
    request(`/api/subjects/${encodeURIComponent(id)}/ethics`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  intake: (id: string, body: Record<string, string>) =>
    request(`/api/subjects/${encodeURIComponent(id)}/intake`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  materials: (subjectId?: string) =>
    request<{ materials: Material[] }>(
      subjectId ? `/api/materials?subjectId=${encodeURIComponent(subjectId)}` : "/api/materials",
    ),
  getMaterial: (id: string) =>
    request<{ material: Material; content: string }>(
      `/api/materials/${encodeURIComponent(id)}`,
    ),
  addMaterial: (body: Record<string, unknown>) =>
    request<{ material: Material }>("/api/materials", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  importMaterial: (body: { subjectId: string; raw: string; title?: string }) =>
    request<{ material: Material }>("/api/materials/import", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  seedDemo: () =>
    request<{
      subject: Subject;
      package?: PackageRecord;
    }>("/api/demo/seed", { method: "POST", body: "{}" }),
  run: (body: { subjectId: string; materialIds: string[] }) =>
    request<{ run: DistillRun }>("/api/runs", { method: "POST", body: JSON.stringify(body) }),
  publish: (runId: string) =>
    request<{ package: PackageRecord }>(`/api/runs/${encodeURIComponent(runId)}/publish`, {
      method: "POST",
      body: "{}",
    }),
  packages: () => request<{ packages: PackageRecord[] }>("/api/packages"),
  comparePackages: (a: string, b: string) =>
    request<{ diff: PackageDiff }>(
      `/api/packages/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
    ),
  prunePackages: (body?: { keepPerSubject?: number; deleteFiles?: boolean }) =>
    request<{ kept: number; removed: number; deletedDirs: number; removedIds: string[] }>(
      "/api/packages/prune",
      { method: "POST", body: JSON.stringify(body ?? { keepPerSubject: 2, deleteFiles: true }) },
    ),
  rollback: (subjectId: string, version: number) =>
    request<{ package: PackageRecord }>(
      `/api/subjects/${encodeURIComponent(subjectId)}/rollback`,
      { method: "POST", body: JSON.stringify({ version }) },
    ),
  previewPackage: (packageId: string) =>
    request<{
      package: PackageRecord;
      skillMarkdown: string;
      meta: Record<string, unknown>;
    }>(`/api/packages/${encodeURIComponent(packageId)}/preview`),
  correct: (packageId: string, body: Record<string, string | boolean>) =>
    request<{ correction: unknown; package?: PackageRecord }>(
      `/api/packages/${encodeURIComponent(packageId)}/corrections`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  corrections: (packageId: string) =>
    request<{ corrections: CorrectionRecord[] }>(
      `/api/packages/${encodeURIComponent(packageId)}/corrections`,
    ),
  zipPackage: (packageId: string) =>
    request<{ zipPath: string; trainingSkillPath: string }>(
      `/api/packages/${encodeURIComponent(packageId)}/zip`,
      { method: "POST", body: "{}" },
    ),
  settings: () => request<{ settings: AppSettings }>("/api/settings"),
  putSettings: (body: Record<string, unknown>) =>
    request<{ settings: AppSettings }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  llmPing: (body: { baseUrl: string; apiKey: string; model: string }) =>
    request<{
      ping: { ok: true; latencyMs: number; detail: string } | { ok: false; detail: string };
    }>("/api/settings/llm-ping", { method: "POST", body: JSON.stringify(body) }),
  feishuPing: (body?: { appId?: string; appSecret?: string }) =>
    request<{ ping: { ok: true; expiresIn: number } }>("/api/settings/feishu-ping", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  importFeishuDoc: (body: {
    subjectId: string;
    url?: string;
    docToken?: string;
    title?: string;
    sensitivity?: string;
  }) =>
    request<{ material: Material; docToken: string }>("/api/materials/feishu-doc", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export type Subject = {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  tags?: string[];
};
export type Material = { id: string; subjectId: string; title: string; sensitivity: string };
export type DistillRun = {
  id: string;
  status: string;
  dimensions?: unknown;
  evidence?: { level: string; claim: string }[];
};
export type PackageRecord = {
  id: string;
  subjectId: string;
  version: number;
  openPersonaPath: string;
  trainingSkillPath: string;
  qualityScore?: number;
  subjectName?: string;
  slug?: string;
  active?: boolean;
};

export type PackageDiff = {
  a: PackageRecord;
  b: PackageRecord;
  summary: string[];
  work: {
    addedWorkflows: string[];
    removedWorkflows: string[];
    addedForbidden: string[];
    removedForbidden: string[];
    addedRules: string[];
    removedRules: string[];
  };
  persona: {
    identityChanged: boolean;
    addedAntiPatterns: string[];
    removedAntiPatterns: string[];
    addedExpression: string[];
    removedExpression: string[];
  };
};

export type CorrectionRecord = {
  id: string;
  packageId: string;
  scene: string;
  wrong: string;
  right: string;
  at: string;
};
export type AppSettings = {
  adapter: string;
  llm?: { baseUrl: string; apiKey: string; model: string };
  feishu?: { appId: string; appSecret: string };
};
