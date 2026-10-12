import type { MessageKey } from "./locale";

export type CopyLinkPhase = "idle" | "copied" | "failed";

export function copyLinkPhaseAfterWrite(write_succeeded: boolean): CopyLinkPhase {
  return write_succeeded ? "copied" : "failed";
}

export function copyLinkMessageKey(phase: CopyLinkPhase): MessageKey {
  if (phase === "copied") {
    return "link_copied";
  }
  if (phase === "failed") {
    return "copy_link_failed";
  }
  return "copy_link";
}
