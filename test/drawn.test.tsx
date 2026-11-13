import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Glass } from "../src";

// Safari with WebGL 2, where glass over marked content draws its own bent
// rim (see drawn.ts) rather than filtering the content.
const SAFARI = "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

// jsdom has no layout, canvas or WebGL. Each element sits where `boxes` puts
// it by test id, and every call on a canvas's context is counted by name.
let boxes: Record<string, DOMRect> = {};
let frames: FrameRequestCallback[] = [];
let calls: Record<string, unknown[][]> = {};

const context = () =>
  new Proxy(
    {},
    {
      get(target: Record<string, unknown>, name: string) {
        if (name in target) return target[name];
        if (name === "createImageData") {
          return (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) });
        }
        if (name === "measureText") return () => ({ fontBoundingBoxAscent: 16, fontBoundingBoxDescent: 4 });
        return (...args: unknown[]) => {
          (calls[name] ??= []).push(args);
          // A paper's size as it's made a texture, since it's freed after.
          if (name === "texImage2D" && args[5] instanceof HTMLCanvasElement) (calls.uploaded ??= []).push([args[5].width, args[5].height]);
          return name === "getProgramParameter" ? true : {};
        };
      },
      set(target: Record<string, unknown>, name: string, value: unknown) {
        target[name] = value;
        return true;
      },
    },
  );

beforeEach(() => {
  boxes = {};
  frames = [];
  calls = {};
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(SAFARI);
  const box = (element: Element) => boxes[(element as HTMLElement).dataset?.testid ?? ""] ?? new DOMRect(0, 0, 400, 300);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return box(this);
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return box(this).width;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return box(this).height;
  });
  // Each letter is 10px wide, on one line 20px tall.
  Range.prototype.getClientRects = function (this: Range) {
    return [new DOMRect(this.startOffset * 10, 100, 10, 20)] as unknown as DOMRectList;
  };
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
  const contexts = new WeakMap<HTMLCanvasElement, object>();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    if (!contexts.has(this)) contexts.set(this, context());
    return contexts.get(this) as never;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,");
});

afterEach(() => {
  cleanup();
  nextFrame();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const nextFrame = () => frames.splice(0).forEach((callback) => callback(performance.now()));
const marked = () => document.querySelector<HTMLElement>("[data-glisse-backdrop]")!;
const count = (name: string) => calls[name]?.length ?? 0;
// The size of each paper made a texture of what's under the glass.
const uploads = () => (calls.uploaded ?? []) as [number, number][];

test("in Safari, content scrolled under the glass is bent without painting it again, until it changes", async () => {
  // The wallpaper and what's on it scroll together under still glass.
  boxes = {
    glass: new DOMRect(40, 40, 200, 100),
    wallpaper: new DOMRect(0, 0, 1300, 1300),
    picture: new DOMRect(0, 0, 1300, 1300),
  };
  render(
    <div>
      <div data-testid="wallpaper" data-glisse-backdrop>
        <img data-testid="picture" alt="" />
      </div>
      <Glass data-testid="glass" />
    </div>,
  );
  Object.defineProperties(screen.getByTestId("picture"), {
    complete: { value: true },
    naturalWidth: { value: 2600 },
    naturalHeight: { value: 2600 },
  });
  nextFrame();
  expect(uploads()).toHaveLength(1);
  expect(count("drawArrays")).toBe(4);

  for (let i = 1; i <= 10; i++) {
    boxes.wallpaper = boxes.picture = new DOMRect(-i * 7, -i * 3, 1300, 1300);
    nextFrame();
  }
  // Every frame is bent again, from the one paint.
  expect(count("drawArrays")).toBe(44);
  expect(uploads()).toHaveLength(1);

  // What's on it changing is painted again.
  screen.getByTestId("wallpaper").style.backgroundColor = "rgb(255, 0, 0)";
  await Promise.resolve();
  nextFrame();
  expect(uploads()).toHaveLength(2);
});

test("content that changes every frame is painted only under the glass, with a margin for its reach", () => {
  boxes = { glass: new DOMRect(40, 40, 200, 100) };
  render(
    <div>
      <div data-glisse-backdrop>
        <canvas width={400} height={300} />
      </div>
      <Glass data-testid="glass" />
    </div>,
  );
  nextFrame();
  // A 30px bezel pulls from 30px in, and red a little further.
  expect(uploads().map(([across]) => across)).toEqual([200 + 2 * Math.ceil(30 * 1.12 + 1)]);
  // A canvas is taken to have changed each frame.
  nextFrame();
  expect(uploads()).toHaveLength(2);
});

test("in Safari, glass draws its own bent rim over the marked content, and leaves the content alone", () => {
  boxes = { glass: new DOMRect(40, 40, 200, 100) };
  const { unmount } = render(
    <div>
      <div data-glisse-backdrop style={{ backgroundColor: "rgb(0, 0, 255)" }}>
        <img data-testid="picture" alt="" />
        <p style={{ color: "rgb(255, 255, 255)", textTransform: "uppercase" }}>Hi there</p>
      </div>
      <Glass data-testid="glass">On top</Glass>
    </div>,
  );
  const picture = screen.getByTestId("picture") as HTMLImageElement;
  Object.defineProperties(picture, { complete: { value: true }, naturalWidth: { value: 800 }, naturalHeight: { value: 600 } });
  const glass = screen.getByTestId("glass");
  nextFrame();

  // Nothing is filtered or copied; the drawing sits in the glass, under what it holds.
  expect(marked().style.filter).toBe("");
  expect(glass.hasAttribute("data-drawn")).toBe(true);
  expect(glass.firstElementChild?.className).toBe("lg-drawn");
  expect(glass.querySelector(".lg-drawn > canvas")).toBeTruthy();
  expect(glass.textContent).toBe("On top");
  expect(glass.style.getPropertyValue("--lg-rim")).toMatch(/^url\("data:image\/png/);

  // What's under the glass is painted: the background, the image, and each
  // word where it's laid out, on its baseline in the middle of its line.
  expect(calls.fill).toHaveLength(1);
  expect(calls.drawImage![0]![0]).toBe(picture);
  expect(calls.fillText).toEqual([
    ["HI", 0, 116],
    ["THERE", 30, 116],
  ]);
  // Then bent, frosted across and down, and finished: four draws.
  expect(count("drawArrays")).toBe(4);
  // The content fits a texture, so it's painted whole, once.
  expect(uploads()).toEqual([[400, 300]]);

  // Still, it isn't drawn again; moved, it is, from what was painted.
  nextFrame();
  expect(count("drawArrays")).toBe(4);
  boxes.glass = new DOMRect(100, 40, 200, 100);
  nextFrame();
  expect(count("drawArrays")).toBe(8);
  expect(uploads()).toHaveLength(1);

  // React replacing what the glass holds doesn't lose the drawing.
  glass.textContent = "Replaced";
  boxes.glass = new DOMRect(120, 40, 200, 100);
  nextFrame();
  expect(glass.firstElementChild?.className).toBe("lg-drawn");

  unmount();
  expect(document.querySelector(".lg-drawn")).toBeNull();
});

test("leaves out what's from another origin, and draws the rest", async () => {
  boxes = { glass: new DOMRect(40, 40, 200, 100) };
  // A fresh copy of the library, whose canvases are made below.
  vi.resetModules();
  const { Glass } = await import("../src");
  // A canvas with the picture on it can't be read, or made a texture.
  let picture: Element | null = null;
  const barred = () => {
    throw new DOMException("The canvas has been tainted", "SecurityError");
  };
  const real = vi.mocked(HTMLCanvasElement.prototype.getContext).getMockImplementation()!;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, ...args) {
    const made = real.apply(this, args as never) as unknown as Record<string, unknown>;
    if ("tainted" in made) return made as never;
    let tainted = false;
    made.drawImage = (media: unknown) => {
      tainted ||= media === picture;
      (calls.drawImage ??= []).push([media]);
    };
    made.clearRect = () => (tainted = false);
    made.getImageData = () => (tainted ? barred() : {});
    const upload = made.texImage2D as (...args: unknown[]) => void;
    made.texImage2D = (...rest: unknown[]) => {
      const source = rest[5];
      if (source instanceof HTMLCanvasElement && (real.call(source, "2d") as unknown as { tainted: () => boolean }).tainted()) barred();
      upload(...rest);
    };
    made.tainted = () => tainted;
    return made as never;
  });
  render(
    <div>
      <div data-glisse-backdrop>
        <img data-testid="picture" alt="" />
        <p style={{ color: "rgb(255, 255, 255)" }}>Hi</p>
      </div>
      <Glass data-testid="glass" />
    </div>,
  );
  picture = screen.getByTestId("picture");
  Object.defineProperties(picture, { complete: { value: true }, naturalWidth: { value: 800 }, naturalHeight: { value: 600 } });
  nextFrame();
  // Painted with the picture, which is then tried alone and found out, and
  // painted again without it.
  expect(calls.drawImage!.filter(([media]) => media === picture)).toHaveLength(2);
  expect(calls.fillText).toHaveLength(2);
  expect(count("drawArrays")).toBe(4);
});
