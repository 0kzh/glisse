#!/usr/bin/env bash
# Bundle the web parity harness into GlassRef/Web/ (loaded by the WKWebView tab).
set -e
cd "$(dirname "$0")"
npx esbuild web/app.tsx --bundle --jsx=automatic --outfile=GlassRef/Web/app.js
cp ../../src/styles.css GlassRef/Web/styles.css
cp web/index.html web/street.jpg web/tahoe-light.webp web/tahoe-dark.webp GlassRef/Web/
