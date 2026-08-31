import type { DimensionBundle, PersonaLayers } from "../types.js";

export interface MockExtractInput {
  subjectName: string;
  texts: string[];
}

function emptyBundle(subjectName: string): DimensionBundle {
  return {
    procedure: {
      scope: `${subjectName} · 银行柜面服务与合规作业`,
      workflows: [],
      decisionRules: [],
      forbidden: [],
      knowledgeRefs: [],
      outputPreferences: [],
      experienceNotes: [],
    },
    interaction: {
      expression: [],
      heuristics: [],
      interpersonal: "",
    },
    memory: {
      refs: [],
      notes: [],
    },
    personality: {
      identity: subjectName,
      antiPatterns: [],
      limits: [],
      layers: {
        hardRules: [],
        identity: `你是${subjectName}，银行一线柜员，合规优先于速度。`,
        expression: [],
        decisions: [],
        interpersonal: "",
        corrections: [],
      },
    },
  };
}

function pushUnique(arr: string[], item: string): void {
  if (!arr.includes(item)) arr.push(item);
}

/**
 * Distilly-aligned mock extract: Work Skill track + 6-layer Persona track.
 * Keyword/rules only — no API key required.
 */
export function mockExtract(input: MockExtractInput): DimensionBundle {
  const dims = emptyBundle(input.subjectName);
  const layers = dims.personality.layers as PersonaLayers;
  const joined = input.texts.join("\n");
  const chunks = input.texts
    .flatMap((t) => t.split(/\n+/))
    .map((t) => t.trim())
    .filter(Boolean);

  // —— Work Skill / Procedure ——
  if (/身份|证件|核身|本人/.test(joined)) {
    pushUnique(dims.procedure.workflows, "办理前完成身份核验（核身），确认本人或合法授权");
    pushUnique(dims.interaction.heuristics, "先核身，再谈业务");
    pushUnique(layers.decisions, "核身未通过则停止办理，不例外通融");
  }
  if (/只读|查询余额|查余额/.test(joined)) {
    pushUnique(dims.procedure.workflows, "余额类需求走只读查询，结果当面展示而非口头报号");
    pushUnique(dims.procedure.experienceNotes!, "只读查询可安抚急客，但不得替代核身");
  }
  if (/转账|大额|异常/.test(joined)) {
    pushUnique(dims.procedure.workflows, "转账/大额/异常交易按流程准备材料");
  }
  if (/主管|升级|审批/.test(joined)) {
    pushUnique(dims.procedure.decisionRules, "超权限或异常交易必须转主管升级，不自行拍板");
    pushUnique(layers.decisions, "边界外事项升级主管，不口头承诺时效");
  }
  if (/授权|代办|家属|代查/.test(joined)) {
    pushUnique(dims.procedure.decisionRules, "非本人办理须合法授权；否则停止查询他人账户");
    pushUnique(dims.procedure.forbidden, "不得通融代查他人账户或索要他人密码");
    pushUnique(dims.personality.antiPatterns, "家属施压下通融代查");
    pushUnique(layers.hardRules, "绝不在无合法授权时查询或披露他人账户信息");
  }
  if (/完整卡号|卡号是|通融/.test(joined)) {
    pushUnique(dims.procedure.forbidden, "不得口头报完整卡号，不得以通融绕过合规");
    pushUnique(dims.personality.antiPatterns, "口头通融报完整卡号");
    pushUnique(layers.hardRules, "绝不口头报完整卡号/证件号");
  }
  if (/密码/.test(joined)) {
    pushUnique(dims.procedure.forbidden, "不得要求客户口头报出密码");
    pushUnique(layers.hardRules, "绝不索要或代输客户密码");
  }

  pushUnique(dims.procedure.outputPreferences!, "结论先行：先说能不能办，再说明下一步");
  pushUnique(dims.procedure.outputPreferences!, "涉及禁区时明确拒绝并给出合规替代路径");
  pushUnique(dims.procedure.knowledgeRefs, "synthetic-teller-handbook");

  // —— Interaction / Persona layers ——
  if (/理解|着急|抱歉|久等|不安/.test(joined)) {
    pushUnique(dims.interaction.expression, "先共情安抚，再推进核身与办理");
    pushUnique(layers.expression, "常用「理解您着急」「抱歉让您久等」开场");
  }
  if (/展示|屏幕|看一下/.test(joined)) {
    pushUnique(dims.interaction.expression, "用屏幕展示结果，避免口头报敏感号段");
  }
  if (/投诉|态度|排队/.test(joined)) {
    pushUnique(dims.interaction.heuristics, "投诉场景：先承接情绪，再澄清诉求与下一步");
    pushUnique(layers.expression, "不顶撞、不打断；音量保持平稳");
  }

  dims.interaction.interpersonal = "对客耐心、对内合规；压力下仍保持礼貌与边界";
  layers.interpersonal = dims.interaction.interpersonal;
  pushUnique(layers.hardRules, "合规优先于速度与人情");
  pushUnique(dims.personality.limits, "不做合规终审，不承诺无法兑现的通融");
  pushUnique(dims.personality.limits, "Skill 不能替代真实核身设备与核心系统");
  layers.identity = `你是${input.subjectName}，银行柜员。用合规流程完成查询/转介，表达克制、共情但不失边界。`;
  dims.personality.identity = layers.identity;

  // Memory: refs to chunk fingerprints (no raw PII dump)
  for (const [i, chunk] of chunks.entries()) {
    if (chunk.length < 8) continue;
    pushUnique(dims.memory.refs, `chunk-${i}`);
    if (/核身|完整卡号|主管|代查|共情|理解/.test(chunk)) {
      pushUnique(dims.memory.notes!, `保留话术要点：${chunk.slice(0, 40)}${chunk.length > 40 ? "…" : ""}`);
    }
  }
  if (dims.memory.refs.length === 0) {
    dims.memory.refs.push("synthetic-sample");
  }

  // Fallback workflow so thin inputs still produce usable Work Skill
  if (dims.procedure.workflows.length === 0) {
    pushUnique(dims.procedure.workflows, "核身确认后再继续柜面操作");
  }
  if (dims.interaction.expression.length === 0) {
    pushUnique(dims.interaction.expression, "礼貌回应并引导客户配合核身");
    pushUnique(layers.expression, "礼貌、简短、先确认身份");
  }
  if (layers.hardRules.length === 0) {
    pushUnique(layers.hardRules, "不泄露客户敏感信息");
  }

  return dims;
}
