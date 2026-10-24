import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { Button, Glass } from "../src";

afterEach(() => {
  vi.restoreAllMocks();
});

const browse = (userAgent: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
// jsdom has no layout; place the marked backdrop at (x, y) and everything else at the origin.
const place = (x: number, y: number) =>
  vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: Element) {
      return this.hasAttribute("data-glisse-backdrop") ? new DOMRect(x, y, 100, 100) : new DOMRect(0, 0, 100, 100);
    });
const safari = "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const chrome = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

test("renders a glass surface and forwards its ref", () => {
  const ref = createRef<HTMLDivElement>();
  render(<Glass ref={ref} className="card" data-testid="glass" />);
  expect(ref.current?.className).toBe("lg-glass card");
});

test("refracts a copy of the marked backdrop where the live one can't be filtered", () => {
  browse(safari);
  place(20, 20);
  render(
    <div>
      <p data-glisse-backdrop id="wallpaper">
        Behind
      </p>
      <Glass data-testid="glass">On top</Glass>
      <Button>Continue</Button>
    </div>,
  );
  for (const glass of [screen.getByTestId("glass"), screen.getByRole("button", { name: "Continue" })]) {
    expect(glass.hasAttribute("data-copy")).toBe(true);
    const copy = glass.previousElementSibling;
    expect(copy?.className).toBe("lg-glass-copy");
    expect(copy?.textContent).toBe("Behind");
    expect(copy?.getAttribute("aria-hidden")).toBe("true");
    expect(copy?.hasAttribute("inert")).toBe(true);
    expect(copy?.querySelector("[id], [data-glisse-backdrop]")).toBeNull();
  }
  expect(screen.getByText("On top")).toBeTruthy();
});

test("ignores marked content that isn't behind the glass", () => {
  browse(safari);
  place(500, 500);
  render(
    <div>
      <p data-glisse-backdrop>Elsewhere</p>
      <Glass data-testid="glass" />
    </div>,
  );
  expect(screen.getByTestId("glass").hasAttribute("data-copy")).toBe(false);
});

test("ignores the part of marked content hidden by a scroller", () => {
  browse(safari);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.hasAttribute("data-glisse-backdrop")) return new DOMRect(0, 0, 1000, 1000);
    if ((this as HTMLElement).dataset.testid === "scroller") return new DOMRect(0, 0, 100, 100);
    return new DOMRect(0, 400, 100, 40);
  });
  render(
    <div>
      <div data-testid="scroller" style={{ overflow: "auto" }}>
        <p data-glisse-backdrop>Wallpaper</p>
      </div>
      <Glass data-testid="glass" />
    </div>,
  );
  expect(screen.getByTestId("glass").hasAttribute("data-copy")).toBe(false);
});

test("keeps the blur where there's no marked backdrop nearby", () => {
  browse(safari);
  render(<Glass data-testid="glass" />);
  expect(screen.getByTestId("glass").hasAttribute("data-copy")).toBe(false);
});

test("filters the live backdrop in Chromium instead of copying", () => {
  browse(chrome);
  place(20, 20);
  render(
    <div>
      <p data-glisse-backdrop>Behind</p>
      <Glass data-testid="glass" />
    </div>,
  );
  expect(screen.getByTestId("glass").hasAttribute("data-copy")).toBe(false);
});
