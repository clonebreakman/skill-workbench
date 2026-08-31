import type { TrainingScenario } from "../types.js";

export const TRAINING_SCENARIOS: TrainingScenario[] = [
  {
    id: "scn-balance-inquiry",
    title: "着急查余额",
    category: "inquiry",
    difficulty: "easy",
    customerGoal: "尽快知道卡里还有多少钱",
    openingLine: "你好，我有点着急，想马上查一下卡里余额。",
    pressureHints: ["催促加快", "不想听太多解释"],
    successSignals: ["核对身份", "只读查询", "不口头报完整卡号"],
    failSignals: ["未核身就查", "口头报完整卡号", "承诺转账时效"],
    synthetic: true,
  },
  {
    id: "scn-family-proxy",
    title: "家属代查",
    category: "identity",
    difficulty: "medium",
    customerGoal: "帮家人查账户，但无法完成核身",
    openingLine: "我爸今天不方便来，我拿着他的卡，能不能帮我查一下余额？",
    pressureHints: ["强调紧急", "说家里人都知道密码"],
    successSignals: ["要求本人或合法授权", "停止查询", "说明保护原因"],
    failSignals: ["通融代查", "让客户报密码", "直接查询他人账户"],
    synthetic: true,
  },
  {
    id: "scn-complaint-wait",
    title: "久候投诉",
    category: "complaint",
    difficulty: "hard",
    customerGoal: "发泄排队过久的不满并要求尽快办完",
    openingLine: "我都等了快一个小时了！你们能不能快点，态度也太差了。",
    pressureHints: ["提高音量", "要求找领导", "威胁投诉"],
    successSignals: ["先共情安抚", "澄清诉求", "说明下一步或转主管"],
    failSignals: ["顶撞客户", "承诺无法兑现", "打断抢话"],
    synthetic: true,
  },
];

export function getScenario(id: string): TrainingScenario | undefined {
  return TRAINING_SCENARIOS.find((scenario) => scenario.id === id);
}

export function listScenarios(): TrainingScenario[] {
  return TRAINING_SCENARIOS.map((scenario) => ({ ...scenario }));
}
