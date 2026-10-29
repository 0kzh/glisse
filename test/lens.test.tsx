import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Slider, Switch, TabBar } from "../src";
import { lensMap } from "../src/internal/lens";

const light = { angle: 45, glow: 0.4, spread: 0.5, glowPower: 1.5, edge: 0.5, edgeWidth: 2, edgePower: 1.5 };
const options = { strength: 0.44, dispersion: 1, depth: 2, dome: 6, splay: 0.4 };

test("bends only the rim of the lens, pulling content in from the middle", () => {
  const map = lensMap({ width: 60, height: 30, radius: 15 }, options, light, 1);
  const { columns, rows } = map;
  const at = (data: Uint8ClampedArray, x: number, y: number) => [...data.slice((y * columns + x) * 4, (y * columns + x) * 4 + 4)];
  const middle = Math.floor(rows / 2);

  // Every pull is a grey, so no display's colours can tilt it.
  for (const data of [map.across, map.down, map.light]) {
    for (let i = 0; i < data.length; i += 4) expect(data[i] === data[i + 1] && data[i] === data[i + 2]).toBe(true);
  }

  // The middle is left as it is, and so is everything outside the shape.
  expect(at(map.light, columns / 2, middle)[3]).toBe(0);
  expect(at(map.light, 0, 0)[3]).toBe(0);
  expect(at(map.across, 0, 0)[0]).toBe(128);

  // At the rim, each side shows what's further in: below 128 pulls from the
  // left (or above), over 128 from the right (or below).
  expect(at(map.light, columns - 3, middle)[3]).toBe(255);
  expect(at(map.across, columns - 3, middle)[0]).toBeLessThan(128);
  expect(at(map.across, 2, middle)[0]).toBeGreaterThan(128);
  expect(at(map.down, columns / 2, 2)[0]).toBeGreaterThan(128);
  expect(at(map.down, columns / 2, rows - 3)[0]).toBeLessThan(128);

  // The pull above and below is the same, mirrored.
  for (let x = 0; x < columns; x++) {
    for (let y = 0; y < rows; y++) expect(at(map.down, x, y)[0]! + at(map.down, x, rows - 1 - y)[0]!).toBeCloseTo(255, -0.5);
  }

  // The light catches the rim, not the middle.
  const caught = map.light.filter((_, i) => i % 4 === 0);
  expect(Math.max(...caught)).toBeGreaterThan(160);
  expect(at(map.light, columns / 2, middle)[0]).toBe(128);
});

const browse = (userAgent: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
const SAFARI = "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const CHROME = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

beforeEach(() => {
  // Springs jump straight to where they're going.
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: query.includes("reduce"), addEventListener() {}, removeEventListener() {} }) as never,
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(80);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
  // Thumbs sit where their transform puts them; everything else at the origin.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (!/thumb/.test(this.className)) return new DOMRect(0, 0, 80, 40);
    const x = Number(/translate\((-?[\d.]+)px/.exec(this.style.transform)?.[1] ?? 10);
    return new DOMRect(x, 4, 50, 32);
  });
  const context = {
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const filterOf = (element: HTMLElement) => {
  const id = /url\("#([^"]+)"\)/.exec(element.style.filter)?.[1];
  return id ? document.getElementById(id) : null;
};

const pointer = { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, clientX: 10, clientY: 12 };

test("a held switch thumb shows the track inset and refracted, in place of the track under it", () => {
  browse(CHROME);
  render(<Switch aria-label="Wi-Fi" />);
  const toggle = screen.getByRole("switch");
  const track = toggle.querySelector<HTMLElement>(".lg-switch-bed:not(.lg-switch-inset)")!;
  const inset = toggle.querySelector<HTMLElement>(".lg-switch-inset")!;
  expect(inset.style.filter).toBe("");

  fireEvent.pointerDown(toggle, pointer);
  const filter = filterOf(inset);
  expect(filter?.getAttribute("filterUnits")).toBe("userSpaceOnUse");
  // Red, green and blue each bend by their own amount, across and then down.
  expect(filter?.querySelectorAll("feDisplacementMap")).toHaveLength(6);
  expect(inset.style.visibility).toBe("visible");
  // The track itself is cut away in the lens's shape.
  expect(track.style.getPropertyValue("mask-image")).toMatch(/^url\("data:image\/png/);
  expect(track.style.getPropertyValue("mask-composite")).toBe("exclude");

  fireEvent.pointerCancel(toggle, pointer);
  expect(inset.style.filter).toBe("");
  expect(inset.style.visibility).toBe("");
  expect(track.style.getPropertyValue("mask-image")).toBe("");
});

test("in Safari, the lens is sized to the track's box and moves under a new filter id", () => {
  browse(SAFARI);
  render(<Switch aria-label="Wi-Fi" />);
  const toggle = screen.getByRole("switch");
  const bed = toggle.querySelector<HTMLElement>(".lg-switch-inset")!;

  fireEvent.pointerDown(toggle, pointer);
  const first = filterOf(bed)!;
  expect(first.getAttribute("filterUnits")).toBe("objectBoundingBox");
  const id = first.id;
  fireEvent.pointerMove(toggle, { ...pointer, clientX: 25 });
  expect(filterOf(bed)?.id).not.toBe(id);
  fireEvent.pointerCancel(toggle, pointer);
});

test("a held slider thumb shows the track magnified, in place of the track under it", () => {
  browse(CHROME);
  const { container } = render(<Slider aria-label="Volume" defaultValue={40} />);
  const input = screen.getByRole("slider");
  const track = container.querySelector<HTMLElement>(".lg-slider-bed:not(.lg-slider-magnified)")!;
  const magnified = container.querySelector<HTMLElement>(".lg-slider-magnified")!;

  fireEvent.pointerDown(input, pointer);
  // The magnified track shows, cut to the lens's shape, and the track is cut away under it.
  const filter = filterOf(magnified);
  expect(filter?.querySelector('feImage[result="shape"]')).not.toBeNull();
  expect(magnified.style.visibility).toBe("visible");
  expect(track.style.getPropertyValue("mask-image")).toMatch(/^url\("data:image\/png/);

  fireEvent.pointerUp(input, pointer);
  expect(magnified.style.filter).toBe("");
  expect(magnified.style.visibility).toBe("");
  expect(track.style.getPropertyValue("mask-image")).toBe("");
});

test("--lg-slider-bend sets how far a slider's rim bends", () => {
  browse(CHROME);
  const { container } = render(<Slider aria-label="Volume" defaultValue={40} />);
  const input = screen.getByRole("slider");
  const root = container.querySelector<HTMLElement>(".lg-slider")!;
  const thumb = container.querySelector<HTMLElement>(".lg-slider-thumb")!;
  const magnified = container.querySelector<HTMLElement>(".lg-slider-magnified")!;
  const reach = () => Number(filterOf(magnified)!.querySelector("feDisplacementMap")!.getAttribute("scale"));

  fireEvent.pointerDown(input, pointer);
  const own = reach();
  fireEvent.pointerUp(input, pointer);

  // The switch's own knob leaves a slider alone.
  root.style.setProperty("--lg-switch-bend", "2");
  thumb.style.setProperty("--lg-switch-bend", "2");
  fireEvent.pointerDown(input, pointer);
  expect(reach()).toBeCloseTo(own);
  fireEvent.pointerUp(input, pointer);

  // The thumbs here are 32px tall, and red bends a little further than blue.
  thumb.style.setProperty("--lg-slider-bend", "2");
  fireEvent.pointerDown(input, pointer);
  expect(reach()).toBeCloseTo(2 * 32 * 1.13);
  fireEvent.pointerUp(input, pointer);
});

test("--lg-switch-bend sets how far a switch's rim bends, and the slider's knob doesn't", () => {
  browse(CHROME);
  render(<Switch aria-label="Wi-Fi" />);
  const toggle = screen.getByRole("switch");
  const thumb = toggle.querySelector<HTMLElement>(".lg-switch-thumb")!;
  const inset = toggle.querySelector<HTMLElement>(".lg-switch-inset")!;
  const reach = () => Number(filterOf(inset)!.querySelector("feDisplacementMap")!.getAttribute("scale"));

  fireEvent.pointerDown(toggle, pointer);
  const own = reach();
  fireEvent.pointerCancel(toggle, pointer);

  thumb.style.setProperty("--lg-slider-bend", "2");
  fireEvent.pointerDown(toggle, pointer);
  expect(reach()).toBeCloseTo(own);
  fireEvent.pointerCancel(toggle, pointer);

  // Red bends 1.2 times as far as blue here.
  thumb.style.setProperty("--lg-switch-bend", "2");
  fireEvent.pointerDown(toggle, pointer);
  expect(reach()).toBeCloseTo(2 * 32 * 1.2);
  fireEvent.pointerCancel(toggle, pointer);
});

test("a lifted tab bar lens shows the labels in full colour, refracted, in place of the labels under it", () => {
  browse(CHROME);
  const items = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
  ];
  const { container } = render(<TabBar aria-label="Range" items={items} defaultValue="day" />);
  const bar = container.querySelector<HTMLElement>(".lg-tab-bar")!;
  const labels = bar.querySelector<HTMLElement>(".lg-tab-labels:not(.lg-tab-lensed)")!;
  const lensed = bar.querySelector<HTMLElement>(".lg-tab-lensed")!;
  // Two 84px tabs in 4px of padding. jsdom can't resolve the padding's var().
  bar.style.padding = "4px";
  vi.spyOn(bar, "clientWidth", "get").mockReturnValue(176);

  fireEvent.pointerDown(screen.getByRole("tab", { name: "Week" }), pointer);
  expect(bar.hasAttribute("data-lensing")).toBe(true);
  expect(filterOf(lensed)?.querySelector('feImage[result="shape"]')).not.toBeNull();
  expect(lensed.style.visibility).toBe("visible");
  expect(labels.style.getPropertyValue("mask-image")).toMatch(/^url\("data:image\/png/);

  fireEvent.pointerUp(window, pointer);
  expect(bar.hasAttribute("data-lensing")).toBe(false);
  expect(lensed.style.filter).toBe("");
  expect(labels.style.getPropertyValue("mask-image")).toBe("");
});
