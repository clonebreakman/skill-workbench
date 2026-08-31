async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = (await response.json()) as T & { ok?: boolean; reason?: string };
  if (!response.ok || (data as { ok?: boolean }).ok === false) {
    throw new Error((data as { reason?: string }).reason ?? `HTTP_${response.status}`);
  }
  return data;
}

export const api = {
  dashboard: () => request<{ summary: Record<string, number> }>("/api/dashboard"),
  handoff: () =>
    request<{
      distill: { ok: boolean; url: string; detail?: string };
      recommended: Array<{
        dirPath: string;
        slug: string;
        version: number;
        name: string;
        recommended?: boolean;
        qualityScore?: number;
      }>;
      evolveUrl: string;
      discoverCount: number;
    }>("/api/handoff"),
  feedbackCorrection: (body: {
    skillId?: string;
    packageId?: string;
    scene: string;
    wrong: string;
    right: string;
    republish?: boolean;
  }) =>
    request<{ packageId: string; correction?: unknown; package?: unknown }>("/api/feedback/correction", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  employees: () => request<{ employees: Array<Record<string, unknown>> }>("/api/employees"),
  createEmployee: (body: Record<string, string>) =>
    request("/api/employees", { method: "POST", body: JSON.stringify(body) }),
  materials: () => request<{ materials: Array<Record<string, unknown>> }>("/api/materials"),
  addMaterial: (body: Record<string, unknown>) =>
    request("/api/materials", { method: "POST", body: JSON.stringify(body) }),
  distill: (body: { employeeId: string; materialIds: string[] }) =>
    request<{ job: Record<string, unknown>; strongEvidenceRatio: number }>("/api/distill/jobs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  review: (jobId: string) =>
    request(`/api/distill/jobs/${encodeURIComponent(jobId)}/review`, { method: "POST", body: "{}" }),
  publish: (jobId: string, employeeId: string) =>
    request(`/api/skills/${encodeURIComponent(employeeId)}/publish`, {
      method: "POST",
      body: JSON.stringify({ jobId }),
    }),
  skills: () => request<{ skills: Array<Record<string, unknown>> }>("/api/skills"),
  getSkill: (id: string) =>
    request<{ skill: Record<string, unknown> }>(`/api/skills/${encodeURIComponent(id)}`),
  exportSkill: (id: string) =>
    request<{ skillMarkdown: string; dirPath: string }>(`/api/skills/${encodeURIComponent(id)}/export`),
  importSkill: (dirPath: string) =>
    request<{ skill: Record<string, unknown> }>("/api/skills/import", {
      method: "POST",
      body: JSON.stringify({ dirPath }),
    }),
  importSkillZip: (body: { zipPath?: string; zipBase64?: string; fileName?: string }) =>
    request<{ skill: Record<string, unknown> }>("/api/skills/import-zip", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  discoverSkills: (root?: string) =>
    request<{
      roots: string[];
      skills: Array<{
        dirPath: string;
        slug: string;
        version: number;
        name: string;
        recommended?: boolean;
        isZip?: boolean;
        qualityScore?: number;
      }>;
    }>(root ? `/api/skills/discover?root=${encodeURIComponent(root)}` : "/api/skills/discover"),
  trainingScenarios: () =>
    request<{ scenarios: Array<Record<string, unknown>> }>("/api/training/scenarios"),
  trainingProgress: () =>
    request<{ progress: Record<string, unknown>; sessions: unknown[] }>("/api/training/progress"),
  getTrainingSession: (sessionId: string) =>
    request<{ session: Record<string, unknown> }>(
      `/api/training/sessions/${encodeURIComponent(sessionId)}`,
    ),
  startTraining: (body: { skillId: string; scenarioId: string; traineeId?: string }) =>
    request<{ session: Record<string, unknown> }>("/api/training/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  trainingTurn: (sessionId: string, text: string) =>
    request<{ session: Record<string, unknown> }>(
      `/api/training/sessions/${encodeURIComponent(sessionId)}/turn`,
      { method: "POST", body: JSON.stringify({ text }) },
    ),
  completeTraining: (sessionId: string) =>
    request<{ session: Record<string, unknown> }>(
      `/api/training/sessions/${encodeURIComponent(sessionId)}/complete`,
      { method: "POST", body: "{}" },
    ),
  trainingTranscript: (sessionId: string) =>
    request<{ markdown: string }>(
      `/api/training/sessions/${encodeURIComponent(sessionId)}/transcript`,
    ),
  trainingTranscriptDownloadUrl: (sessionId: string) =>
    `/api/training/sessions/${encodeURIComponent(sessionId)}/transcript.md`,
};
