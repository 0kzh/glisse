import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Button, SearchField, TabBar } from "../../../src/index";

const sharePath =
  "M216,112v96a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V112A16,16,0,0,1,56,96H80a8,8,0,0,1,0,16H56v96H200V112H176a8,8,0,0,1,0-16h24A16,16,0,0,1,216,112ZM93.66,69.66,120,43.31V136a8,8,0,0,0,16,0V43.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,69.66Z";

const tabs = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const ROWS: { css: string; h: number; label?: string }[] = [
  { css: "#000000", h: 84 },
  { css: "#2b2b2b", h: 84 },
  { css: "#808080", h: 84 },
  { css: "#ffffff", h: 84 },
  { css: "#ff0000", h: 84 },
  { css: "#0000ff", h: 84 },
  { css: "linear-gradient(90deg, #000 50%, #fff 50%)", h: 84 },
  { css: "url(street.jpg) center/cover", h: 96 },
  { css: "url(street.jpg) center/cover", h: 96, label: "Week" },
];

function Capsule({ theme, label }: { theme: "light" | "dark"; label?: string }) {
  return (
    <div data-theme={theme} style={{ display: "flex", flex: 1, justifyContent: "center" }}>
      <div
        className="lg-glass"
        style={{
          width: 158,
          height: 54,
          borderRadius: 27,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--lg-foreground)",
          fontSize: 15,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Row({ css, h, label }: { css: string; h: number; label?: string }) {
  return (
    <div style={{ position: "relative", height: h, background: css }}>
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        <Capsule theme="dark" label={label} />
        <Capsule theme="light" label={label} />
      </div>
    </div>
  );
}

function ControlsScene({ scheme }: { scheme: "light" | "dark" }) {
  const [tab, setTab] = useState("week");
  return (
    <div
      data-theme={scheme}
      style={{
        position: "relative",
        height: 300,
        backgroundImage: `url(tahoe-${scheme}.webp)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        overflow: "hidden",
        color: "var(--lg-foreground)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <TabBar aria-label="Range" items={tabs} value={tab} onValueChange={setTab} />
        <div style={{ display: "flex", gap: 16 }}>
          <Button
            icon={
              <svg viewBox="0 0 256 256" fill="currentColor" width={20} height={20}>
                <path d={sharePath} />
              </svg>
            }
            aria-label="Share"
          />
          <Button>Continue</Button>
        </div>
        <SearchField aria-label="Search" style={{ width: 280 }} />
      </div>
    </div>
  );
}

function App() {
  return (
    <div style={{ fontFamily: "-apple-system, system-ui, sans-serif", background: "#000" }}>
      <div style={{ height: 62 }} />
      {ROWS.map((row, i) => (
        <Row key={i} css={row.css} h={row.h} label={row.label} />
      ))}
      <ControlsScene scheme="dark" />
      <ControlsScene scheme="light" />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
