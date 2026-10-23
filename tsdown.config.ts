import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/refraction.ts"],
  format: ["esm", "cjs"],
  platform: "neutral",
  dts: true,
  hash: false,
  banner: ({ fileName }) => (/^index\.c?js$/.test(fileName) ? '"use client";' : undefined),
  copy: [{ from: "src/styles.css", to: "dist" }],
});
