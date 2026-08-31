import type { IntakeAnswers } from "../types.js";

export interface IntakeResult {
  ok: boolean;
  reason?: string;
}

export function validateIntake(answers: IntakeAnswers): IntakeResult {
  const purpose = answers.purpose.trim();
  const scope = answers.scope.trim();
  const taboo = answers.taboo.trim();

  if (!purpose || !scope || !taboo) {
    return { ok: false, reason: "INTAKE_INCOMPLETE" };
  }

  return { ok: true };
}
