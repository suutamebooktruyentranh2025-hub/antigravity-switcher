import { expect, test } from "vitest";
import { copyLinkMessageKey, copyLinkPhaseAfterWrite } from "./copyLink";

test("before a click the button still offers to copy", () => {
  expect(copyLinkMessageKey("idle")).toBe("copy_link");
});

test("a successful copy tells the user the click landed", () => {
  expect(copyLinkMessageKey(copyLinkPhaseAfterWrite(true))).toBe("link_copied");
});

test("a failed copy tells the user the click did not copy", () => {
  expect(copyLinkMessageKey(copyLinkPhaseAfterWrite(false))).toBe("copy_link_failed");
});
