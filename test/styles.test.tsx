import { expect, test } from "vitest";

import "../src";

test("inserts its stylesheet once, first in the head", () => {
  const styles = document.querySelectorAll("style#glisse-styles");
  expect(styles).toHaveLength(1);
  expect(document.head.firstElementChild).toBe(styles[0]);
  expect(styles[0]!.textContent).toContain(".lg-button");
});
