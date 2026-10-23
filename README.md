# liquidglass

Liquid Glass controls for React: a button, tab bar, search field, switch, slider and menu that press, stretch and settle on springs.

No dependencies beyond React 18. About 6 kB gzipped for all six, and each one tree-shakes on its own.

[Live demo](https://kelvinzhang.com/playground/liquid-glass)

## Install

```bash
npm install liquidglass
```

Import the stylesheet once, then use the components anywhere.

```tsx
import "liquidglass/styles.css";
import { Switch } from "liquidglass";

function Settings() {
  return <Switch aria-label="Wi-Fi" defaultChecked />;
}
```

Every stateful component works controlled (`value` + `onValueChange`, or `checked` + `onCheckedChange`) or uncontrolled (`defaultValue`, `defaultChecked`).

## Button

```tsx
<Button icon={<ShareIcon />} aria-label="Share" />
<Button>Continue</Button>
```

An icon on its own makes a 40px circle. It accepts every `<button>` prop.

| Prop   | Type        | Default |
| ------ | ----------- | ------- |
| `icon` | `ReactNode` |         |

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

`TabBarItem` is `{ value: string; label: ReactNode; href?: string }`. Set the tab size with `--lg-tab-width` (84px) and `--lg-tab-height` (32px).

## SearchField

```tsx
<SearchField aria-label="Search" value={query} onValueChange={setQuery} />
```

Includes a clear button that keeps focus in the field. Other props go to the `<input>`.

| Prop            | Type                      | Default    |
| --------------- | ------------------------- | ---------- |
| `value`         | `string`                  |            |
| `defaultValue`  | `string`                  | `""`       |
| `onValueChange` | `(value: string) => void` |            |
| `placeholder`   | `string`                  | `"Search"` |

## Switch

```tsx
<Switch aria-label="Wi-Fi" checked={on} onCheckedChange={setOn} />
<Switch aria-label="Bluetooth" size="lg" />
```

Hold the thumb and it lifts into clear glass. Drag it across, or past either end to feel it resist.

| Prop              | Type                         | Default |
| ----------------- | ---------------------------- | ------- |
| `checked`         | `boolean`                    |         |
| `defaultChecked`  | `boolean`                    | `false` |
| `onCheckedChange` | `(checked: boolean) => void` |         |
| `size`            | `"sm" \| "md" \| "lg"`       | `"sm"`  |

The tracks are 60, 80 and 100px wide.

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

Press and drag across the rows: one highlight follows the pointer, and releasing chooses. Escape closes, and arrow keys move between items.

| Prop         | Type                 | Default    |
| ------------ | -------------------- | ---------- |
| `items`      | `MenuEntry[]`        |            |
| `aria-label` | `string`             |            |
| `icon`       | `ReactNode`          | ellipsis   |
| `align`      | `"start" \| "end"`   | `"end"`    |

`MenuEntry` is `"separator"` or `{ label: ReactNode; icon?: ReactNode; onSelect?: () => void; destructive?: boolean; disabled?: boolean }`.

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
| `--lg-fill`         | Slider fill                        |
| `--lg-track`        | Switch and slider tracks           |
| `--lg-destructive`  | Destructive menu items             |

## Refraction

Glass is blurred by default. In Chromium browsers it can refract the backdrop through a curved rim as well. This lives in a separate entry, so it costs nothing unless you import it.

```tsx
import { enableRefraction } from "liquidglass/refraction";

enableRefraction();
```

Call it once on the client before the controls render. Other browsers keep the blur.

## Acknowledgements

Geometry and springs follow [Kube's study of Liquid Glass](https://kube.io/blog/liquid-glass-css-svg/).

## License

MIT
