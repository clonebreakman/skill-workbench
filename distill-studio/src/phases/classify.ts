import type { SubjectType } from "../types.js";

export interface ClassifyInput {
  hint?: string;
  explicitType?: SubjectType;
}

export interface ClassifyResult {
  type: SubjectType;
  tags: string[];
}

function inferTags(hint: string): string[] {
  const tags: string[] = [];
  if (/柜员|银行|同事/.test(hint)) {
    tags.push("bank-teller");
  }
  return tags;
}

function inferType(hint: string): SubjectType {
  // Match bank/colleague before self to avoid misclassifying「我们银行」as self
  if (/柜员|银行|同事/.test(hint)) {
    return "known";
  }
  if (/自己|我/.test(hint)) {
    return "self";
  }
  if (/名人|公众/.test(hint)) {
    return "public";
  }
  return "known";
}

export function classifySubject(input: ClassifyInput): ClassifyResult {
  const hint = input.hint ?? "";
  const tags = hint ? inferTags(hint) : [];

  if (input.explicitType !== undefined) {
    return { type: input.explicitType, tags };
  }

  return { type: inferType(hint), tags };
}
