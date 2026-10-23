import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ButtonHTMLAttributes,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { createSpring, type Spring } from "./internal/spring";

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "defaultValue" | "defaultChecked" | "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Track width: 60, 80 or 100px. */
  size?: "sm" | "md" | "lg";
}

const SCALE = { sm: 0.375, md: 0.5, lg: 0.625 } as const;
const unit = (value: number) => Math.min(1, Math.max(0, value));

export const Switch: ForwardRefExoticComponent<SwitchProps & RefAttributes<HTMLButtonElement>> = /* @__PURE__ */ forwardRef<
  HTMLButtonElement,
  SwitchProps
>(function Switch(
  { checked: checkedProp, defaultChecked = false, onCheckedChange, size = "sm", className, ...props },
  forwardedRef,
) {
  const ref = useRef<HTMLButtonElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const faceRef = useRef<HTMLSpanElement>(null);
  const [checked, setChecked] = useControllable(checkedProp, defaultChecked, onCheckedChange);
  const travel = 57.9 * SCALE[size];
  const latest = useRef({ checked, setChecked, travel });
  const springs = useRef<{ position: Spring; color: Spring } | null>(null);
  useImperativeHandle(forwardedRef, () => ref.current!);

  useEffect(() => {
    latest.current = { checked, setChecked, travel };
    springs.current?.position.set(checked ? 1 : 0);
    springs.current?.color.set(checked ? 1 : 0);
  }, [checked, setChecked, travel]);

  useEffect(() => {
    springs.current?.position.paint();
  }, [travel]);

  useEffect(() => {
    const el = ref.current!;
    const fill = fillRef.current!;
    const thumb = thumbRef.current!;
    const face = faceRef.current!;
    let x = 0;
    let scale = 0.65;
    const paint = () => {
      thumb.style.transform = `translate(${x}px, -50%) scale(${scale})`;
    };

    const initial = latest.current.checked ? 1 : 0;
    const position = createSpring(initial, 1000, 80, (value) => {
      x = value * latest.current.travel;
      paint();
    });
    const color = createSpring(initial, 1000, 80, (value) => {
      fill.style.opacity = String(unit(value));
    });
    const lift = createSpring(0, 2000, 80, (value) => {
      scale = 0.65 + 0.25 * value;
      face.style.opacity = String(1 - 0.85 * unit(value));
      paint();
    });
    springs.current = { position, color };
    position.paint();
    color.paint();
    lift.paint();

    let gesture: { id: number; x: number; y: number; from: number; moved: boolean } | null = null;
    let ignoreClick = false;

    const sync = () => {
      position.set(latest.current.checked ? 1 : 0);
      color.set(latest.current.checked ? 1 : 0);
    };

    const settle = (next?: boolean) => {
      const old = gesture;
      gesture = null;
      lift.set(0);
      if (old && el.hasPointerCapture(old.id)) el.releasePointerCapture(old.id);
      if (next === undefined || next === latest.current.checked) return sync();
      latest.current.setChecked(next);
      requestAnimationFrame(sync);
    };

    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || el.disabled) return;
      event.preventDefault();
      ignoreClick = false;
      gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        from: latest.current.checked ? 1 : 0,
        moved: false,
      };
      el.setPointerCapture(event.pointerId);
      lift.set(1);
    };

    const move = (event: PointerEvent) => {
      if (event.pointerId !== gesture?.id) return;
      const dx = event.clientX - gesture.x;
      const dy = Math.abs(event.clientY - gesture.y);
      if (dy > 10 && dy > Math.abs(dx) + 4) {
        ignoreClick = true;
        return settle();
      }
      if (!gesture.moved && Math.abs(dx) < 4) return;
      gesture.moved = true;
      const value = gesture.from + dx / latest.current.travel;
      const overshoot = value < 0 ? value : value > 1 ? value - 1 : 0;
      position.set(unit(value) + overshoot / 22);
      color.set(value > 0.5 ? 1 : 0);
    };

    const up = (event: PointerEvent) => {
      if (event.pointerId !== gesture?.id) return;
      ignoreClick = true;
      const value = gesture.from + (event.clientX - gesture.x) / latest.current.travel;
      settle(gesture.moved ? value > 0.5 : !latest.current.checked);
    };

    const cancel = () => {
      if (!gesture) return;
      ignoreClick = true;
      settle();
    };

    const click = () => {
      if (ignoreClick) ignoreClick = false;
      else if (!el.disabled) latest.current.setChecked(!latest.current.checked);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("lostpointercapture", cancel);
    el.addEventListener("click", click);
    return () => {
      springs.current = null;
      [position, color, lift].forEach((spring) => spring.stop());
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      el.removeEventListener("lostpointercapture", cancel);
      el.removeEventListener("click", click);
    };
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-size={size}
      className={cx("lg-switch", className)}
      {...props}
    >
      <span ref={fillRef} className="lg-switch-fill" aria-hidden />
      <span ref={thumbRef} className="lg-switch-thumb" aria-hidden>
        <span ref={faceRef} className="lg-thumb-face" />
      </span>
    </button>
  );
});
