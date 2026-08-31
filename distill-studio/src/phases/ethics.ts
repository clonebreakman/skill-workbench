export interface EthicsInput {
  consent: boolean;
  purposeOk: boolean;
  noRawPiiClaim: boolean;
}

export interface EthicsResult {
  ok: boolean;
  reason?: string;
}

export function evaluateEthics(input: EthicsInput): EthicsResult {
  if (!input.consent) {
    return { ok: false, reason: "CONSENT_REQUIRED" };
  }
  if (!input.purposeOk) {
    return { ok: false, reason: "PURPOSE_REQUIRED" };
  }
  if (!input.noRawPiiClaim) {
    return { ok: false, reason: "RAW_PII_CLAIM" };
  }
  return { ok: true };
}
