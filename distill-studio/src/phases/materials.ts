import type { Sensitivity } from "../types.js";

export interface SensitivityResult {
  ok: boolean;
  reason?: string;
}

export function assertPublishableSensitivity(s: Sensitivity): SensitivityResult {
  if (s === "raw") {
    return { ok: false, reason: "RAW_NOT_ALLOWED" };
  }
  return { ok: true };
}
