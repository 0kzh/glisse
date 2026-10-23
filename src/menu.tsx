import { useEffect, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";

import { Button } from "./button";
import { cx } from "./internal/cx";
import { createSpring } from "./internal/spring";

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export type MenuEntry = MenuItem | "separator";

export interface MenuProps {
  items: MenuEntry[];
  /** Names the trigger and the menu for assistive technology. */
  "aria-label": string;
  /** The trigger's icon. Defaults to an ellipsis. */
  icon?: ReactNode;
  /** The trigger edge the menu lines up with as it opens across it. */
  align?: "start" | "end";
  className?: string;
  style?: CSSProperties;
}

type Phase = "closed" | "entering" | "open" | "leaving";

const resistance = (value: number) => Math.sign(value) * 7 * (1 - Math.exp((-Math.abs(value) * 0.12) / 7));

const ellipsis = (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <circle cx="3" cy="8" r="1.4" />
    <circle cx="8" cy="8" r="1.4" />
    <circle cx="13" cy="8" r="1.4" />
  </svg>
);

export function Menu({ items, "aria-label": label, icon = ellipsis, align = "end", className, style }: MenuProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>("closed");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLSpanElement>(null);
  const latest = useRef(items);
  const mounted = phase !== "closed";

  useEffect(() => {
    latest.current = items;
  });

  useEffect(() => {
    if (phase === "entering") {
      const frame = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(frame);
    }
    if (phase === "leaving") {
      const timer = setTimeout(() => setPhase("closed"), 140);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useEffect(() => {
    if (!mounted) return;
    const card = cardRef.current!;
    const plate = plateRef.current!;
    const rows = () => [...card.querySelectorAll<HTMLButtonElement>(".lg-menu-item:not(:disabled)")];
    rows()[0]?.focus({ preventScroll: true });

    const offset = { scale: 1, x: 0, y: 0 };
    const paint = () => {
      card.style.scale = String(offset.scale);
      card.style.translate = `${offset.x}px ${offset.y}px`;
    };
    const scale = createSpring(1, 650, 36, (value) => {
      offset.scale = value;
      paint();
    });
    const x = createSpring(0, 600, 30, (value) => {
      offset.x = value;
      paint();
    });
    const y = createSpring(0, 600, 30, (value) => {
      offset.y = value;
      paint();
    });

    let gesture: { id: number; x: number; y: number; row: HTMLButtonElement | null } | null = null;
    let suppressClickUntil = 0;

    const close = (restoreFocus = true) => {
      setPhase("leaving");
      if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
    };

    const highlight = (row: HTMLButtonElement | null) => {
      if (!gesture || gesture.row === row) return;
      const first = !gesture.row;
      gesture.row = row;
      if (!row) {
        delete card.dataset.scrubbing;
        plate.style.opacity = "0";
        return;
      }
      card.dataset.scrubbing = "";
      plate.style.width = `${row.offsetWidth}px`;
      plate.style.height = `${row.offsetHeight}px`;
      if (first) plate.style.transition = "none";
      plate.style.transform = `translate(${row.offsetLeft}px, ${row.offsetTop}px)`;
      if (first) {
        void plate.offsetWidth;
        plate.style.transition = "";
      }
      plate.style.opacity = "1";
    };

    const rowAt = (clientX: number, clientY: number) => {
      const row = document.elementFromPoint(clientX, clientY)?.closest<HTMLButtonElement>(".lg-menu-item");
      return row && !row.disabled && card.contains(row) ? row : null;
    };

    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, row: null };
      card.setPointerCapture(event.pointerId);
      card.dataset.pressed = "";
      scale.set(1 + 5 / Math.max(card.offsetWidth, card.offsetHeight, 200));
      highlight(rowAt(event.clientX, event.clientY));
    };

    const move = (event: PointerEvent) => {
      if (event.pointerId !== gesture?.id) return;
      highlight(rowAt(event.clientX, event.clientY));
      x.set(resistance(event.clientX - gesture.x), true);
      y.set(resistance(event.clientY - gesture.y), true);
    };

    const end = (event: PointerEvent) => {
      if (event.pointerId !== gesture?.id) return;
      const chosen = event.type === "pointerup" ? rowAt(event.clientX, event.clientY) : null;
      highlight(null);
      gesture = null;
      delete card.dataset.pressed;
      scale.set(1);
      x.set(0);
      y.set(0);
      suppressClickUntil = performance.now() + 500;
      chosen?.click();
    };

    const click = (event: MouseEvent) => {
      const row = (event.target as Element).closest<HTMLButtonElement>(".lg-menu-item");
      if (!row || (event.detail !== 0 && performance.now() < suppressClickUntil)) return;
      const item = latest.current[Number(row.dataset.index)];
      if (!item || item === "separator") return;
      close();
      item.onSelect?.();
    };

    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        close(false);
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const list = rows();
        const index = list.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? list.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
        list[next]?.focus();
      }
    };

    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!card.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };

    card.addEventListener("pointerdown", down);
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
    card.addEventListener("lostpointercapture", end);
    card.addEventListener("click", click);
    card.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside, true);
    return () => {
      [scale, x, y].forEach((spring) => spring.stop());
      card.removeEventListener("pointerdown", down);
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerup", end);
      card.removeEventListener("pointercancel", end);
      card.removeEventListener("lostpointercapture", end);
      card.removeEventListener("click", click);
      card.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [mounted]);

  const open = phase === "entering" || phase === "open";

  return (
    <div className={cx("lg-menu", className)} style={style}>
      <Button
        ref={triggerRef}
        icon={icon}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setPhase(open ? "leaving" : "entering")}
      />
      {mounted ? (
        <div ref={cardRef} role="menu" aria-label={label} className="lg-menu-card" data-phase={phase} data-align={align}>
          <span ref={plateRef} className="lg-menu-plate" aria-hidden />
          {items.map((item, index) =>
            item === "separator" ? (
              <div key={index} role="separator" className="lg-menu-separator" />
            ) : (
              <button
                key={index}
                type="button"
                role="menuitem"
                className="lg-menu-item"
                data-index={index}
                data-destructive={item.destructive ? "" : undefined}
                disabled={item.disabled}
              >
                {item.icon}
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
