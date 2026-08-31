import type { DimensionScore, PublishedSkill, TrainingScenario, TrainingTurn } from "../types.js";

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function matchSuccess(signal: string, joined: string): boolean {
  if (joined.includes(signal.slice(0, 2))) return true;
  if (signal.includes("核") && /核/.test(joined)) return true;
  if (signal.includes("授权") && /授权|本人/.test(joined)) return true;
  if (signal.includes("共情") && /理解|抱歉/.test(joined)) return true;
  if (signal.includes("只读") && /只读|查询余额|查一下余额|只读余额/.test(joined)) return true;
  if (
    signal.includes("完整卡号") &&
    /不(会|能|要)?.*(口头)?报.*完整卡号|不口头报完整卡号/.test(joined)
  ) {
    return true;
  }
  if (signal.includes("停止") && /停止|无法查询他人|不能代/.test(joined)) return true;
  if (signal.includes("保护") && /保护|合规|规则/.test(joined)) return true;
  if (signal.includes("转主管") && /主管|升级/.test(joined)) return true;
  return false;
}

function matchFail(
  signal: string,
  joined: string,
  disclosedCard: boolean,
): boolean {
  if (signal.includes("未核身") && !/身份|证件|核身|本人/.test(joined)) return true;
  if (signal.includes("通融") && /通融|先帮你查/.test(joined)) return true;
  if (signal.includes("顶撞") && /吵什么|爱办不办/.test(joined)) return true;
  if (signal.includes("完整卡号") && disclosedCard) return true;
  if (signal.includes("密码") && /密码告诉我|把密码说|报一下密码/.test(joined)) return true;
  return false;
}

export function scoreTraineeAgainstSkill(options: {
  skill: PublishedSkill;
  scenario: TrainingScenario;
  turns: readonly TrainingTurn[];
}): DimensionScore {
  const traineeTexts = options.turns
    .filter((turn) => turn.role === "trainee")
    .map((turn) => turn.text);
  const joined = traineeTexts.join("\n");
  const notes: string[] = [];

  let empathy = 55;
  let compliance = 55;
  let accuracy = 55;

  if (/理解|着急|抱歉|不安|辛苦|久等/.test(joined)) {
    empathy += 20;
    notes.push("体现共情安抚");
  }
  if (/打断|吵什么|爱办不办|自己不会看/.test(joined)) {
    empathy -= 35;
    notes.push("出现顶撞/不尊重表达");
  }

  if (/身份|证件|核身|本人|授权/.test(joined)) {
    compliance += 20;
    notes.push("提到身份核验或授权边界");
  }
  const disclosedCard =
    /卡号是\d|卡号[:：]\s*\d|报一下完整卡号|把完整卡号念/.test(joined) &&
    !/不(会|能|要)?.*(口头)?报.*完整卡号|不口头报完整卡号|不会口头报完整卡号/.test(joined);
  const askedPassword = /密码告诉我|把密码说|报一下密码/.test(joined);
  const bentRule = /通融一下.*查|先帮你查/.test(joined);

  if (askedPassword || bentRule || disclosedCard) {
    compliance -= 40;
    notes.push("触及禁区话术");
  }
  for (const forbidden of options.skill.workSkill.forbidden) {
    if (forbidden.includes("卡号") && disclosedCard) {
      compliance -= 15;
      notes.push("疑似违反禁区：卡号保护");
    }
  }

  const matchedSuccess = options.scenario.successSignals.filter((signal) =>
    matchSuccess(signal, joined),
  );
  const matchedFail = options.scenario.failSignals.filter((signal) =>
    matchFail(signal, joined, disclosedCard),
  );

  accuracy += matchedSuccess.length * 10;
  accuracy -= matchedFail.length * 15;
  if (matchedSuccess.length > 0) notes.push(`命中情景成功信号 ${matchedSuccess.length} 项`);
  if (matchedFail.length > 0) notes.push(`触发失败信号 ${matchedFail.length} 项`);

  if (traineeTexts.length === 0) {
    return {
      empathy: 0,
      compliance: 0,
      accuracy: 0,
      overall: 0,
      notes: ["没有学员发言，无法评分"],
      matchedSuccess: [],
      matchedFail: [],
      tips: ["先发送至少一条柜员回复再结束评分"],
    };
  }

  if (options.skill.persona.expression.some((line) => /共情|理解/.test(line)) && /理解/.test(joined)) {
    empathy += 5;
  }

  empathy = clamp(empathy);
  compliance = clamp(compliance);
  accuracy = clamp(accuracy);
  const overall = clamp(empathy * 0.3 + compliance * 0.4 + accuracy * 0.3);

  if (notes.length === 0) {
    notes.push("回答较中性，建议更明确核身与共情步骤");
  }

  const missed = options.scenario.successSignals.filter((s) => !matchedSuccess.includes(s));
  const tips: string[] = [];
  if (empathy < 70) tips.push("开场先共情（理解/抱歉），再推进办理");
  if (compliance < 70) tips.push("明确核身/授权边界，拒绝通融与口报敏感信息");
  if (missed.length > 0) tips.push(`补齐未命中要点：${missed.slice(0, 3).join("、")}`);
  if (matchedFail.length > 0) tips.push(`避免：${matchedFail.slice(0, 3).join("、")}`);
  if (tips.length === 0 && overall >= 80) tips.push("表现良好，可换更难情景加压练习");

  return {
    empathy,
    compliance,
    accuracy,
    overall,
    notes,
    matchedSuccess,
    matchedFail,
    tips,
  };
}

/** 客户 NPC：按情景推进压力，不扮演柜员。 */
export function nextCustomerLine(options: {
  scenario: TrainingScenario;
  turns: readonly TrainingTurn[];
  lastTraineeText: string;
}): string {
  const traineeTurns = options.turns.filter((turn) => turn.role === "trainee").length;
  const last = options.lastTraineeText;

  if (/授权|本人|不能代|无法查询他人|停止/.test(last) && options.scenario.id === "scn-family-proxy") {
    return "好吧……那我让我爸自己来一趟。谢谢你说清楚规则。";
  }
  if (/理解|久等|抱歉/.test(last) && options.scenario.category === "complaint" && traineeTurns >= 1) {
    return "你态度还行。那你现在能帮我快点办完吗？我真的赶时间。";
  }
  if (/身份|证件|核对/.test(last) && options.scenario.category === "inquiry") {
    return "行，证件给你。查完直接告诉我余额就行，别念卡号。";
  }

  if (traineeTurns <= 1) {
    return options.scenario.pressureHints[0]
      ? `客户继续施压：${options.scenario.pressureHints[0]}。你到底能不能马上办？`
      : "那你到底帮不帮忙？";
  }
  if (traineeTurns === 2) {
    return options.scenario.pressureHints[1]
      ? `${options.scenario.pressureHints[1]}。你再这样我要找你们领导。`
      : "我要找你们主管。";
  }
  return "……好吧，你按规范说清楚下一步吧，我听着。";
}

/** Suggested trainee replies for demo / coaching chips. */
export function sampleRepliesForScenario(scenarioId: string): string[] {
  switch (scenarioId) {
    case "scn-balance-inquiry":
      return [
        "理解您着急。请先出示证件，我帮您核身后再做只读余额查询，不会口头报完整卡号。",
        "抱歉让您久等。核身通过后我可以屏幕展示余额，不能通融口报卡号。",
      ];
    case "scn-family-proxy":
      return [
        "理解您着急。必须本人或合法授权，我不能通融代查他人账户，也不能让您报密码。",
        "为保护客户资金安全，请家人本人前来或办理合法授权后再查询。",
      ];
    case "scn-complaint-wait":
      return [
        "非常抱歉让您久等了，我先帮您核实诉求，能办的马上办，超权限的我转主管。",
        "理解您着急。我先核对业务类型，能当场处理的立刻处理，需要升级的马上联系主管。",
      ];
    default:
      return ["理解您的情况。我先核对身份与权限，再按规范办理。"];
  }
}
