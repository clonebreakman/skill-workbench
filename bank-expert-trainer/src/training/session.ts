import { randomUUID } from "node:crypto";
import type { AppStore } from "../store.js";
import type { TrainingSession } from "../types.js";
import { getScenario } from "./scenarios.js";
import { nextCustomerLine, scoreTraineeAgainstSkill } from "./score.js";

export async function startTrainingSession(
  store: AppStore,
  input: { traineeId: string; skillId: string; scenarioId: string },
): Promise<TrainingSession> {
  const skill = await store.getSkillById(input.skillId);
  if (!skill) {
    throw new Error("SKILL_NOT_FOUND");
  }
  const scenario = getScenario(input.scenarioId);
  if (!scenario) {
    throw new Error("SCENARIO_NOT_FOUND");
  }

  const now = new Date().toISOString();
  const session: TrainingSession = {
    id: `TS-${randomUUID().slice(0, 8)}`,
    traineeId: input.traineeId || "TRAINEE-DEMO",
    skillId: skill.id,
    scenarioId: scenario.id,
    status: "active",
    turns: [
      {
        role: "customer",
        text: scenario.openingLine,
        at: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  await store.upsertSession(session);
  return session;
}

export async function submitTraineeTurn(
  store: AppStore,
  sessionId: string,
  text: string,
): Promise<TrainingSession> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("EMPTY_TURN");
  }
  const session = await store.getSession(sessionId);
  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }
  if (session.status !== "active") {
    throw new Error("SESSION_NOT_ACTIVE");
  }
  const scenario = getScenario(session.scenarioId);
  if (!scenario) {
    throw new Error("SCENARIO_NOT_FOUND");
  }

  const now = new Date().toISOString();
  session.turns.push({ role: "trainee", text: trimmed, at: now });
  session.turns.push({
    role: "customer",
    text: nextCustomerLine({
      scenario,
      turns: session.turns,
      lastTraineeText: trimmed,
    }),
    at: new Date().toISOString(),
  });
  session.updatedAt = new Date().toISOString();
  await store.upsertSession(session);
  return session;
}

export async function completeTrainingSession(
  store: AppStore,
  sessionId: string,
): Promise<TrainingSession> {
  const session = await store.getSession(sessionId);
  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }
  const skill = await store.getSkillById(session.skillId);
  const scenario = getScenario(session.scenarioId);
  if (!skill || !scenario) {
    throw new Error("SESSION_DEPENDENCY_MISSING");
  }

  session.score = scoreTraineeAgainstSkill({
    skill,
    scenario,
    turns: session.turns,
  });
  session.status = "completed";
  session.completedAt = new Date().toISOString();
  session.updatedAt = session.completedAt;
  await store.upsertSession(session);
  return session;
}

export function buildProgress(sessions: readonly TrainingSession[]): {
  total: number;
  completed: number;
  averageOverall: number | null;
  byScenario: Array<{ scenarioId: string; attempts: number; bestOverall: number | null }>;
} {
  const completed = sessions.filter((session) => session.status === "completed");
  const averageOverall =
    completed.length === 0
      ? null
      : Math.round(
          completed.reduce((sum, session) => sum + (session.score?.overall ?? 0), 0) /
            completed.length,
        );

  const map = new Map<string, { attempts: number; bestOverall: number | null }>();
  for (const session of sessions) {
    const current = map.get(session.scenarioId) ?? { attempts: 0, bestOverall: null };
    current.attempts += 1;
    if (session.score) {
      current.bestOverall =
        current.bestOverall === null
          ? session.score.overall
          : Math.max(current.bestOverall, session.score.overall);
    }
    map.set(session.scenarioId, current);
  }

  return {
    total: sessions.length,
    completed: completed.length,
    averageOverall,
    byScenario: [...map.entries()].map(([scenarioId, value]) => ({
      scenarioId,
      ...value,
    })),
  };
}
