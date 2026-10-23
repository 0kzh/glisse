import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type JSX,
  type ReactNode,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { useRefraction } from "./internal/registry";
import { createSpring } from "./internal/spring";

export interface TabBarItem {
  value: string;
  label: ReactNode;
  /** Renders the tab as a link. Clicking it navigates; the bar still tracks selection. */
  href?: string;
}

export interface TabBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  items: TabBarItem[];
  /** The selected tab's `value`, or `null` for none. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  /** The component used for tabs with an `href`, such as Next.js's `Link`. */
  link?: ElementType;
}

interface Parts {
  bar: HTMLElement;
  glass: HTMLElement;
  lens: HTMLElement;
  tint: HTMLElement;
  row: HTMLElement;
}

interface Controller {
  setActive(index: number): void;
  destroy(): void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
const REST = [1024, 58.9, 676, 47.8] as const;
const DRAG = [2500, 94, 576, 44.2] as const;

function attach({ bar, glass, lens, tint, row }: Parts, select: (index: number) => void): Controller {
  const tabs = [...bar.querySelectorAll<HTMLElement>(".lg-tab")];
  let slot = 0;
  let height = 0;
  let active = -1;
  let shown = false;
  let gesture: { id: number; x: number; anchor: number; moved: boolean; box: DOMRect } | null = null;
  const state = { x: 0, lift: 0 };

  const measure = () => {
    const style = getComputedStyle(bar);
    slot = (bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) / tabs.length;
    height = lens.offsetHeight;
  };

  const paint = () => {
    const { x, lift } = state;
    const sx = 1 + (16 / slot) * lift;
    const sy = 1 + (12 / height) * lift;
    lens.style.transform = tint.style.transform = `translateX(${x}px) scale(${sx}, ${sy})`;
    row.style.transform = `scale(${1 / sx}, ${1 / sy}) translate(${-x + ((sx - 1) * slot) / 2}px, ${((sy - 1) * height) / 2}px)`;
    if (!gesture && lift < 0.01) delete bar.dataset.refracting;
  };

  const x = createSpring(0, REST[0], REST[1], (value) => {
    state.x = value;
    paint();
  });
  const lift = createSpring(0, REST[2], REST[3], (value) => {
    state.lift = value;
    paint();
  });

  const move = (target: number, lifted: boolean, instant = false) => {
    const [slideStiffness, slideDamping, liftStiffness, liftDamping] = gesture ? DRAG : REST;
    x.tune(slideStiffness, slideDamping);
    lift.tune(liftStiffness, liftDamping);
    x.set(target, instant);
    lift.set(lifted ? 1 : 0, instant);
  };

  const settle = (instant = false) => {
    if (gesture) return;
    const show = active >= 0;
    if (show) delete bar.dataset.hidden;
    else bar.dataset.hidden = "";
    if (show) move(active * slot, false, instant || !shown);
    shown = show;
  };

  const position = (event: PointerEvent) =>
    clamp(gesture!.anchor + event.clientX - gesture!.x, 0, slot * (tabs.length - 1));

  const light = (event: PointerEvent, box: DOMRect) => {
    glass.style.setProperty("--lg-x", `${clamp(((event.clientX - box.left) / box.width) * 100, 0, 100)}%`);
    lens.style.setProperty("--lg-x", `${clamp(((event.clientX - box.left - 4 - state.x) / slot) * 100, 0, 100)}%`);
  };

  const release = () => {
    const old = gesture;
    gesture = null;
    delete bar.dataset.lifted;
    delete lens.dataset.pressed;
    if (old && bar.hasPointerCapture(old.id)) bar.releasePointerCapture(old.id);
    return old;
  };

  let suppressClick = false;

  const onPointerDown = (event: PointerEvent) => {
    const tab = (event.target as Element).closest<HTMLElement>(".lg-tab");
    if (!event.isPrimary || event.button !== 0 || gesture || !tab) return;
    const box = bar.getBoundingClientRect();
    gesture = { id: event.pointerId, x: event.clientX, anchor: tabs.indexOf(tab) * slot, moved: false, box };
    suppressClick = false;
    bar.dataset.lifted = "";
    bar.dataset.refracting = "";
    delete bar.dataset.hidden;
    lens.dataset.pressed = "";
    light(event, box);
    move(gesture.anchor, true, !shown);
    shown = true;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== gesture?.id) return;
    if (!gesture.moved && Math.abs(event.clientX - gesture.x) > 6) {
      gesture.moved = true;
      bar.setPointerCapture(event.pointerId);
    }
    if (gesture.moved) move(position(event), true);
    light(event, gesture.box);
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== gesture?.id) return;
    const index = Math.round(position(event) / slot);
    const { moved, box } = release()!;
    if (moved) {
      suppressClick = true;
      const inside = event.type === "pointerup" && event.clientY >= box.top - 24 && event.clientY <= box.bottom + 24;
      if (inside) tabs[index]?.click();
    }
    settle();
  };

  const onClick = (event: MouseEvent) => {
    if (event.isTrusted && suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    const tab = (event.target as Element).closest<HTMLElement>(".lg-tab");
    if (!tab || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const index = tabs.indexOf(tab);
    if (tab instanceof HTMLAnchorElement) {
      active = index;
      settle();
    }
    select(index);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const tab = (event.target as Element).closest<HTMLElement>(".lg-tab");
    if (!tab || tab instanceof HTMLAnchorElement || !keys.includes(event.key)) return;
    event.preventDefault();
    const current = tabs.indexOf(tab);
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    select(index);
    tabs[index]?.focus();
  };

  const reset = () => {
    release();
    settle(true);
  };
  const onVisibilityChange = () => {
    if (document.hidden) reset();
  };
  const observer = new ResizeObserver(() => {
    measure();
    if (!gesture) settle(true);
  });

  measure();
  bar.dataset.ready = "";
  bar.addEventListener("pointerdown", onPointerDown);
  bar.addEventListener("pointermove", onPointerMove);
  bar.addEventListener("pointerup", onPointerEnd);
  bar.addEventListener("pointercancel", onPointerEnd);
  bar.addEventListener("lostpointercapture", onPointerEnd);
  bar.addEventListener("click", onClick, true);
  bar.addEventListener("keydown", onKeyDown);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", reset);
  observer.observe(bar);

  return {
    setActive(index) {
      active = index;
      settle();
    },
    destroy() {
      x.stop();
      lift.stop();
      observer.disconnect();
      for (const key of ["ready", "hidden", "lifted", "refracting"]) delete bar.dataset[key];
      bar.removeEventListener("pointerdown", onPointerDown);
      bar.removeEventListener("pointermove", onPointerMove);
      bar.removeEventListener("pointerup", onPointerEnd);
      bar.removeEventListener("pointercancel", onPointerEnd);
      bar.removeEventListener("lostpointercapture", onPointerEnd);
      bar.removeEventListener("click", onClick, true);
      bar.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", reset);
    },
  };
}

export function TabBar({
  items,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  link: Link = "a",
  className,
  style,
  ...props
}: TabBarProps): JSX.Element {
  const barRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLSpanElement>(null);
  const lensRef = useRef<HTMLSpanElement>(null);
  const tintRef = useRef<HTMLSpanElement>(null);
  const rowRef = useRef<HTMLSpanElement>(null);
  const controller = useRef<Controller | null>(null);
  const [value, setValue] = useControllable<string | null, string>(valueProp, defaultValue, onValueChange);
  const selected = items.findIndex((item) => item.value === value);
  const latest = useRef({ items, selected, setValue });
  const signature = items.map((item) => item.value).join("\n");
  const navigation = items.every((item) => item.href !== undefined);

  useRefraction(glassRef);
  useRefraction(lensRef, true);

  useEffect(() => {
    latest.current = { items, selected, setValue };
  });

  useEffect(() => {
    const instance = attach(
      { bar: barRef.current!, glass: glassRef.current!, lens: lensRef.current!, tint: tintRef.current!, row: rowRef.current! },
      (index) => {
        const item = latest.current.items[index];
        if (item) latest.current.setValue(item.value);
      },
    );
    instance.setActive(latest.current.selected);
    controller.current = instance;
    return () => {
      instance.destroy();
      controller.current = null;
    };
  }, [signature]);

  useEffect(() => {
    controller.current?.setActive(selected);
  }, [selected]);

  return (
    <div
      ref={barRef}
      role={navigation ? "navigation" : "tablist"}
      className={cx("lg-tab-bar", className)}
      style={{ ...style, "--lg-index": Math.max(selected, 0), "--lg-tabs": items.length } as CSSProperties}
      {...props}
    >
      <span ref={glassRef} className="lg-glass lg-tab-bar-glass" aria-hidden />
      {items.map((item, index) =>
        item.href !== undefined ? (
          <Link
            key={item.value}
            href={item.href}
            className="lg-tab"
            data-selected={index === selected ? "" : undefined}
            aria-current={index === selected ? "page" : undefined}
            draggable={false}
          >
            {item.label}
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            role="tab"
            className="lg-tab"
            data-selected={index === selected ? "" : undefined}
            aria-selected={index === selected}
            tabIndex={index === selected || (selected < 0 && index === 0) ? 0 : -1}
          >
            {item.label}
          </button>
        ),
      )}
      <span ref={tintRef} className="lg-tab-tint" aria-hidden>
        <span ref={rowRef} className="lg-tab-row">
          {items.map((item) => (
            <span key={item.value} className="lg-tab-copy">
              {item.label}
            </span>
          ))}
        </span>
      </span>
      <span ref={lensRef} className="lg-glass lg-tab-lens" aria-hidden />
    </div>
  );
}
