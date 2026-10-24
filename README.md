# Glisse

Glisse is a set of Liquid Glass controls for React: a button, tab bar, input, search field, switch, slider and menu that press, stretch and settle on springs, and refract what's behind them in Chromium.

No dependencies beyond React 18. Each component tree-shakes on its own.

[Live demo](https://kelvinzhang.com/playground/liquid-glass)

## Install

```bash
npm install glisse
```

Use the components anywhere. Their styles come with them.

```tsx
import { Switch } from "glisse";

function Settings() {
  return <Switch aria-label="Wi-Fi" defaultChecked />;
}
```

Every stateful component works controlled (`value` + `onValueChange`, or `checked` + `onCheckedChange`) or uncontrolled (`defaultValue`, `defaultChecked`).

## Button

```tsx
<Button icon={<ShareIcon />} aria-label="Share" />
<Button>Cancel</Button>
<Button variant="filled">Continue</Button>
<Button variant="filled" destructive>Delete</Button>
<Button tint="#ff8d28">Order</Button>
```

An icon on its own makes a 40px circle. Use `filled` for the one primary action in a view; it fills with `--lg-fill`. `tint` colours a glass button's label or a filled button's fill, as `.tint()` does on iOS, and `destructive` is a red tint. It accepts every `<button>` prop.

| Prop          | Type                     | Default   |
| ------------- | ------------------------ | --------- |
| `icon`        | `ReactNode`              |           |
| `variant`     | `"glass" \| "filled"`    | `"glass"` |
| `destructive` | `boolean`                | `false`   |
| `tint`        | `string`                 |           |

## TabBar

```tsx
const [range, setRange] = useState("week");

<TabBar
  aria-label="Range"
  items={[
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ]}
  value={range}
  onValueChange={setRange}
/>
```

Press a tab and the selection lifts off the bar. Drag it to another tab and let go to select. Arrow keys, Home and End move between tabs.

Give items an `href` to render links instead, and pass your router's link component:

```tsx
import Link from "next/link";

<TabBar
  aria-label="Main"
  link={Link}
  value={pathname}
  items={[
    { value: "/", label: "Home", href: "/" },
    { value: "/blog", label: "Blog", href: "/blog" },
  ]}
/>
```

| Prop            | Type                      | Default |
| --------------- | ------------------------- | ------- |
| `items`         | `TabBarItem[]`            |         |
| `value`         | `string \| null`          |         |
| `defaultValue`  | `string \| null`          | `null`  |
| `onValueChange` | `(value: string) => void` |         |
| `link`          | `ElementType`             | `"a"`   |

`TabBarItem` is `{ value: string; label: ReactNode; href?: string }`. Set the tab size with `--lg-tab-width` (84px) and `--lg-tab-height` (32px). While a tab is held, the selection grows by `--lg-lens-grow-x` (27px) and `--lg-lens-grow-y` (20px).

## Input

```tsx
<Input aria-label="Name" placeholder="Name" value={name} onValueChange={setName} />
<Input aria-label="Email" type="email" placeholder="Email" icon={<EnvelopeIcon />} />
```

A glass text field. Other props go to the `<input>`; with `type="search"` it gains a clear button.

| Prop            | Type                      | Default |
| --------------- | ------------------------- | ------- |
| `value`         | `string`                  |         |
| `defaultValue`  | `string`                  | `""`    |
| `onValueChange` | `(value: string) => void` |         |
| `icon`          | `ReactNode`               |         |

## SearchField

```tsx
<SearchField aria-label="Search" value={query} onValueChange={setQuery} />
```

An `Input` with `type="search"`, a magnifier icon and a "Search" placeholder. It takes the same props, so you can swap the icon. Typing shows a clear button that keeps focus in the field.

## Switch

```tsx
<Switch aria-label="Wi-Fi" checked={on} onCheckedChange={setOn} />
```

Hold the thumb and it lifts into clear glass. Drag it across, or past either end to feel it resist.

| Prop              | Type                         | Default |
| ----------------- | ---------------------------- | ------- |
| `checked`         | `boolean`                    |         |
| `defaultChecked`  | `boolean`                    | `false` |
| `onCheckedChange` | `(checked: boolean) => void` |         |

The track is 60px wide, as on iOS.

## Slider

```tsx
<Slider aria-label="Volume" value={volume} onValueChange={setVolume} />
```

A native range input sits on top, so keyboard, stepping and assistive technology behave as usual. Other props go to the `<input>`.

| Prop            | Type                      | Default |
| --------------- | ------------------------- | ------- |
| `value`         | `number`                  |         |
| `defaultValue`  | `number`                  | `min`   |
| `onValueChange` | `(value: number) => void` |         |
| `min`           | `number`                  | `0`     |
| `max`           | `number`                  | `100`   |
| `step`          | `number`                  | `1`     |

## Menu

```tsx
<Menu
  aria-label="Options"
  items={[
    { label: "Pin", icon: <PinIcon />, onSelect: pin },
    { label: "Rename", icon: <PencilIcon />, onSelect: rename },
    "separator",
    { label: "Delete", icon: <TrashIcon />, onSelect: remove, destructive: true },
  ]}
/>
```

The menu grows out of its button and shrinks back into it, as on iOS. One highlight glides between the rows as you hover, or press and drag across them and release to choose. Escape closes, and arrow keys move between items.

| Prop         | Type                 | Default    |
| ------------ | -------------------- | ---------- |
| `items`      | `MenuEntry[]`        |            |
| `aria-label` | `string`             |            |
| `icon`       | `ReactNode`          | ellipsis   |
| `align`      | `"start" \| "end"`   | `"end"`    |

`MenuEntry` is `"separator"` or `{ label: ReactNode; icon?: ReactNode; onSelect?: () => void; destructive?: boolean; disabled?: boolean }`.

## Glass

```tsx
<Glass className="card">…</Glass>
```

A plain glass surface for anything else, such as a card. It renders a `<div>` and accepts every prop one does.

| Prop       | Type        | Default |
| ---------- | ----------- | ------- |
| `backdrop` | `ReactNode` |         |

`backdrop` is a copy of what sits behind the glass, laid out to fill the glass's positioned parent. It lets Safari and Firefox refract too: see [Refraction](#refraction).

## Styles

Glisse adds its stylesheet to the page the first time it loads in the browser. It goes at the start of `<head>`, so your own CSS still wins ties.

Import the stylesheet as a file as well when:

- the page is rendered on the server, so glass is styled before any script runs, or
- a Content Security Policy blocks inline styles.

```tsx
import "glisse/styles.css";
```

## Theming

Controls follow the system's light or dark appearance. To pin one, set `data-theme="light"` or `data-theme="dark"` on any ancestor, such as `<html>`.

Colours are CSS variables on `:root`, so you can override any of them:

```css
:root {
  --lg-on: hotpink;
}
```

| Variable            | Used for                           |
| ------------------- | ---------------------------------- |
| `--lg-foreground`   | Text and icons                     |
| `--lg-muted`        | Unselected tabs, placeholders      |
| `--lg-glass`        | Glass surfaces                     |
| `--lg-glass-active` | Hovered, pressed and focused glass |
| `--lg-surface`      | Menu                               |
| `--lg-on`           | Switch when on                     |
| `--lg-fill`         | Slider fill, filled buttons        |
| `--lg-track`        | Switch track                       |
| `--lg-rail`         | Slider track                       |
| `--lg-destructive`  | Destructive buttons and menu items |

## Refraction

In Chromium browsers, glass refracts the backdrop through a curved rim, with nothing to set up. Safari and Firefox can't filter the live backdrop through SVG, so there the glass keeps its blur.

To refract in Safari and Firefox as well, give a `Glass` a copy of what's behind it. Render the same content as `backdrop`, sized to fill the glass's positioned parent, just as the original does. Those browsers then refract the copy, kept lined up with the original as the glass moves, scrolls or scales; Chromium ignores it and keeps refracting the live page.

```tsx
<div style={{ position: "relative" }}>
  <Photo />
  <Glass backdrop={<Photo />} style={{ position: "absolute", left: 40, top: 40, width: 160, height: 160, borderRadius: 80 }} />
</div>
```

Controls over arbitrary page content, such as a navigation bar, can't carry a copy, so they keep the blur there.

The curved rim is `--lg-bezel` wide and the glass `--lg-thickness` deep, both sized from the element by default. A bezel as wide as the radius bends the whole face, like a magnifying glass. `--lg-refraction` (1) scales how far the rim bends.

Two more variables turn glass into a lens. `--lg-zoom` (1) magnifies what's behind it, and `--lg-rim-saturation` (1) saturates the backdrop where it crosses the rim highlight, so strong edges break into colour. For a clear lens, drop the tint and set the frost, `--lg-blur` (3px), to zero.

```tsx
<Glass
  style={{
    width: 210,
    height: 150,
    borderRadius: 75,
    background: "none",
    "--lg-blur": "0px",
    "--lg-bezel": "25px",
    "--lg-thickness": "50px",
    "--lg-zoom": 1.13,
    "--lg-rim-saturation": 9,
  }}
/>
```

## Acknowledgements

Geometry and springs follow [Kube's study of Liquid Glass](https://kube.io/blog/liquid-glass-css-svg/).

## License

MIT
