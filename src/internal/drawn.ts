import { boxUnits, lensField, shapeOf, tuning, type Lens, type LensOptions, type Shape } from "./lens";

// WebKit (Safari, and every browser on iOS) can't filter a backdrop with a
// lens, and bends content with one slowly: it displaces on the CPU, about
// 20ms for each of a lens's six passes over a lens 420 by 235 at 2x, however
// small the filter's other steps. So there, glass over marked content draws
// its bent rim itself. The content is painted on a canvas and made a
// texture, and each frame the glass has moved over it, a shader bends the
// part under the glass through the lens's own pull (see lens.ts), frosts and
// tints it as the glass's CSS does, and lays it over the glass's rim, fading
// out where the bend does. The middle of the glass stays the page itself,
// behind the glass's own frost.
//
// Content that fits a texture is painted whole, once, and again only when it
// changes; moving it under the glass, as scrolling it does, or the glass over
// it, paints nothing. Painting a canvas and uploading it is most of what this
// costs in Safari, which reads an accelerated canvas back from the GPU to do
// it, so that's done once however many lenses are over the content and
// however they move. Larger content, or content that changes every frame (a
// video or a canvas), is painted only under each glass, each frame it moves.
//
// What's painted is what a canvas can draw: images, video, other canvases,
// text, background colours, linear gradients and background images. Anything
// else under the rim (borders, shadows, SVG, other gradients, images from
// another origin that don't allow it) is left as the page shows it, unbent.
// After the paint, each lens costs its own size alone: four small draws on
// the GPU, and a copy onto its canvas.

/** Whether this browser draws its lenses rather than filtering with them. */
export const drawsLens = (): boolean => boxUnits() && !!stage();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// The shaders. The lens first bends what's under it: each colour is read
// from as far in as it bends, by the lens's pull, `field` (lensField). What
// it shows is then softened as the glass's frost softens its backdrop, by a
// Gaussian blur across and then down, and last saturated and tinted as the
// glass is, and faded out where the lens doesn't bend. Bending comes before
// the frost, as it does where the browser filters: frost that was bent with
// the content would be squeezed with it, into streaks along the rim.
//
// A step drawn into a texture is drawn the right way up for the next to read
// (`st`); the last, drawn on the canvas, is turned over (`uv`).
const VERTEX = `#version 300 es
out vec2 uv;
out vec2 st;
void main() {
  vec2 corner = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  uv = vec2(corner.x + 1.0, 1.0 - corner.y) * 0.5;
  st = (corner + 1.0) * 0.5;
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

// `under` is the content, `window` across and down, painted `scale` times as
// finely as the lens is drawn, with the lens's corner at `origin` in it: all
// of the content, or just what's under the lens with a margin round it. The
// lens is `size`, and pulls from at most `reach` further in. Beyond the
// content there's nothing to show.
const BEND = `#version 300 es
precision highp float;
uniform sampler2D under;
uniform sampler2D field;
uniform vec2 size;
uniform vec2 window;
uniform vec2 origin;
uniform float scale;
uniform float reach;
uniform float split;
in vec2 st;
out vec4 colour;

vec4 at(vec2 point) {
  vec2 from = (origin + point * scale) / window;
  if (any(lessThan(from, vec2(0.0))) || any(greaterThan(from, vec2(1.0)))) return vec4(0.0);
  return texture(under, from);
}

void main() {
  vec2 point = st * size;
  vec2 pull = texture(field, st).rg * reach;
  vec4 red = at(point - pull * (1.0 + 0.2 * split));
  vec4 green = at(point - pull * (1.0 + 0.1 * split));
  vec4 blue = at(point - pull);
  colour = vec4(red.r, green.g, blue.b, (red.a + green.a + blue.a) / 3.0);
}`;

// Seventeen points out to three deviations; `stride` is one deviation.
const SOFTEN = `#version 300 es
precision highp float;
uniform sampler2D under;
uniform vec2 stride;
in vec2 st;
out vec4 colour;
void main() {
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = -8; i <= 8; i++) {
    float x = float(i) * 0.375;
    float weight = exp(-0.5 * x * x);
    sum += texture(under, st + stride * x) * weight;
    total += weight;
  }
  colour = sum / total;
}`;

const FINISH = `#version 300 es
precision highp float;
uniform sampler2D under;
uniform sampler2D field;
uniform float saturation;
uniform vec4 tint;
in vec2 uv;
out vec4 colour;
void main() {
  vec4 lens = texture(field, uv);
  vec4 seen = texture(under, uv);
  float grey = dot(seen.rgb, vec3(0.2126, 0.7152, 0.0722));
  seen.rgb = clamp(mix(vec3(grey), seen.rgb, saturation), 0.0, seen.a);
  seen.rgb = seen.rgb * (1.0 - tint.a) + tint.rgb * tint.a * seen.a;
  colour = seen * min(lens.b, lens.a);
}`;

/** A shader, and where its settings go. */
interface Step {
  program: WebGLProgram;
  at: Record<string, WebGLUniformLocation | null>;
}

interface Stage {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  bend: Step;
  soften: Step;
  finish: Step;
  /** The texture of what's under the lens being drawn, for content painted lens by lens. */
  under: WebGLTexture;
  /** The widest texture this GPU takes, in pixels. */
  largest: number;
  /**
   * What's under a lens bent, then softened across, then down too, each
   * drawn through `frame`: three textures for each size of lens, in pixels,
   * so lenses of different sizes drawn in turn needn't size them again.
   */
  drawn: Map<string, [WebGLTexture, WebGLTexture, WebGLTexture]>;
  frame: WebGLFramebuffer;
  /** The canvas that's painted on. */
  paper: HTMLCanvasElement;
  pen: CanvasRenderingContext2D;
}

let shared: Stage | null | undefined;

// The one WebGL context every lens is drawn in, then copied from: a page may
// have more glass than a browser allows contexts.
function stage(): Stage | null {
  if (shared !== undefined) return shared;
  shared = null;
  if (typeof document === "undefined") return null;
  try {
    shared = build();
  } catch {
    // No WebGL 2 to be had: the content is filtered instead.
  }
  return shared;
}

function build(): Stage | null {
  const canvas = document.createElement("canvas");
  const paper = document.createElement("canvas");
  const gl = canvas.getContext?.("webgl2", { antialias: false, depth: false, stencil: false });
  const pen = paper.getContext?.("2d");
  if (!gl || !pen) return null;
  const step = (fragment: string, ...names: string[]): Step | null => {
    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "under"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "field"), 1);
    return { program, at: Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])) };
  };
  const bend = step(BEND, "size", "window", "origin", "scale", "reach", "split");
  const soften = step(SOFTEN, "stride");
  const finish = step(FINISH, "saturation", "tint");
  if (!bend || !soften || !finish) return null;
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.enable(gl.SCISSOR_TEST);
  const under = texture(gl);
  const frame = gl.createFramebuffer();
  // A lost context comes back as a new stage, and each lens's field with it.
  canvas.addEventListener("webglcontextlost", () => {
    shared = undefined;
  });
  const largest = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
  return { canvas, gl, bend, soften, finish, under, largest, drawn: new Map(), frame, paper, pen };
}

function texture(gl: WebGL2RenderingContext): WebGLTexture {
  const made = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, made);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return made;
}

// The content, as pieces a canvas can draw, in the order the page paints them.

/** Something of the content's that a canvas can draw. */
interface Piece {
  /** The element whose box it's drawn in. */
  element: Element;
  /** How opaque it is, with everything it's inside. */
  alpha: number;
  /** Draws it in its element's box, in the viewport's px. */
  paint(pen: CanvasRenderingContext2D, box: DOMRect): void;
  /** What it shows now, if that changes without the page changing: a video's time. */
  live?: () => unknown;
  /** What it draws from, if that could be from another origin. */
  media?: CanvasImageSource;
  /** Set once it's found to be from another origin, which no canvas may read back. */
  barred?: boolean;
}

const percent = (value: string | undefined, fallback: number) =>
  value?.endsWith("%") ? parseFloat(value) / 100 : value === "left" || value === "top" ? 0 : value === "right" || value === "bottom" ? 1 : fallback;

function rounded(pen: CanvasRenderingContext2D, box: DOMRect, radius: number): void {
  pen.beginPath();
  if (radius > 0 && pen.roundRect) pen.roundRect(box.x, box.y, box.width, box.height, Math.min(radius, box.width / 2, box.height / 2));
  else pen.rect(box.x, box.y, box.width, box.height);
}

// Draws media `across` by `down` into a box as object-fit or background-size
// would, clipped to the box's corners.
function place(
  pen: CanvasRenderingContext2D,
  media: CanvasImageSource,
  across: number,
  down: number,
  box: DOMRect,
  fit: string,
  position: string,
  radius: number,
): void {
  if (!across || !down || !box.width || !box.height) return;
  let width = box.width;
  let height = box.height;
  const cover = Math.max(box.width / across, box.height / down);
  const contain = Math.min(box.width / across, box.height / down);
  const scale = fit === "cover" ? cover : fit === "contain" ? contain : fit === "scale-down" ? Math.min(1, contain) : fit === "none" ? 1 : 0;
  if (scale) {
    width = across * scale;
    height = down * scale;
  }
  const [x, y] = position.split(" ");
  pen.save();
  rounded(pen, box, radius);
  pen.clip();
  pen.drawImage(media, box.x + (box.width - width) * percent(x, 0.5), box.y + (box.height - height) * percent(y, 0.5), width, height);
  pen.restore();
}

// Splits a CSS list at its top-level commas.
function split(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "(") depth++;
    else if (list[i] === ")") depth--;
    else if (list[i] === "," && !depth) {
      parts.push(list.slice(from, i).trim());
      from = i + 1;
    }
  }
  parts.push(list.slice(from).trim());
  return parts;
}

const SIDES: Record<string, number> = { top: 0, right: 90, bottom: 180, left: 270 };

// A computed linear-gradient() for a box, or null if it's anything else.
function gradient(pen: CanvasRenderingContext2D, value: string, box: DOMRect): CanvasGradient | null {
  const inner = /^linear-gradient\((.*)\)$/s.exec(value)?.[1];
  if (!inner) return null;
  const stops = split(inner);
  let angle = 180;
  const first = stops[0]!;
  if (/^-?[\d.]+deg$/.test(first)) {
    angle = parseFloat(first);
    stops.shift();
  } else if (first.startsWith("to ")) {
    const [a, b] = first.slice(3).split(" ");
    if (b === undefined) angle = SIDES[a!] ?? 180;
    else {
      // Towards a corner: square to the line between the two beside it.
      const across = a === "left" || b === "left" ? -1 : 1;
      const up = a === "top" || b === "top" ? 1 : -1;
      angle = (Math.atan2(across * box.height, up * box.width) * 180) / Math.PI;
    }
    stops.shift();
  }
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(box.width * dx) + Math.abs(box.height * dy)) / 2;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const made = pen.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  const placed = stops.map((stop) => {
    const at = /^(.*?)\s+(-?[\d.]+)(%|px)$/.exec(stop);
    return at ? { colour: at[1]!, at: at[3] === "%" ? parseFloat(at[2]!) / 100 : parseFloat(at[2]!) / (2 * half) } : { colour: stop, at: NaN };
  });
  if (placed.length < 2) return null;
  if (Number.isNaN(placed[0]!.at)) placed[0]!.at = 0;
  if (Number.isNaN(placed.at(-1)!.at)) placed.at(-1)!.at = 1;
  // Stops with no place are spread evenly between those that have one.
  for (let i = 1; i < placed.length; i++) {
    if (!Number.isNaN(placed[i]!.at)) continue;
    let next = i;
    while (Number.isNaN(placed[next]!.at)) next++;
    for (let k = i; k < next; k++) placed[k]!.at = placed[i - 1]!.at + ((placed[next]!.at - placed[i - 1]!.at) * (k - i + 1)) / (next - i + 1);
  }
  try {
    let last = 0;
    for (const stop of placed) made.addColorStop((last = clamp(Math.max(stop.at, last), 0, 1)), stop.colour);
  } catch {
    return null;
  }
  return made;
}

const images = new Map<string, HTMLImageElement>();

// A background image, loading it if it's new. `loaded` is called once it is.
function image(url: string, loaded: () => void): HTMLImageElement {
  let made = images.get(url);
  if (!made) {
    made = new Image();
    made.crossOrigin = "anonymous";
    made.src = url;
    images.set(url, made);
  }
  if (!made.complete) made.addEventListener("load", loaded, { once: true });
  return made;
}

const transparent = (colour: string) => colour === "transparent" || /,\s*0\)$|\/\s*0\)$/.test(colour);

// An element's own background and, if it's an image, video or canvas, what it shows.
function boxes(element: Element, style: CSSStyleDeclaration, alpha: number, changed: () => void, pieces: Piece[]): void {
  const radius = parseFloat(style.borderTopLeftRadius) || 0;
  const colour = style.backgroundColor;
  const layer = split(style.backgroundImage).at(-1)!;
  const url = /^url\(["']?(.*?)["']?\)$/.exec(layer)?.[1];
  const picture = url ? image(url, changed) : null;
  const filled = !transparent(colour);
  if (filled || layer !== "none") {
    const size = style.backgroundSize.split(",").at(-1)!.trim();
    const position = style.backgroundPosition.split(",").at(-1)!.trim();
    pieces.push({
      element,
      alpha,
      media: picture ?? undefined,
      paint(pen, box) {
        if (filled) {
          pen.fillStyle = colour;
          rounded(pen, box, radius);
          pen.fill();
        }
        if (picture) {
          if (!this.barred && picture.complete && picture.naturalWidth) {
            const fit = size === "cover" || size === "contain" ? size : size === "auto" ? "none" : "fill";
            place(pen, picture, picture.naturalWidth, picture.naturalHeight, box, fit, position, radius);
          }
          return;
        }
        const fill = gradient(pen, layer, box);
        if (!fill) return;
        pen.fillStyle = fill;
        rounded(pen, box, radius);
        pen.fill();
      },
    });
  }

  const fit = style.objectFit;
  const position = style.objectPosition;
  if (element instanceof HTMLImageElement) {
    if (!element.complete) element.addEventListener("load", changed, { once: true });
    pieces.push({
      element,
      alpha,
      media: element,
      paint(pen, box) {
        if (!this.barred && element.complete && element.naturalWidth) {
          place(pen, element, element.naturalWidth, element.naturalHeight, box, fit, position, radius);
        }
      },
    });
  } else if (element instanceof HTMLVideoElement) {
    pieces.push({
      element,
      alpha,
      media: element,
      live: () => `${element.currentTime}|${element.readyState}`,
      paint(pen, box) {
        if (!this.barred && element.readyState >= 2) {
          place(pen, element, element.videoWidth, element.videoHeight, box, fit, position, radius);
        }
      },
    });
  } else if (element instanceof HTMLCanvasElement) {
    let frame = 0;
    pieces.push({
      element,
      alpha,
      media: element,
      // A canvas doesn't say when it's drawn on, so it's taken to be, each frame.
      live: () => frame++,
      paint(pen, box) {
        if (!this.barred && element.width && element.height) {
          place(pen, element, element.width, element.height, box, "fill", position, radius);
        }
      },
    });
  }
}

/** A word of text, placed from its element's corner. */
interface Word {
  text: string;
  x: number;
  /** Its baseline. */
  y: number;
}

// A text node's words, each where the page laid it out, so that wrapped,
// centred and justified lines all come out as they are.
function words(node: Text, style: CSSStyleDeclaration, pen: CanvasRenderingContext2D, origin: DOMRect): Word[] {
  const found: Word[] = [];
  const range = document.createRange();
  const metrics = pen.measureText("x");
  const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
  const upper = style.textTransform === "uppercase";
  const lower = style.textTransform === "lowercase";
  let word: Word | null = null;
  let right = 0;
  let top = 0;
  let at = 0;
  for (const letter of node.data) {
    range.setStart(node, at);
    range.setEnd(node, (at += letter.length));
    const box = range.getClientRects()[0];
    // Space, shown or collapsed, ends a word; so does the next line.
    if (!box || !box.width || !letter.trim()) {
      word = null;
      continue;
    }
    if (word && (Math.abs(box.top - top) > box.height / 2 || box.left < right - 1)) word = null;
    if (!word) {
      // The text sits in the middle of its line's box.
      const baseline = box.top + (box.height - ascent - descent) / 2 + ascent;
      found.push((word = { text: "", x: box.left - origin.left, y: baseline - origin.top }));
      top = box.top;
    }
    word.text += upper ? letter.toUpperCase() : lower ? letter.toLowerCase() : letter;
    right = box.right;
  }
  return found;
}

function text(node: Text, parent: Element, style: CSSStyleDeclaration, alpha: number, pen: CanvasRenderingContext2D, pieces: Piece[]): void {
  if (!node.data.trim()) return;
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const spacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
  const colour = style.webkitTextFillColor || style.color;
  pen.font = font;
  const found = words(node, style, pen, parent.getBoundingClientRect());
  if (!found.length || transparent(colour)) return;
  pieces.push({
    element: parent,
    alpha,
    paint(to, box) {
      to.font = font;
      to.fillStyle = colour;
      to.textBaseline = "alphabetic";
      if ("letterSpacing" in to) to.letterSpacing = spacing;
      for (const word of found) to.fillText(word.text, box.x + word.x, box.y + word.y);
      if ("letterSpacing" in to) to.letterSpacing = "0px";
    },
  });
}

/** Marked content, as the lenses over it draw it. */
interface Scene {
  source: HTMLElement;
  lenses: Set<Drawn>;
  pieces: Piece[];
  /** Whether the content has changed since its pieces were found. */
  stale: boolean;
  /** Counts up whenever what the pieces draw has changed without their moving. */
  version: number;
  /** The frame it was last measured in, its box and each piece's then, and all of it as a string. */
  measured: number;
  from: DOMRect;
  boxes: DOMRect[];
  key: string;
  /** All of it, painted once into a texture of its own, if it's been. */
  whole: Whole | null;
  stop(): void;
}

/** Content painted whole, `density` px to its px, and what it was painted from. */
interface Whole {
  texture: WebGLTexture;
  of: Stage;
  key: string;
  density: number;
  across: number;
  down: number;
}

const scenes = new Map<HTMLElement, Scene>();

function scene(source: HTMLElement): Scene {
  const found = scenes.get(source);
  if (found) return found;
  const made: Scene = {
    source,
    lenses: new Set(),
    pieces: [],
    stale: true,
    version: 0,
    measured: -1,
    from: new DOMRect(),
    boxes: [],
    key: "",
    whole: null,
    stop() {},
  };
  const mark = () => {
    made.stale = true;
  };
  const observer = new MutationObserver((records) => {
    // The lenses' own canvases aren't the content's.
    if (records.some((record) => !(record.target instanceof Element) || !record.target.closest(".lg-drawn"))) mark();
  });
  observer.observe(source, { subtree: true, childList: true, characterData: true, attributes: true });
  const resizes = new ResizeObserver(mark);
  resizes.observe(source);
  window.addEventListener("resize", mark);
  source.addEventListener("load", mark, true);
  document.fonts?.addEventListener?.("loadingdone", mark);
  // The page's theme, which recolours the content without changing it.
  const theme = new MutationObserver(mark);
  theme.observe(document.documentElement, { attributes: true });
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener?.("change", mark);
  made.stop = () => {
    theme.disconnect();
    scheme.removeEventListener?.("change", mark);
    observer.disconnect();
    resizes.disconnect();
    window.removeEventListener("resize", mark);
    source.removeEventListener("load", mark, true);
    document.fonts?.removeEventListener?.("loadingdone", mark);
    const { whole } = made;
    if (whole && whole.of === shared) whole.of.gl.deleteTexture(whole.texture);
    made.whole = null;
  };
  scenes.set(source, made);
  return made;
}

// Finds the content's pieces, in the order of the document.
function survey(made: Scene, pen: CanvasRenderingContext2D): void {
  made.stale = false;
  made.version++;
  const pieces: Piece[] = (made.pieces = []);
  const changed = () => {
    made.version++;
  };
  const visit = (element: Element, alpha: number) => {
    const style = getComputedStyle(element);
    if (style.display === "none" || element.classList.contains("lg-drawn")) return;
    alpha *= parseFloat(style.opacity) || 0;
    if (alpha <= 0) return;
    const shown = style.visibility !== "hidden";
    if (shown) boxes(element, style, alpha, changed, pieces);
    for (const child of element.childNodes) {
      if (child instanceof Element) visit(child, alpha);
      else if (shown && child instanceof Text) text(child, element, style, alpha, pen, pieces);
    }
  };
  visit(made.source, 1);
}

// Each piece's box now, once a frame, however many lenses ask.
function measure(made: Scene, frame: number, pen: CanvasRenderingContext2D): void {
  if (made.measured === frame) return;
  made.measured = frame;
  if (made.stale) survey(made, pen);
  const from = (made.from = made.source.getBoundingClientRect());
  let key = `${made.version}`;
  made.boxes = made.pieces.map((piece) => {
    const box = piece.element.getBoundingClientRect();
    key += `|${(box.x - from.x).toFixed(2)},${(box.y - from.y).toFixed(2)},${box.width.toFixed(2)},${box.height.toFixed(2)}`;
    if (piece.live) key += `,${piece.live()}`;
    return box;
  });
  made.key = key;
}

// Whether a canvas would let itself be read back after drawing this.
function readable(media: CanvasImageSource): boolean {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const pen = probe.getContext("2d");
  try {
    pen!.drawImage(media, 0, 0, 1, 1);
    pen!.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

// Paints the content on the stage's paper, `across` by `down` px, `density`
// px to the page's px, with the page's point (`left`, `top`) at its corner,
// and makes it the texture `target`. Pieces wholly outside `near` are left
// out. False if it can't be made a texture at all.
function paintInto(
  on: Stage,
  made: Scene,
  target: WebGLTexture,
  left: number,
  top: number,
  density: number,
  across: number,
  down: number,
  near: DOMRect | null,
): boolean {
  const { gl, pen, paper } = on;
  const from = made.from;
  if (paper.width !== across || paper.height !== down) {
    paper.width = across;
    paper.height = down;
  }
  const paint = () => {
    pen.setTransform(1, 0, 0, 1, 0, 0);
    pen.clearRect(0, 0, across, down);
    pen.setTransform(density, 0, 0, density, -left * density, -top * density);
    pen.save();
    pen.beginPath();
    pen.rect(from.x, from.y, from.width, from.height);
    pen.clip();
    made.pieces.forEach((piece, i) => {
      const box = made.boxes[i]!;
      if (near && (box.right < near.left || box.left > near.right || box.bottom < near.top || box.top > near.bottom)) return;
      pen.globalAlpha = piece.alpha;
      piece.paint(pen, box);
    });
    pen.restore();
  };
  const upload = () => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paper);
  };
  paint();
  try {
    upload();
    return true;
  } catch {
    // Something painted is from another origin: find it, and leave it out from now on.
    for (const piece of made.pieces) if (piece.media && !piece.barred) piece.barred = !readable(piece.media);
    paper.width = across;
    paint();
    try {
      upload();
      return true;
    } catch {
      return false;
    }
  }
}

// The most pixels content is painted whole in: a texture of 32MB.
const WHOLE = 1 << 23;

// The content painted whole, painting it again only if it's changed, or
// null if it's to be painted under each lens instead: when it changes every
// frame, or is too large to paint at least twice as finely as the page's px,
// or as finely as the lenses are drawn if that's less.
function paintWhole(on: Stage, made: Scene, density: number): Whole | null {
  const { width, height } = made.from;
  if (!width || !height || made.pieces.some((piece) => piece.live)) return null;
  const finest = Math.min(density, on.largest / Math.max(width, height), Math.sqrt(WHOLE / (width * height)));
  if (finest < Math.min(density, 2)) return null;
  const key = `${made.key}|${finest}`;
  let whole = made.whole;
  if (whole?.of === on && whole.key === key) return whole;
  if (whole?.of !== on) whole = made.whole = { texture: texture(on.gl), of: on, key: "", density: 0, across: 0, down: 0 };
  whole!.key = "";
  whole!.density = finest;
  whole!.across = Math.ceil(width * finest);
  whole!.down = Math.ceil(height * finest);
  if (!paintInto(on, made, whole!.texture, made.from.x, made.from.y, finest, whole!.across, whole!.down, null)) return null;
  // The texture holds it now; a paper that size would hold as much again.
  on.paper.width = on.paper.height = 0;
  whole!.key = key;
  return whole;
}

/** A lens that draws itself. */
interface Drawn {
  draw(frame: number): void;
}

const lenses = new Set<Drawn>();
let ticking = 0;
let frames = 0;

function tick(): void {
  frames++;
  for (const lens of lenses) lens.draw(frames);
  ticking = lenses.size ? requestAnimationFrame(tick) : 0;
}

const fields = new Map<string, ReturnType<typeof lensField>>();

// A CSS colour as red, green, blue and alpha, each from 0 to 1.
function parse(pen: CanvasRenderingContext2D, colour: string): [number, number, number, number] {
  pen.fillStyle = "#0000";
  pen.fillStyle = colour;
  const value = String(pen.fillStyle);
  if (value.startsWith("#")) {
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16) / 255);
    return [r!, g!, b!, 1];
  }
  const [r = 0, g = 0, b = 0, a = 1] = (value.match(/[\d.]+/g) ?? []).map(Number);
  return [r / 255, g / 255, b / 255, a];
}

/**
 * Makes `glass` a lens over `content` that draws its own bent rim, in a
 * canvas kept inside it, under everything else it holds. It follows the
 * glass and the content by itself, each frame, so `update` does nothing.
 */
export function createDrawnLens(glass: HTMLElement, content: HTMLElement, options: LensOptions): Lens {
  const made = scene(content);
  const layer = document.createElement("i");
  layer.className = "lg-drawn";
  layer.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  const to = canvas.getContext("2d");
  layer.append(canvas);

  let active = false;
  let shape: Shape | null = null;
  let reach = 0;
  let dispersion = 0;
  let blur = 0;
  let fieldKey = "";
  let field: WebGLTexture | null = null;
  let fieldOf: Stage | null = null;
  let last = "";

  const read = () => {
    const style = getComputedStyle(glass);
    shape = shapeOf(glass, style);
    if (!shape) return;
    ({ reach, dispersion } = tuning(style, shape, options));
    const frost = parseFloat(style.getPropertyValue("--lg-blur"));
    blur = Number.isFinite(frost) ? frost : 3;
    const density = Math.min(devicePixelRatio || 1, 2);
    const key = [shape.width, shape.height, shape.radius, density, JSON.stringify(options)].join("|");
    if (key !== fieldKey) field = null;
    fieldKey = key;
    last = "";
  };

  // The lens's pull as a texture, drawn once for its shape.
  const pull = (on: Stage): WebGLTexture => {
    if (field && fieldOf === on) return field;
    let drawn = fields.get(fieldKey);
    if (!drawn) {
      if (fields.size > 32) fields.clear();
      const density = Math.min(devicePixelRatio || 1, 2);
      fields.set(fieldKey, (drawn = lensField(shape!, options, density)));
    }
    const { gl } = on;
    gl.activeTexture(gl.TEXTURE1);
    field = texture(gl);
    fieldOf = on;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, drawn.columns, drawn.rows, 0, gl.RGBA, gl.FLOAT, drawn.data);
    return field;
  };

  const drawn: Drawn = {
    draw(frame) {
      const on = stage();
      if (!on || !to || !shape) return;
      // React may have replaced everything in the glass.
      if (layer.parentNode !== glass) glass.prepend(layer);
      const at = glass.getBoundingClientRect();
      if (!at.width || !at.height || at.bottom < 0 || at.right < 0 || at.top > innerHeight || at.left > innerWidth) return;
      measure(made, frame, on.pen);

      const density = Math.min(devicePixelRatio || 1, 3);
      // The glass may be scaled; its reach is with it. A displacement of
      // `reach` pulls from half that far (see lens.ts).
      const scale = Math.min(at.width, at.height) / Math.min(shape.width, shape.height);
      const pulled = (reach * scale) / 2;
      const frost = blur * scale;
      const margin = Math.ceil(pulled * (1 + 0.2 * dispersion)) + 1;
      const tint = getComputedStyle(glass).backgroundColor;
      const from = made.from;
      const key = [
        (at.x - from.x).toFixed(2),
        (at.y - from.y).toFixed(2),
        at.width.toFixed(2),
        at.height.toFixed(2),
        density,
        pulled,
        dispersion,
        frost,
        tint,
        fieldKey,
        made.key,
      ].join("|");
      if (key === last) return;
      last = key;

      // What's under the glass, as the page lays it out: all the content,
      // painted once, or what's under the glass and a margin round it.
      const { gl, pen } = on;
      let under: WebGLTexture;
      let span: [number, number];
      let origin: [number, number];
      let finer = 1;
      const whole = paintWhole(on, made, density);
      if (whole) {
        under = whole.texture;
        span = [whole.across, whole.down];
        origin = [(at.x - from.x) * whole.density, (at.y - from.y) * whole.density];
        finer = whole.density / density;
      } else {
        const across = Math.ceil((at.width + 2 * margin) * density);
        const down = Math.ceil((at.height + 2 * margin) * density);
        const near = new DOMRect(at.x - margin, at.y - margin, at.width + 2 * margin, at.height + 2 * margin);
        if (!paintInto(on, made, on.under, near.x, near.y, density, across, down, near)) return;
        under = on.under;
        span = [across, down];
        origin = [margin * density, margin * density];
      }

      const width = Math.round(at.width * density);
      const height = Math.round(at.height * density);
      if (on.canvas.width < width || on.canvas.height < height) {
        on.canvas.width = Math.max(on.canvas.width, width);
        on.canvas.height = Math.max(on.canvas.height, height);
      }
      // Bent, then frosted across and down, each into a texture the lens's size.
      const sized = `${width}|${height}`;
      let steps = on.drawn.get(sized);
      if (!steps) {
        if (on.drawn.size >= 16) {
          for (const set of on.drawn.values()) for (const each of set) gl.deleteTexture(each);
          on.drawn.clear();
        }
        steps = [texture(gl), texture(gl), texture(gl)];
        for (const each of steps) {
          gl.bindTexture(gl.TEXTURE_2D, each);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }
        on.drawn.set(sized, steps);
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, pull(on));
      gl.activeTexture(gl.TEXTURE0);
      gl.viewport(0, 0, width, height);
      gl.scissor(0, 0, width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, on.frame);
      let seen = under;
      const into = (step: Step, target: WebGLTexture) => {
        gl.useProgram(step.program);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
        gl.bindTexture(gl.TEXTURE_2D, seen);
        seen = target;
        return step.at;
      };
      const bent = into(on.bend, steps[0]);
      gl.uniform2f(bent.size!, width, height);
      gl.uniform2f(bent.window!, ...span);
      gl.uniform2f(bent.origin!, ...origin);
      gl.uniform1f(bent.scale!, finer);
      gl.uniform1f(bent.reach!, pulled * density);
      gl.uniform1f(bent.split!, dispersion);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const deviation = frost * density;
      if (deviation >= 0.2) {
        gl.uniform2f(into(on.soften, steps[1]).stride!, deviation / width, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.uniform2f(into(on.soften, steps[2]).stride!, 0, deviation / height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(on.finish.program);
      gl.bindTexture(gl.TEXTURE_2D, seen);
      gl.uniform1f(on.finish.at.saturation!, 1.5);
      gl.uniform4f(on.finish.at.tint!, ...parse(pen, tint));
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      } else to.clearRect(0, 0, width, height);
      // The stage draws from its bottom left.
      to.drawImage(on.canvas, 0, on.canvas.height - height, width, height, 0, 0, width, height);
    },
  };

  const lens: Lens = {
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) {
        read();
        glass.prepend(layer);
        glass.setAttribute("data-drawn", "");
        made.lenses.add(drawn);
        lenses.add(drawn);
        ticking ||= requestAnimationFrame(tick);
      } else {
        layer.remove();
        glass.removeAttribute("data-drawn");
        made.lenses.delete(drawn);
        lenses.delete(drawn);
      }
    },
    update() {},
    refit() {
      if (active) read();
    },
    destroy() {
      lens.setActive(false);
      if (field && fieldOf && fieldOf === shared) fieldOf.gl.deleteTexture(field);
      field = null;
      if (made.lenses.size) return;
      made.stop();
      scenes.delete(content);
    },
  };
  return lens;
}
