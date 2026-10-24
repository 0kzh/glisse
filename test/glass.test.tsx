import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { Glass } from "../src";

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders a glass surface and forwards its ref", () => {
  const ref = createRef<HTMLDivElement>();
  render(<Glass ref={ref} className="card" data-testid="glass" />);
  expect(ref.current?.className).toBe("lg-glass card");
});

test("refracts a copy of its backdrop where the live one can't be filtered", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15");
  render(<Glass data-testid="glass" backdrop={<p>Behind</p>}>On top</Glass>);
  const glass = screen.getByTestId("glass");
  expect(glass.hasAttribute("data-copy")).toBe(true);
  const copy = glass.querySelector(".lg-glass-copy");
  expect(copy?.textContent).toBe("Behind");
  expect(copy?.getAttribute("aria-hidden")).toBe("true");
  expect(copy?.hasAttribute("inert")).toBe(true);
  expect(glass.querySelector(".lg-glass-skin")).toBeTruthy();
  expect(screen.getByText("On top")).toBeTruthy();
});

test("ignores the backdrop copy in Chromium, which refracts the live page", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36");
  render(<Glass data-testid="glass" backdrop={<p>Behind</p>} />);
  const glass = screen.getByTestId("glass");
  expect(glass.hasAttribute("data-copy")).toBe(false);
  expect(screen.queryByText("Behind")).toBeNull();
});
