import { randomUUID } from "node:crypto";
import type { DistillDraft, EvidenceItem, TextChunk } from "../types.js";

function pickQuote(chunk: TextChunk): string {
  const line = chunk.text.split("\n").find((part) => part.trim().length > 0) ?? chunk.text;
  return line.trim().slice(0, 160);
}

/** Mock 蒸馏：从合成柜员文本中规则抽取，无需外部 API。 */
export function mockExtract(chunks: readonly TextChunk[]): DistillDraft {
  if (chunks.length === 0) {
    throw new Error("EMPTY_MATERIAL");
  }

  const joined = chunks.map((chunk) => chunk.text).join("\n");
  const evidence: EvidenceItem[] = chunks.map((chunk, index) => {
    const level = index === 0 ? "L1" : index === 1 ? "L2" : index % 3 === 0 ? "L3" : "L1";
    return {
      id: `EV-${randomUUID().slice(0, 8)}`,
      chunkId: chunk.id,
      level,
      claim:
        level === "L1"
          ? "直接引用优秀员工原话作为行为标准"
          : level === "L2"
            ? "由相邻段落归纳出的稳定做法"
            : "弱推断，需人工确认",
      quote: pickQuote(chunk),
    };
  });

  const hasIdentity = /核对|身份|证件/.test(joined);
  const hasEmpathy = /安抚|理解|抱歉|着急/.test(joined);
  const hasHandoff = /转人工|主管|授权/.test(joined);

  return {
    workSkill: {
      scope: "柜面低风险咨询与只读查询协助（合成演示）",
      workflows: [
        "问候并确认来意",
        hasIdentity ? "核对客户身份与账户归属" : "确认客户诉求与所需材料",
        "查询并解释结果（只读）",
        "复述要点并询问是否还需帮助",
      ],
      decisionRules: [
        hasIdentity ? "身份与账户不一致时立即停止查询" : "信息不足时先澄清再操作",
        "只读查询可自助解释；涉及资金变动必须转授权流程",
      ],
      forbidden: [
        "不得口报完整证件号/卡号",
        "不得在未核身情况下查询他人账户",
        hasHandoff ? "高风险或异常情绪升级时必须转主管" : "超出权限的请求必须拒绝并说明原因",
      ],
      knowledgeRefs: chunks.map((chunk) => chunk.materialId),
    },
    persona: {
      identity: "稳健、清晰、合规优先的银行优秀柜员（合成画像）",
      expression: [
        hasEmpathy ? "先共情再给方案，例如「理解您着急，我们先把情况核实清楚。」" : "先确认事实再给结论",
        "用短句复述客户诉求，避免一次抛出过多术语",
      ],
      heuristics: [
        "不确定就核实，不猜测账户归属",
        "解释结果时同时说明依据与下一步",
      ],
      interpersonal: "尊重、耐心；对焦虑客户先降压再办事",
      antiPatterns: [
        "打断客户抢话",
        "用内部黑话直接对客",
        "承诺无法兑现的时效",
      ],
      limits: [
        "不能替代合规审批",
        "不能处理真实资金写操作",
        "超出素材证据的结论需人工补证",
      ],
    },
    evidence,
  };
}
