---
name: glisse
description: >-
  Build Liquid Glass / iOS 26-style glass UI on the web with glisse (React
  components: Glass, Button, Switch, Slider, TabBar, SegmentedControl, Menu,
  Input, SearchField). Use when a project depends on glisse, imports from
  "glisse", or the user asks for Apple Liquid Glass, frosted glass controls,
  or iOS 26 glass on the web.
---

# glisse

React library that recreates Apple's Liquid Glass for the web. Package name
`glisse`. Peer deps: `react` and `react-dom` `>=18`. Live docs:
https://glisse.kelvinzhang.ca

## Install

```bash
npm install glisse
```

Import components from `"glisse"`. Styles are injected automatically on import
(no separate CSS import required). Optional export: `glisse/styles.css`.

```tsx
import { Button, Switch } from "glisse";

function Settings() {
  return (
    <div>
      <Switch aria-label="Wi-Fi" defaultChecked />
      <Button variant="filled">Continue</Button>
    </div>
  );
}
```

In Next.js / RSC apps, use these components from Client Components (`"use
client"`): they touch `document` / `window` for lenses and style injection.

## Public API

Exports from `"glisse"`:

| Export | Role |
| --- | --- |
| `Glass` | Glass surface (`div`); spreads `HTMLAttributes<HTMLDivElement>` |
| `Button` | Glass / filled button |
| `Switch` | Toggle (`role="switch"`) |
| `Slider` | Range control |
| `Input` | Glass text field |
| `SearchField` | `Input` preset: search type, magnifier, "Search" placeholder, clear |
| `SegmentedControl` | Exclusive segments with lifting lens |
| `TabBar` | Tab row / nav bar with lifting lens |
| `Menu` | Ellipsis trigger that morphs into a glass menu |

Types: `ButtonProps`, `GlassProps`, `InputProps`, `MenuProps`, `MenuItem`,
`MenuEntry`, `SearchFieldProps`, `SegmentedControlProps`,
`SegmentedControlItem`, `SliderProps`, `SwitchProps`, `TabBarProps`,
`TabBarItem`.

## Components

### `Glass`

```tsx
<Glass className="card">…</Glass>
```

### `Button`

- `variant?: "glass" | "filled"` (default `"glass"`)
- `destructive?: boolean` — red tint shorthand
- `tint?: string` — any CSS colour (label on glass, fill on filled)
- `icon?: ReactNode` — alone → round icon button; give an `aria-label`

```tsx
<Button variant="filled">Continue</Button>
<Button icon={<Icon />} aria-label="Share" />
<Button variant="filled" destructive>Delete</Button>
<Button variant="filled" tint="#ff8d28">Order</Button>
```

### `Switch` / `Slider`

Controlled via `checked` / `value` + `onCheckedChange` / `onValueChange`
(not native `onChange`). Also support `defaultChecked` / `defaultValue`.

```tsx
<Switch aria-label="Wi-Fi" checked={on} onCheckedChange={setOn} />
<Slider value={volume} min={0} max={100} step={1} onValueChange={setVolume} />
```

### `Input` / `SearchField`

```tsx
<Input icon={<Icon />} value={q} onValueChange={setQ} placeholder="Name" />
<SearchField value={q} onValueChange={setQ} />
```

`SearchField` is `Input` with `type="search"`, default magnifier icon, and
placeholder `"Search"`. A clear button appears when there is a value.

### `SegmentedControl` / `TabBar`

```tsx
<SegmentedControl
  aria-label="View"
  items={[
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
  ]}
  value={view}
  onValueChange={setView}
/>

<TabBar
  aria-label="Sections"
  items={[
    { value: "home", label: "Home", icon: <HomeIcon /> },
    { value: "search", label: "Search", href: "/search" },
  ]}
  value={tab}
  onValueChange={setTab}
  link={Link} // e.g. Next.js Link for items with href
/>
```

`value` / `defaultValue` may be `string | null`. Tabs with `href` become
links; pass `link` for a custom link component.

### `Menu`

Requires `aria-label`. Entries are `MenuItem` or `"separator"`.

```tsx
<Menu
  aria-label="More"
  align="end"
  items={[
    { label: "Duplicate", onSelect: duplicate },
    "separator",
    { label: "Delete", destructive: true, onSelect: remove },
  ]}
/>
```

## Theme and CSS variables

Light defaults on `:root` / `[data-theme="light"]`. Dark via
`[data-theme="dark"]` or `prefers-color-scheme: dark` when root is not forced
light. App CSS wins over injected glisse styles (styles are prepended to
`<head>`).

Useful overrides on a glass node or ancestor:

| Variable | Effect |
| --- | --- |
| `--lg-glass-bend` | Glass backdrop bend strength |
| `--lg-glass-dispersion` | Glass colour split |
| `--lg-rim-shine` | Rim highlight strength |
| `--lg-switch-bend` / `--lg-slider-bend` | Thumb lens strength |
| `--lg-tab-bend` / `--lg-tab-dispersion` | Tab bar lens |
| `--lg-segment-bend` | Segmented control lens |
| `--lg-fill` / `--lg-on` / `--lg-destructive` | Accent / on / destructive colours |

## Browser support and refraction

- **Frost + lit rim:** all modern browsers (`backdrop-filter`).
- **Live backdrop bend** (SVG filter on `backdrop-filter`): **Chromium only**.
- **Cross-browser bend:** mark content with `data-glisse-backdrop`. Closest
  overlapping marked sibling/ancestor content is filtered under the glass in
  every browser.

```tsx
<div className="scene">
  <img data-glisse-backdrop src={wallpaper} alt="" />
  <Glass>Controls</Glass>
</div>
```

Without a marked backdrop on non-Chromium browsers, glass keeps blur/frost
and rim lighting but does not refract the live page.

## Do / don't

- **Do** import from `"glisse"`; styles ship with the import.
- **Do** mark photographic / rich backdrops with `data-glisse-backdrop` when
  you need refraction outside Chromium.
- **Do** give icon-only `Button`s and `Menu` an `aria-label`.
- **Do** use `onCheckedChange` / `onValueChange` for Switch, Slider, Input,
  TabBar, and SegmentedControl.
- **Don't** invent props or components not listed above.
- **Don't** expect Safari/Firefox to bend the *live* backdrop without
  `data-glisse-backdrop`.
- **Don't** put a large, frequently filtered backdrop under a *moving* lens
  in Safari: redrawing the filter is CPU-heavy (~tens of ms per frame for a
  ~1200×800@2x surface). Prefer small marked content for moving thumbs/lenses.
- **Don't** import internal modules (`glisse/internal/...`); only the public
  exports are supported.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No glass look / missing CSS | Ensure you import from `"glisse"` in a browser bundle (not SSR-only). |
| No refraction in Safari/Firefox | Add `data-glisse-backdrop` on the content behind the glass. |
| Refraction only in Chrome | Expected for unmarked live backdrop; mark backdrop for parity. |
| Janky moving Switch/Slider/TabBar in Safari | Shrink the marked backdrop the lens filters. |
| Dark theme wrong | Set `data-theme="dark"` or `"light"` on an ancestor, or rely on system preference. |
| Icon button not round / unlabeled | Pass `icon` without children and set `aria-label`. |
| Next.js / RSC error about `document` | Render glisse components inside a Client Component. |

For live examples of every component: https://glisse.kelvinzhang.ca
