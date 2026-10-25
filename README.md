![Glisse](https://glisse.kelvinzhang.ca/og.png?v=3)

[Glisse](https://glisse.kelvinzhang.ca) is a faithful implementation of Apple's Liquid Glass for the web.

## Usage

To start using the library, install it in your project:

```bash
npm install glisse
```

Then use the components anywhere. Their styles come with them.

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

## Documentation

See every component, with live examples and code, at [glisse.kelvinzhang.ca](https://glisse.kelvinzhang.ca).

## License

MIT
