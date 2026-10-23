import { register } from "./internal/registry";

// Refraction model: https://kube.io/blog/liquid-glass-css-svg/

const SVG = "http://www.w3.org/2000/svg";
interface Lens {
  filter: string;
  rim: string;
}

const lenses = new Map<string, Lens>();
let defs: SVGDefsElement | undefined;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function svg(name: string, attributes: Record<string, string | number>): SVGElement {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function container(): SVGDefsElement {
  if (defs?.isConnected) return defs;
  const root = svg("svg", { width: 0, height: 0, "aria-hidden": "true" });
  root.style.cssText = "position:absolute;pointer-events:none";
  defs = svg("defs", {}) as SVGDefsElement;
  root.append(defs);
  document.body.append(root);
  return defs;
}

function profile(bezel: number, thickness: number, cap: number): { samples: Float32Array; maximum: number } {
  const samples = new Float32Array(128);
  let maximum = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = Math.max(0.001, i / (samples.length - 1));
    const surface = (1 - (1 - t) ** 4) ** 0.25;
    const incident = Math.atan((1 - t) ** 3 / surface ** 3);
    const refracted = Math.asin(Math.sin(incident) / 1.5);
    samples[i] = Math.min(cap, Math.tan(incident - refracted) * (thickness + surface * bezel));
    maximum = Math.max(maximum, samples[i]!);
  }
  return { samples, maximum };
}

function maps(width: number, height: number, radius: number, selection: boolean) {
  const density = Math.min(devicePixelRatio || 1, 2);
  const bezel = clamp(Math.min(width, height) * 0.12, 4, 10);
  const thickness = clamp(Math.min(width, height) * 0.2, 8, 24);
  const { samples, maximum } = profile(bezel, thickness, selection ? 14 : Infinity);

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * density);
  canvas.height = Math.ceil(height * density);
  const context = canvas.getContext("2d")!;
  const field = context.createImageData(canvas.width, canvas.height);
  const shine = context.createImageData(canvas.width, canvas.height);
  const direction = selection ? 1 : -1;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const px = ((x + 0.5) * width) / canvas.width - width / 2;
      const py = ((y + 0.5) * height) / canvas.height - height / 2;
      const qx = Math.abs(px) - (width / 2 - radius);
      const qy = Math.abs(py) - (height / 2 - radius);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const length = Math.hypot(ox, oy);
      const distance = radius - (length + Math.min(Math.max(qx, qy), 0));
      const nx = length > 0 ? (ox / length) * Math.sign(px) : qx > qy ? Math.sign(px) : 0;
      const ny = length > 0 ? (oy / length) * Math.sign(py) : qx > qy ? 0 : Math.sign(py);

      let shift = 0;
      if (distance >= 0 && distance < bezel) {
        const sample = (distance / bezel) * (samples.length - 1);
        const lower = Math.floor(sample);
        const a = samples[lower]!;
        const b = samples[Math.min(lower + 1, samples.length - 1)]!;
        shift = a + (b - a) * (sample - lower);
      }

      const i = (y * canvas.width + x) * 4;
      field.data[i] = Math.round(127.5 + ((direction * nx * shift) / maximum) * 127.5);
      field.data[i + 1] = Math.round(127.5 + ((direction * ny * shift) / maximum) * 127.5);
      field.data[i + 2] = 128;
      field.data[i + 3] = 255;

      const light = -(nx + ny) * Math.SQRT1_2;
      const glint = Math.max(light, 0) ** 3;
      const reflected = Math.max(-light, 0) ** 3;
      shine.data[i] = shine.data[i + 1] = shine.data[i + 2] = 255;

      let alpha = 0;
      if (distance >= 0 && selection) {
        const bands = [0.18, 0.42, 0.66].map((centre) => Math.exp(-(((distance - centre) / 0.22) ** 2)));
        const peak = Math.max(...bands);
        alpha = peak * (0.06 + 0.8 * glint + 0.35 * reflected) * 0.85;
        for (let channel = 0; channel < 3; channel++) {
          shine.data[i + channel] = Math.round(255 * (0.65 + 0.35 * (peak ? bands[channel]! / peak : 0)));
        }
      } else if (distance >= 0) {
        const rim = Math.exp(-(((distance - 0.4) / 0.38) ** 2));
        const bloom = Math.exp(-((distance / (bezel * 0.22)) ** 2));
        alpha = rim * (0.045 + 0.52 * glint + 0.2 * reflected) + bloom * 0.02 * glint;
      }
      shine.data[i + 3] = Math.round(clamp(alpha, 0, 1) * 255);
    }
  }

  context.putImageData(field, 0, 0);
  const displacement = canvas.toDataURL();
  context.putImageData(shine, 0, 0);
  const highlight = canvas.toDataURL();
  return { displacement, highlight, scale: maximum * 2 };
}

// The filter only bends the rim. Blur and the rim highlight are applied in CSS,
// which Chromium positions correctly when it repaints part of the glass.
function lens(width: number, height: number, radius: number, selection: boolean): Lens {
  const key = `${width}-${height}-${radius}-${selection}`;
  const cached = lenses.get(key);
  if (cached) return cached;

  const { displacement, highlight, scale } = maps(width, height, radius, selection);
  const id = `liquidglass-${lenses.size}`;
  const box = { x: 0, y: 0, width, height };
  const filter = svg("filter", {
    id,
    ...box,
    filterUnits: "userSpaceOnUse",
    primitiveUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  });

  filter.append(svg("feImage", { href: displacement, ...box, preserveAspectRatio: "none", result: "field" }));

  if (selection) {
    const channels = [
      ["r", 1.035, "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"],
      ["g", 1, "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"],
      ["b", 0.965, "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"],
    ] as const;
    for (const [name, factor, values] of channels) {
      filter.append(
        svg("feDisplacementMap", {
          in: "SourceGraphic",
          in2: "field",
          scale: scale * factor,
          xChannelSelector: "R",
          yChannelSelector: "G",
          result: `${name}-ray`,
        }),
        svg("feColorMatrix", { in: `${name}-ray`, type: "matrix", values, result: name }),
      );
    }
    filter.append(
      svg("feComposite", { in: "r", in2: "g", operator: "arithmetic", k2: 1, k3: 1, result: "rg" }),
      svg("feComposite", { in: "rg", in2: "b", operator: "arithmetic", k2: 1, k3: 1 }),
    );
  } else {
    filter.append(
      svg("feDisplacementMap", {
        in: "SourceGraphic",
        in2: "field",
        scale,
        xChannelSelector: "R",
        yChannelSelector: "G",
        result: "displaced",
      }),
      svg("feColorMatrix", { in: "displaced", type: "saturate", values: 1.5 }),
    );
  }
  container().append(filter);

  const result = { filter: `url("#${id}")`, rim: `url("${highlight}")` };
  lenses.set(key, result);
  return result;
}

function fit(element: HTMLElement, selection: boolean): void {
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  if (!width || !height) return;
  const corner = getComputedStyle(element).borderTopLeftRadius;
  const radius = Math.min(
    width / 2,
    height / 2,
    corner.endsWith("%") ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner),
  );
  const { filter, rim } = lens(width, height, radius, selection);
  element.style.setProperty("--lg-filter", filter);
  element.style.setProperty("--lg-rim", rim);
}

function whenIdle(callback: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const handle = requestIdleCallback(callback, { timeout: 500 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(callback, 50);
  return () => clearTimeout(handle);
}

/**
 * Refracts the backdrop through glass surfaces in Chromium browsers. Other
 * browsers keep the blur. Call once on the client, before glass renders.
 */
export function enableRefraction(): void {
  if (typeof navigator === "undefined" || !/Chrom(?:e|ium)\//.test(navigator.userAgent)) return;
  register((element, selection) => {
    let cancel: (() => void) | undefined;
    const observer = new ResizeObserver(() => {
      cancel?.();
      cancel = whenIdle(() => fit(element, selection));
    });
    observer.observe(element);
    return () => {
      cancel?.();
      observer.disconnect();
      element.style.removeProperty("--lg-filter");
      element.style.removeProperty("--lg-rim");
    };
  });
}
