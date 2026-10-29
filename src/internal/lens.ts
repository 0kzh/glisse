import { container, svg } from "./refraction";

// A lens is glass that moves over content of its own, like a switch's thumb
// over its track. As in Aave's web glass, the content itself is filtered: a
// displacement map drawn for the lens's shape is placed where the glass
// stands, so only what's under the glass bends. Filtering the content rather
// than the backdrop works in every browser and needs no copy of anything.
//
// A lens can also show a stand-in for what's under it, as Aave's slider shows
// a thicker track inside its thumb: the stand-in is filtered to show only
// within the lens, and what it replaces is hidden there.
//
// The map is greys, one for each direction of pull, each displaced by in a
// pass of its own. On a wide-gamut display Chrome converts a map's colours to
// the display's before displacing by them, so a coloured map, with the pull
// across in red and down in green, bends a pull straight down sideways too,
// and differently from one straight up. Greys come through unchanged, and
// alpha isn't converted at all, so each pass reads its own grey and takes the
// other direction from an alpha of one half, which is no pull.
//
// WebKit (Safari, and every browser on iOS) draws an SVG filter on HTML only
// in bounding-box units, where it scales a displacement by the box's width
// across and its height down, so there each pass gets its own scale.
// It paints none of a filter's output outside the element, so the content
// needs room for the whole lens, and nothing inside it may be clipped round
// its corners. And it keeps showing a filter's old output until the filter's
// id changes, so each move gets a new id.

/** How a lens bends what's under it. */
export interface LensOptions {
  /**
   * How far in the rim reaches for what it shows, as a share of the lens's
   * shorter side.
   */
  strength: number;
  /** A custom property on the glass that, when set, overrides the strength. */
  strengthProperty?: string;
  /** The strength on a dark page, if it differs. */
  darkStrength?: number;
  /** How strongly the rim catches the light, if not the page's `--lg-lens-shine`. */
  shine?: number;
  /** Width of the lit edge, in px, if not the page's. */
  edgeWidth?: number;
  /** How much further red bends than blue, from 0 to 1. */
  dispersion: number;
  /** Width of the band around the rim that bends, in px. */
  depth: number;
  /** Sag of the dome whose slope sets the bend along the rim, in px. */
  dome: number;
  /** How far the bend near each side keeps to that side's own direction, from 0 to 1. */
  splay: number;
}

/** Where the light catches the rim. */
export interface Light {
  /** Direction of the light, in degrees. */
  angle: number;
  glow: number;
  spread: number;
  glowPower: number;
  edge: number;
  edgeWidth: number;
  edgePower: number;
}

// Aave's light for dark and light surroundings.
const DARK: Light = { angle: 45, glow: 0.4, spread: 0.5, glowPower: 1.5, edge: 0.5, edgeWidth: 2, edgePower: 1.5 };
const LIGHT: Light = { angle: 30, glow: 0.4, spread: 0.5, glowPower: 2, edge: 0.5, edgeWidth: 1.5, edgePower: 1 };

interface Shape {
  width: number;
  height: number;
  radius: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// erf(x) ≈ tanh(√π x)
const erf = (x: number) => Math.tanh(1.7724538509 * x);

// Signed distance to a rounded rectangle centred on the origin; negative inside.
function distance(x: number, y: number, halfWidth: number, halfHeight: number, radius: number): number {
  const qx = Math.abs(x) - halfWidth + radius;
  const qy = Math.abs(y) - halfHeight + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

interface Arc {
  radius: number;
  scale: number;
}

// The circular arc that sags by `sag` across `half`, scaled so its slope
// averages a half over that span.
function arc(sag: number, half: number): Arc {
  const radius = (half * half + sag * sag) / (2 * sag);
  let sum = 0;
  for (let i = 0; i <= 200; i++) {
    const x = (i / 200) * half;
    const slope = x / Math.sqrt(radius * radius - x * x);
    sum += i === 0 || i === 200 ? slope / 2 : slope;
  }
  const mean = sum / 200;
  return { radius, scale: mean > 0 ? 0.5 / mean : 1 };
}

const slope = (x: number, { radius, scale }: Arc) => {
  const inside = Math.min(x, 0.999 * radius);
  return (inside / Math.sqrt(radius * radius - inside * inside)) * scale;
};

/** A lens's map, sized in device pixels. */
export interface LensMap {
  columns: number;
  rows: number;
  /** Greys of the pull across: 128 is none, lighter pulls from the right. */
  across: Uint8ClampedArray;
  /** Greys of the pull down: 128 is none, lighter pulls from below. */
  down: Uint8ClampedArray;
  /** Greys of the light caught (128 is none), with alpha covering where the lens bends at all. */
  light: Uint8ClampedArray;
  /** White, with alpha covering the lens's whole shape. */
  shape: Uint8ClampedArray;
}

/**
 * Draws a lens's map, after Aave's: within a band about `depth` wide around
 * the rim, each point shows content from further in, by the slope of a
 * shallow dome there, and the rest is left as it is. The light is a glow
 * along the light's axis and a thin lit edge. Its alpha fades out where the
 * bend does, so the middle shows the content exactly: a displacement map
 * can't hold "none" exactly in a byte, and WebKit, which stretches the map
 * across a long box, would otherwise shift the middle by a pixel.
 */
export function lensMap(shape: Shape, options: LensOptions, light: Light, density: number): LensMap {
  const { width, height } = shape;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const radius = clamp(shape.radius, 0, Math.min(halfWidth, halfHeight));
  const columns = Math.max(1, Math.round(width * density));
  const rows = Math.max(1, Math.round(height * density));
  const pullAcross = new Uint8ClampedArray(columns * rows * 4);
  const pullDown = new Uint8ClampedArray(columns * rows * 4);
  const caught = new Uint8ClampedArray(columns * rows * 4);
  const shapeMask = new Uint8ClampedArray(columns * rows * 4);
  const grey = (data: Uint8ClampedArray, i: number, value: number, alpha = 255) => {
    data[i] = data[i + 1] = data[i + 2] = value;
    data[i + 3] = alpha;
  };

  const { depth, dome, splay } = options;
  const innerWidth = Math.max(0, halfWidth - depth);
  const innerHeight = Math.max(0, halfHeight - depth);
  const innerRadius = clamp(radius, 0, Math.min(innerWidth, innerHeight));
  const ramp = depth > 0 ? 1 / (depth * Math.SQRT2) : 1e6;
  const sag = Math.max(0.01, Math.min(dome, Math.min(halfWidth, halfHeight) - 1));
  const across = dome > 0 ? arc(sag, halfWidth) : null;
  const down = dome > 0 ? arc(sag, halfHeight) : null;
  const reach = 0.5 * Math.min(halfWidth, halfHeight);
  const cos = Math.cos((light.angle * Math.PI) / 180);
  const sin = Math.sin((light.angle * Math.PI) / 180);
  const glowStart = (1 - light.spread) * Math.SQRT2;
  const glowRange = light.spread * Math.SQRT2;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const i = (row * columns + column) * 4;
      const x = ((column + 0.5) / columns) * width - halfWidth;
      const y = ((row + 0.5) / rows) * height - halfHeight;
      const edge = distance(x, y, halfWidth, halfHeight, radius);
      // Smoothed over the last pixel at the edge.
      grey(shapeMask, i, 255, Math.round(255 * clamp(-edge, 0, 1)));
      if (edge >= 0) {
        grey(pullAcross, i, 128);
        grey(pullDown, i, 128);
        grey(caught, i, 128, 0);
        continue;
      }

      const ax = Math.abs(x);
      const ay = Math.abs(y);
      let dx = across ? Math.sign(x) * slope(ax, across) : clamp(x / halfWidth, -1, 1);
      let dy = down ? Math.sign(y) * slope(ay, down) : clamp(y / halfHeight, -1, 1);

      // Near the top and bottom the pull turns towards straight down and up,
      // near the sides towards straight across, keeping its strength.
      if (splay < 1 && reach > 0) {
        const keepX = Math.max(0, 1 - (halfHeight - ay) / reach) * (1 - splay);
        const keepY = Math.max(0, 1 - (halfWidth - ax) / reach) * (1 - splay);
        if (keepX > 0.001 || keepY > 0.001) {
          const before = Math.hypot(dx, dy);
          dx *= 1 - keepX;
          dy *= 1 - keepY;
          const after = Math.hypot(dx, dy);
          if (after > 0.001) {
            dx *= before / after;
            dy *= before / after;
          }
        }
      }

      const falloff = 0.5 * (1 + erf(distance(x, y, innerWidth, innerHeight, innerRadius) * ramp));
      grey(pullAcross, i, Math.round((0.5 - 0.5 * dx * falloff) * 255));
      grey(pullDown, i, Math.round((0.5 - 0.5 * dy * falloff) * 255));

      const facing = Math.abs(clamp(x / halfWidth, -1, 1) * cos + clamp(y / halfHeight, -1, 1) * sin);
      const glow =
        glowRange > 0.001 ? light.glow * clamp((facing - glowStart) / glowRange, 0, 1) ** light.glowPower * falloff : 0;
      const rim = light.edge * Math.max(0, 1 + edge / light.edgeWidth) * facing ** light.edgePower;
      // Fully in once the pull reaches about a twentieth of its strength, and
      // smoothed over the last pixel at the edge.
      const bends = Math.round(255 * Math.min(1, falloff * 20, -edge));
      grey(caught, i, Math.round(127 * Math.min(1, glow + rim) + 128), bends);
    }
  }
  return { columns, rows, across: pullAcross, down: pullDown, light: caught, shape: shapeMask };
}

/** PNG data URLs of a lens's map. */
interface Encoded {
  across: string;
  down: string;
  light: string;
  shape: string;
}

const encoded = new Map<string, Encoded>();

function encode(key: string, draw: () => LensMap): Encoded | null {
  const cached = encoded.get(key);
  if (cached) return cached;
  const { columns, rows, across, down, light, shape } = draw();
  const canvas = document.createElement("canvas");
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const image = context.createImageData(columns, rows);
  const png = (data: Uint8ClampedArray) => {
    image.data.set(data);
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
  };
  const result = { across: png(across), down: png(down), light: png(light), shape: png(shape) };
  encoded.set(key, result);
  return result;
}

/** WebKit needs filters in bounding-box units. */
const boxUnits = (): boolean =>
  /AppleWebKit\//.test(navigator.userAgent) && !/Chrom(?:e|ium)\//.test(navigator.userAgent);

const CHANNELS = ["1 0 0 0 0  0 0 0 0 0  0 0 0 0 0", "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0", "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0"];

const MASKING = ["image", "position", "size", "repeat", "composite"] as const;

// Masks an element with its layers excluding each other, or clears its mask.
function mask(element: HTMLElement, layers?: { image: string; position: string; size: string }): void {
  for (const part of MASKING) {
    element.style.removeProperty(`-webkit-mask-${part}`);
    element.style.removeProperty(`mask-${part}`);
  }
  if (!layers) return;
  const values = { ...layers, repeat: "no-repeat", composite: "exclude" };
  for (const part of MASKING) {
    // Older WebKit knows only the prefixed names, and calls exclude xor.
    element.style.setProperty(`-webkit-mask-${part}`, part === "composite" ? "xor" : values[part]);
    element.style.setProperty(`mask-${part}`, values[part]);
  }
}

/** Glass that moves over content of its own. */
export interface Lens {
  /** Refracts while active, as when the glass is lifted. */
  setActive(active: boolean): void;
  /** Call after moving or scaling the glass, to keep the refraction under it. */
  update(): void;
  destroy(): void;
}

let made = 0;

/**
 * Makes `glass` a lens over `content`, which must have room for the whole
 * lens. Given `replaces`, the content is a stand-in for it under the glass:
 * the content is shown only within the lens (keep it hidden otherwise), and
 * `replaces` is hidden there. The glass's `--lg-lens-shine` sets the light on
 * its rim: above 0 it brightens, below 0 it darkens, as on a light page.
 * Both it and the strength property are read each time the lens becomes
 * active.
 */
export function createLens(glass: HTMLElement, content: HTMLElement, options: LensOptions, replaces?: HTMLElement): Lens {
  const box = boxUnits();
  const name = `glisse-lens-${made++}`;
  let active = false;
  let strength = options.strength;
  let built = "";
  let placed = "";
  let version = 0;
  let filter: SVGElement | undefined;
  let images: SVGElement[] = [];
  let cutout = "";
  // Each colour's pass across, then down.
  let rays: [SVGElement, SVGElement][] = [];

  // A filter that leaves the content as it is but for the lens's rim, where
  // it's displaced by the map, once for each of red, green and blue as the
  // glass disperses, and lit. Only the map is placed; the rest runs over the
  // whole content, so nothing else needs lining up with it.
  const build = (maps: Encoded, shine: number) => {
    filter?.remove();
    const unit = box ? "objectBoundingBox" : "userSpaceOnUse";
    filter = svg("filter", { filterUnits: unit, primitiveUnits: unit, "color-interpolation-filters": "sRGB" });
    if (box) {
      for (const [key, value] of Object.entries({ x: 0, y: 0, width: 1, height: 1 })) filter.setAttribute(key, String(value));
    }
    const place = (href: string, result: string) => svg("feImage", { href, preserveAspectRatio: "none", result });
    images = [place(maps.across, "across"), place(maps.down, "down"), place(maps.light, "raw")];
    filter.append(svg("feFlood", { "flood-color": "rgb(128, 128, 128)", result: "neutral" }), ...images);
    // Each pull, no pull beyond the map, with an alpha of one half for the
    // direction it doesn't pull in.
    for (const pull of ["across", "down"]) {
      const half = svg("feComponentTransfer", { in: `${pull}-grey`, result: `${pull}-pull` });
      half.append(svg("feFuncA", { type: "linear", slope: 0, intercept: 0.5 }));
      filter.append(svg("feComposite", { in: pull, in2: "neutral", operator: "over", result: `${pull}-grey` }), half);
    }
    // Each colour keeps a third of its alpha, so content that's partly
    // transparent adds back up to what it was; its colour is tripled after.
    rays = CHANNELS.map((channel, i) => {
      const across = svg("feDisplacementMap", {
        in: "SourceGraphic",
        in2: "across-pull",
        xChannelSelector: "R",
        yChannelSelector: "A",
        result: `across-${i}`,
      });
      const down = svg("feDisplacementMap", {
        in: `across-${i}`,
        in2: "down-pull",
        xChannelSelector: "A",
        yChannelSelector: "R",
        result: `ray-${i}`,
      });
      const third = `${channel}  0 0 0 0.3333 0`;
      filter!.append(across, down, svg("feColorMatrix", { in: `ray-${i}`, type: "matrix", values: third, result: `light-${i}` }));
      return [across, down];
    });
    filter.append(
      svg("feComposite", { in: "light-0", in2: "light-1", operator: "arithmetic", k2: 1, k3: 1, result: "light-01" }),
      svg("feComposite", { in: "light-01", in2: "light-2", operator: "arithmetic", k2: 1, k3: 1, result: "spread" }),
      svg("feColorMatrix", { in: "spread", type: "matrix", values: "3 0 0 0 0  0 3 0 0 0  0 0 3 0 0  0 0 0 1 0", result: "bent" }),
    );
    // The light on the rim, from its grey: added as white, or on a light page
    // as shade multiplied in.
    if (shine > 0) {
      const white = `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 ${-128 / 255}`;
      filter.append(
        svg("feColorMatrix", { in: "raw", type: "matrix", values: white, result: "glint" }),
        svg("feComposite", { in: "glint", in2: "bent", operator: "arithmetic", k2: shine, k3: 1, result: "lit" }),
      );
    } else if (shine < 0) {
      const row = `0 0 ${shine} 0 ${1 - (128 * shine) / 255}`;
      filter.append(
        svg("feColorMatrix", { in: "raw", type: "matrix", values: `${row}  ${row}  ${row}  0 0 0 0 1`, result: "shade" }),
        svg("feComposite", { in: "shade", in2: "bent", operator: "arithmetic", k1: 1, result: "lit" }),
      );
    }
    // Where the map covers, the bent content; elsewhere the content as it
    // was. Both are split by the map's own alpha, so they add back up exactly
    // where it fades. A stand-in is then cut to the lens's shape.
    filter.append(
      svg("feComposite", { in: shine ? "lit" : "bent", in2: "raw", operator: "in", result: "inside" }),
      svg("feComposite", { in: "SourceGraphic", in2: "raw", operator: "out", result: "outside" }),
      svg("feComposite", { in: "inside", in2: "outside", operator: "arithmetic", k2: 1, k3: 1, result: "seen" }),
    );
    cutout = maps.shape;
    if (replaces) {
      const outline = place(maps.shape, "shape");
      images.push(outline);
      filter.append(outline, svg("feComposite", { in: "seen", in2: "shape", operator: "in" }));
    }
    container().append(filter);
    placed = "";
  };

  // Draws the map for the glass's size, shape and light, if they've changed.
  const prepare = (): boolean => {
    const width = glass.offsetWidth;
    const height = glass.offsetHeight;
    if (!width || !height) return false;
    const style = getComputedStyle(glass);
    const corner = style.borderTopLeftRadius;
    const radius = Math.min(
      width / 2,
      height / 2,
      corner.endsWith("%") ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner) || 0,
    );
    // The page's shine is negative on a light page, where the rim darkens.
    const page = parseFloat(style.getPropertyValue("--lg-lens-shine")) || 0;
    const shine = options.shine === undefined ? page : Math.sign(page) * options.shine;
    const tuned = options.strengthProperty ? parseFloat(style.getPropertyValue(options.strengthProperty)) : NaN;
    const own = page > 0 ? (options.darkStrength ?? options.strength) : options.strength;
    strength = Number.isFinite(tuned) ? tuned : own;
    const density = Math.min(devicePixelRatio || 1, 2);
    const key = [width, height, radius, density, shine, ...Object.values(options)].join("|");
    if (key === built && filter) return true;
    const theme = page < 0 ? LIGHT : DARK;
    const light = options.edgeWidth === undefined ? theme : { ...theme, edgeWidth: options.edgeWidth };
    const maps = encode(key, () => lensMap({ width, height, radius }, options, light, density));
    if (!maps) return false;
    built = key;
    build(maps, shine);
    return true;
  };

  const update = () => {
    if (!active || !filter) return;
    const across = content.offsetWidth;
    const down = content.offsetHeight;
    const from = content.getBoundingClientRect();
    const at = glass.getBoundingClientRect();
    if (!across || !down || !at.width || !at.height) return;
    // The glass's box in the content's own pixels, past any scale on both.
    const unit = from.width / across || 1;
    const x = (at.left - from.left) / unit;
    const y = (at.top - from.top) / unit;
    const width = at.width / unit;
    const height = at.height / unit;
    const next = [x, y, width, height, across, down].map((value) => value.toFixed(2)).join(" ");
    if (next === placed) return;
    placed = next;

    const reach = strength * Math.min(width, height);
    const spectrum = [1 + 0.2 * options.dispersion, 1 + 0.1 * options.dispersion, 1];
    let rect: Record<string, number>;
    if (box) {
      rays.forEach(([pullAcross, pullDown], i) => {
        pullAcross.setAttribute("scale", String((reach / across) * spectrum[i]!));
        pullDown.setAttribute("scale", String((reach / down) * spectrum[i]!));
      });
      rect = { x: x / across, y: y / down, width: width / across, height: height / down };
    } else {
      const region = { x: 0, y: 0, width: across, height: down };
      for (const [key, value] of Object.entries(region)) filter.setAttribute(key, String(value));
      rays.forEach((pair, i) => {
        for (const ray of pair) ray.setAttribute("scale", String(reach * spectrum[i]!));
      });
      rect = { x, y, width, height };
    }
    for (const placing of images) {
      for (const [key, value] of Object.entries(rect)) placing.setAttribute(key, String(value));
    }
    filter.id = `${name}-${++version}`;
    content.style.filter = `url("#${filter.id}")`;

    if (replaces) {
      content.style.visibility = "visible";
      // What's replaced keeps everything but the lens's shape.
      const behind = replaces.getBoundingClientRect();
      const left = (at.left - behind.left) / unit;
      const top = (at.top - behind.top) / unit;
      mask(replaces, {
        image: `url("${cutout}"), linear-gradient(#000, #000)`,
        position: `${left}px ${top}px, 0 0`,
        size: `${width}px ${height}px, 100% 100%`,
      });
    }
  };

  const clear = () => {
    placed = "";
    content.style.removeProperty("filter");
    content.style.removeProperty("visibility");
    if (replaces) mask(replaces);
  };

  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active && prepare()) {
        placed = "";
        update();
      } else if (!active) {
        clear();
      }
    },
    update,
    destroy() {
      active = false;
      filter?.remove();
      clear();
    },
  };
}
