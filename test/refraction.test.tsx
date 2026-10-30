import { render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { Button } from "../src";

afterEach(() => {
  vi.restoreAllMocks();
});

const browse = (userAgent: string) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  return vi.spyOn(ResizeObserver.prototype, "observe");
};

test("refracts in Chromium with no setup", () => {
  const observe = browse("Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36");
  render(<Button>Continue</Button>);
  expect(observe).toHaveBeenCalledOnce();
});

test("fits the lit rim in other browsers too", () => {
  const observe = browse("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15");
  render(<Button>Continue</Button>);
  expect(observe).toHaveBeenCalledOnce();
});
