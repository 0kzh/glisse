import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { transform } from "lightningcss";
import { defineConfig, type UserConfig } from "tsdown";

// Bundles `./styles.css?inline` as a minified string, as Vite does, so the
// components can insert their own styles.
const targets = { safari: 16 << 16, chrome: 111 << 16, firefox: 113 << 16 };

const inlineCss = {
  name: "inline-css",
  resolveId(source: string, importer: string | undefined) {
    if (source.endsWith(".css?inline") && importer) return resolve(dirname(importer), source);
  },
  load(id: string) {
    if (!id.endsWith(".css?inline")) return;
    const file = id.slice(0, -"?inline".length);
    // Naming the browsers keeps -webkit-backdrop-filter, which Safari needed until 18.
    const { code } = transform({ filename: file, code: readFileSync(file), minify: true, targets });
    return `export default ${JSON.stringify(code.toString())};`;
  },
};

const config: UserConfig = defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  platform: "neutral",
  dts: true,
  hash: false,
  plugins: [inlineCss],
  banner: ({ fileName }) => (/^index\.c?js$/.test(fileName) ? '"use client";' : undefined),
  copy: [{ from: "src/styles.css", to: "dist" }],
});

export default config;
