import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Button, Glass } from "../src";
import { rimMap } from "../src/internal/refraction";

const SAFARI = "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const CHROME = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const browse = (userAgent: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);

// jsdom has no layout. Each element sits where `boxes` puts it by test id, the
// marked backdrop at `backdrop`, and anything else at the origin.
let boxes: Record<string, DOMRect> = {};
let backdrop = new DOMRect(0, 0, 400, 300);
let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  boxes = {};
  backdrop = new DOMRect(0, 0, 400, 300);
  frames = [];
  const box = (element: HTMLElement) =>
    element.hasAttribute("data-glisse-backdrop")
      ? backdrop
      : (boxes[element.dataset.testid ?? ""] ?? new DOMRect(0, 0, 100, 40));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return box(this);
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return box(this).width;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return box(this).height;
  });
  // Glass fits as soon as it's observed, rather than once the page is idle.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: () => void) {}
      observe() {
        this.callback();
      }
      disconnect() {}
    },
  );
  vi.stubGlobal("requestIdleCallback", (callback: () => void) => (callback(), 1));
  vi.stubGlobal("cancelIdleCallback", () => {});
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const context = {
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,");
});

afterEach(() => {
  // Unmount while the stubs are still in place, and let the follow loop see
  // there's nothing left to follow.
  cleanup();
  nextFrame();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const filterOf = (element: HTMLElement) => {
  const id = /url\("#([^"]+)"\)/.exec(element.style.filter)?.[1];
  return id ? document.getElementById(id) : null;
};
const marked = () => document.querySelector<HTMLElement>("[data-glisse-backdrop]")!;
const nextFrame = () => frames.splice(0).forEach((callback) => callback(performance.now()));

test("renders a glass surface and forwards its ref", () => {
  const ref = createRef<HTMLDivElement>();
  render(<Glass ref={ref} className="card" data-testid="glass" />);
  expect(ref.current?.className).toBe("lg-glass card");
});

test.each([
  ["Safari", SAFARI, "objectBoundingBox"],
  ["Chromium", CHROME, "userSpaceOnUse"],
])("in %s, bends the marked content behind the glass with the switch's lens", (_, userAgent, units) => {
  browse(userAgent);
  boxes = { glass: new DOMRect(40, 40, 200, 100) };
  render(
    <div>
      <p data-glisse-backdrop>Behind</p>
      <Glass data-testid="glass">On top</Glass>
      <Button>Continue</Button>
    </div>,
  );
  const filter = filterOf(marked());
  expect(filter?.getAttribute("filterUnits")).toBe(units);
  // Two lenses in one filter: each placed, and bent red, green and blue,
  // across and then down.
  expect(filter?.querySelectorAll("feImage")).toHaveLength(6);
  expect(filter?.querySelectorAll("feDisplacementMap")).toHaveLength(12);
  for (const glass of [screen.getByTestId("glass"), screen.getByRole("button", { name: "Continue" })]) {
    // The glass paints its own lit rim, and frosts what's bent as usual.
    expect(glass.style.getPropertyValue("--lg-rim")).toMatch(/^url\("data:image\/png/);
    expect(glass.style.getPropertyValue("--lg-filter")).toBe("");
  }
  // Nothing is copied.
  expect(document.querySelectorAll("[data-glisse-backdrop]")).toHaveLength(1);
  expect(screen.getByText("On top")).toBeTruthy();
});

test("bends each glass by its own size, a reach of 0.45 of its shorter side", () => {
  browse(CHROME);
  boxes = { wide: new DOMRect(20, 20, 200, 100), small: new DOMRect(250, 200, 80, 40) };
  render(
    <div>
      <div data-glisse-backdrop />
      <Glass data-testid="wide" />
      <Glass data-testid="small" />
    </div>,
  );
  const filter = filterOf(marked())!;
  const scale = (lens: number) =>
    Number(filter.querySelector(`feDisplacementMap[in2="across-pull-${lens}"]`)!.getAttribute("scale"));
  // Red bends a little further than blue.
  expect(scale(0)).toBeCloseTo(0.45 * 100 * 1.08);
  expect(scale(1)).toBeCloseTo(0.45 * 40 * 1.08);
  const image = filter.querySelector('feImage[result="across-1"]')!;
  expect([image.getAttribute("x"), image.getAttribute("y"), image.getAttribute("width")]).toEqual(["250", "200", "80"]);
});

test("follows the glass as it moves, under a new filter id each time", () => {
  browse(SAFARI);
  boxes = { glass: new DOMRect(40, 40, 200, 100) };
  render(
    <div>
      <div data-glisse-backdrop />
      <Glass data-testid="glass" />
    </div>,
  );
  const first = filterOf(marked())!.id;
  nextFrame();
  expect(filterOf(marked())!.id).toBe(first);

  boxes.glass = new DOMRect(100, 40, 200, 100);
  nextFrame();
  const filter = filterOf(marked())!;
  expect(filter.id).not.toBe(first);
  // In box units, a share of the content's width.
  expect(filter.querySelector('feImage[result="across-0"]')!.getAttribute("x")).toBe(String(100 / 400));
});

test("stops bending the content when the glass goes", () => {
  browse(CHROME);
  boxes = { glass: new DOMRect(40, 40, 200, 100) };
  const { unmount } = render(
    <div>
      <div data-glisse-backdrop style={{ visibility: "visible" }} />
      <Glass data-testid="glass" />
    </div>,
  );
  const filter = filterOf(marked())!;
  unmount();
  expect(marked()?.style.filter ?? "").toBe("");
  expect(filter.isConnected).toBe(false);
});

test("ignores marked content that isn't behind the glass", () => {
  browse(SAFARI);
  backdrop = new DOMRect(500, 500, 100, 100);
  render(
    <div>
      <p data-glisse-backdrop>Elsewhere</p>
      <Glass data-testid="glass" />
    </div>,
  );
  expect(marked().style.filter).toBe("");
});

test("ignores the part of marked content hidden by a scroller", () => {
  browse(SAFARI);
  backdrop = new DOMRect(0, 0, 1000, 1000);
  boxes = { scroller: new DOMRect(0, 0, 100, 100), glass: new DOMRect(0, 400, 100, 40) };
  render(
    <div>
      <div data-testid="scroller" style={{ overflow: "auto" }}>
        <p data-glisse-backdrop>Wallpaper</p>
      </div>
      <Glass data-testid="glass" />
    </div>,
  );
  expect(marked().style.filter).toBe("");
});

test("with nothing marked, Chromium bends the live backdrop with the same lens", () => {
  browse(CHROME);
  boxes = { glass: new DOMRect(0, 0, 200, 100) };
  render(<Glass data-testid="glass" />);
  const glass = screen.getByTestId("glass");
  const id = /^url\("#([^"]+)"\) saturate\(1\.5\)$/.exec(glass.style.getPropertyValue("--lg-filter"))?.[1];
  const filter = document.getElementById(id!)!;
  expect(filter.querySelectorAll("feDisplacementMap")).toHaveLength(6);
  expect(filter.querySelector("feDisplacementMap")!.getAttribute("scale")).toBe(String(0.45 * 100 * 1.08));
  expect(glass.style.getPropertyValue("--lg-rim")).toMatch(/^url\("data:image\/png/);
});

test("lights its rim as iOS does: a line at the very edge, lit from the top left and bottom right", () => {
  const { columns, data } = rimMap({ width: 160, height: 56, radius: 28 }, 0.65, 3);
  // Alpha at a point given in px from the top left.
  const alpha = (x: number, y: number) => data[(Math.floor(y * 3) * columns + Math.floor(x * 3)) * 4 + 3]! / 255;
  // Brightest at the edge, all along the top, bottom and both ends, and gone 1.2px in.
  for (const [x, y] of [[80, 0], [80, 55.9], [0, 28], [159.9, 28]] as const) expect(alpha(x, y)).toBeGreaterThan(0.55);
  expect(alpha(80, 0.5)).toBeLessThan(alpha(80, 0));
  expect(alpha(80, 0.5)).toBeGreaterThan(0.3);
  expect(alpha(80, 1.1)).toBeLessThan(0.1);
  expect(alpha(80, 1.4)).toBe(0);
  expect(alpha(80, 28)).toBe(0);
  // On the corners: lit on the top left and bottom right, not the others.
  const corner = (x: number, y: number, degrees: number) => {
    const angle = (degrees * Math.PI) / 180;
    return alpha(x + 27.7 * Math.cos(angle), y + 27.7 * Math.sin(angle));
  };
  expect(corner(28, 28, -135)).toBeGreaterThan(0.45);
  expect(corner(132, 28, 45)).toBeGreaterThan(0.45);
  expect(corner(132, 28, -45)).toBeLessThan(0.03);
  expect(corner(28, 28, 135)).toBeLessThan(0.03);
  // The page's --lg-rim-shine sets how bright.
  const dark = rimMap({ width: 160, height: 56, radius: 28 }, 0.3, 3).data;
  expect(dark[Math.floor(80 * 3) * 4 + 3]! / 255).toBeCloseTo((alpha(80, 0) * 0.3) / 0.65, 2);

  // The glass's 0.5px edge line lies under the light: on its own where
  // there's no light, and covered where there is.
  const pixel = ({ columns, data }: ReturnType<typeof rimMap>, x: number, y: number) => {
    const i = (Math.floor(y * 3) * columns + Math.floor(x * 3)) * 4;
    return [...data.slice(i, i + 4)];
  };
  const unlit = rimMap({ width: 160, height: 56, radius: 28 }, 0, 3, [0, 0, 0, 0.08]);
  expect(pixel(unlit, 80, 0)).toEqual([0, 0, 0, Math.round(255 * 0.08)]);
  expect(pixel(unlit, 80, 0.4)).toEqual([0, 0, 0, Math.round(255 * 0.04)]);
  expect(pixel(unlit, 80, 0.7)).toEqual([0, 0, 0, 0]);
  const lit = pixel(rimMap({ width: 160, height: 56, radius: 28 }, 0.65, 3, [0, 0, 0, 0.08]), 80, 0);
  expect(lit[3]! / 255).toBeCloseTo(alpha(80, 0) + 0.08 * (1 - alpha(80, 0)), 2);
  expect(lit[0]).toBeGreaterThan(220);
});

test("takes new settings on its next render, with no resize", () => {
  browse(CHROME);
  boxes = { glass: new DOMRect(40, 40, 200, 100) };
  const scene = (bend: number, dispersion: number, shine: number) => (
    <div>
      <div data-glisse-backdrop />
      <Glass
        data-testid="glass"
        style={
          { "--lg-glass-bend": bend, "--lg-glass-dispersion": dispersion, "--lg-rim-shine": shine } as React.CSSProperties
        }
      />
    </div>
  );
  const { rerender } = render(scene(0.45, 0.4, 0.3));
  // Red's pass and blue's: red bends further as the colours split.
  const scales = () =>
    [...filterOf(marked())!.querySelectorAll('feDisplacementMap[in2="across-pull-0"]')].map((pass) =>
      Number(pass.getAttribute("scale")),
    );
  expect(scales()[0]).toBeCloseTo(0.45 * 100 * 1.08);
  expect(scales()[2]).toBeCloseTo(0.45 * 100);
  const painted = vi.mocked(HTMLCanvasElement.prototype.toDataURL).mock.calls.length;

  rerender(scene(0.2, 1.5, 0.27));
  expect(scales()[0]).toBeCloseTo(0.2 * 100 * 1.3);
  expect(scales()[2]).toBeCloseTo(0.2 * 100);
  // The rim, drawn again for its new strength.
  expect(vi.mocked(HTMLCanvasElement.prototype.toDataURL).mock.calls.length).toBe(painted + 1);

  // No colours split at all.
  rerender(scene(0.2, 0, 0.27));
  expect(scales()[0]).toBeCloseTo(scales()[2]!);
});

test("paints its rim again when the page's theme changes", async () => {
  browse(SAFARI);
  boxes = { glass: new DOMRect(0, 0, 123, 45) };
  render(
    <div data-testid="page">
      <Glass data-testid="glass" style={{ "--lg-rim-shine": "0.61" } as React.CSSProperties} />
    </div>,
  );
  const glass = screen.getByTestId("glass");
  expect(glass.style.getPropertyValue("--lg-rim")).toMatch(/^url\("data:image\/png/);
  const painted = vi.mocked(HTMLCanvasElement.prototype.toDataURL).mock.calls.length;
  glass.style.setProperty("--lg-rim-shine", "0.29");
  screen.getByTestId("page").setAttribute("data-theme", "dark");
  await Promise.resolve();
  expect(vi.mocked(HTMLCanvasElement.prototype.toDataURL).mock.calls.length).toBe(painted + 1);
});

test("with nothing marked, other browsers keep the frost and the lit rim", () => {
  browse(SAFARI);
  render(<Glass data-testid="glass" />);
  const glass = screen.getByTestId("glass");
  expect(glass.style.getPropertyValue("--lg-filter")).toBe("");
  expect(glass.style.getPropertyValue("--lg-rim")).toMatch(/^url\("data:image\/png/);
});
