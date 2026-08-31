import type { PublishedSkill, TrainingSession } from "../types.js";
import { getScenario } from "./scenarios.js";

export function renderSessionTranscript(options: {
  session: TrainingSession;
  skill?: PublishedSkill | null;
}): string {
  const { session, skill } = options;
  const scenario = getScenario(session.scenarioId);
  const lines: string[] = [
    `# 对练记录 · ${session.id}`,
    "",
    `- 状态：${session.status}`,
    `- 学员：${session.traineeId}`,
    `- Skill：${skill?.slug ?? session.skillId}${skill ? ` v${skill.version}` : ""}`,
    `- 情景：${scenario?.title ?? session.scenarioId}`,
    `- 开始：${session.createdAt}`,
  ];
  if (session.completedAt) {
    lines.push(`- 结束：${session.completedAt}`);
  }
  if (scenario?.customerGoal) {
    lines.push(`- 客户目标：${scenario.customerGoal}`);
  }
  lines.push("", "## 对话", "");
  for (const turn of session.turns) {
    const who = turn.role === "customer" ? "客户" : "学员";
    lines.push(`**${who}**（${turn.at}）`);
    lines.push("");
    lines.push(turn.text);
    lines.push("");
  }
  if (session.score) {
    const s = session.score;
    lines.push("## 评分", "");
    lines.push(
      `共情 ${s.empathy} · 合规 ${s.compliance} · 准确 ${s.accuracy} · **综合 ${s.overall}**`,
    );
    lines.push("");
    if (s.matchedSuccess?.length) {
      lines.push(`- 命中：${s.matchedSuccess.join("；")}`);
    }
    if (s.matchedFail?.length) {
      lines.push(`- 触发失败：${s.matchedFail.join("；")}`);
    }
    for (const note of s.notes) {
      lines.push(`- ${note}`);
    }
    if (s.tips?.length) {
      lines.push("", "### 改进建议", "");
      for (const tip of s.tips) {
        lines.push(`- ${tip}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
