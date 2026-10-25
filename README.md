https://github.com/user-attachments/assets/84db5ea8-4267-4d70-8d6d-2004fbf8303c

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
