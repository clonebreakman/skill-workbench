import type { PublishedSkill } from "../types.js";

export function renderSkillMarkdown(skill: PublishedSkill, employeeName: string): string {
  const name = `${skill.slug}-teller-skill`;
  const description =
    `银行优秀柜员「${employeeName}」蒸馏 Skill：用于柜面咨询话术与判断训练。` +
    `在需要模仿该员工的流程、表达或决策启发式时启用。合成数据 only。`;

  return `---
name: ${name}
description: ${description}
metadata:
  version: "${skill.version}"
  synthetic: "true"
---

# ${employeeName} · 柜员 Skill（合成）

## Work Skill（怎么办事）

**范围：** ${skill.workSkill.scope}

### 标准流程
${skill.workSkill.workflows.map((step, i) => `${i + 1}. ${step}`).join("\n")}

### 判断规则
${skill.workSkill.decisionRules.map((rule) => `- ${rule}`).join("\n")}

### 禁区
${skill.workSkill.forbidden.map((item) => `- ${item}`).join("\n")}

## Persona（怎么说话 / 判断）

**身份：** ${skill.persona.identity}

### 表达
${skill.persona.expression.map((item) => `- ${item}`).join("\n")}

### 启发式
${skill.persona.heuristics.map((item) => `- ${item}`).join("\n")}

### 人际姿态
${skill.persona.interpersonal}

### 反模式
${skill.persona.antiPatterns.map((item) => `- ${item}`).join("\n")}

### 诚实边界
${skill.persona.limits.map((item) => `- ${item}`).join("\n")}

## 证据说明

共 ${skill.evidence.length} 条证据；详见同目录 \`evidence.jsonl\`。培训场景应优先引用 L1/L2。
`;
}
