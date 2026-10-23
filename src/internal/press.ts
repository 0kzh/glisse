import { useEffect, type RefObject } from "react";

import { createSpring } from "./spring";

const PRESS = [417.6, 29.2] as const;
const RELEASE = [230, 23.7] as const;

export function usePress(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const value = [1, 1, 0, 0];
    const paint = () => {
      el.style.scale = `${value[0]} ${value[1]}`;
      el.style.translate = `${value[2]}px ${value[3]}px`;
    };
    const springs = value.map((initial, i) =>
      createSpring(initial, ...RELEASE, (next) => {
        value[i] = next;
        paint();
      }),
    );

    let pointer: { id: number; x: number; y: number; box: DOMRect } | null = null;

    const target = (next: number[], [stiffness, damping]: readonly [number, number]) => {
      springs.forEach((spring, i) => {
        spring.tune(stiffness, damping);
        spring.set(next[i] ?? 0);
      });
    };

    const track = (event: PointerEvent) => {
      if (!pointer) return;
      const { box } = pointer;
      el.style.setProperty("--lg-x", `${((event.clientX - box.left) / box.width) * 100}%`);
      el.style.setProperty("--lg-y", `${((event.clientY - box.top) / box.height) * 100}%`);

      const { width, height } = box;
      const base = 1 + 6 / Math.max(width, height);
      const aspect = width / height;
      const dx = (event.clientX - pointer.x) / aspect;
      const dy = event.clientY - pointer.y;
      const length = Math.hypot(dx, dy);
      if (!length) return target([base, base, 0, 0], PRESS);

      const nx = dx / length;
      const ny = dy / length;
      const rubber = 1 - 1 / (1 + length / height / (5 * aspect));
      const stretch = 1 + (6 / height) * rubber * Math.abs(Math.abs(nx) - Math.abs(ny));
      const horizontal = Math.abs(nx) > Math.abs(ny);
      target(
        [
          base * (horizontal ? stretch : 1 / stretch),
          base * (horizontal ? 1 / stretch : stretch),
          nx * 8 * rubber,
          ny * 8 * rubber,
        ],
        PRESS,
      );
    };

    const move = (event: PointerEvent) => {
      if (event.pointerId === pointer?.id) track(event);
    };

    const end = (event?: PointerEvent) => {
      if (event && event.pointerId !== pointer?.id) return;
      pointer = null;
      delete el.dataset.pressed;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      target([1, 1, 0, 0], RELEASE);
    };

    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || pointer || el.matches(":disabled")) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, box: el.getBoundingClientRect() };
      el.dataset.pressed = "";
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      track(event);
    };

    const reset = () => end();

    el.addEventListener("pointerdown", down);
    window.addEventListener("blur", reset);
    return () => {
      end();
      springs.forEach((spring) => spring.stop());
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("blur", reset);
      el.style.removeProperty("scale");
      el.style.removeProperty("translate");
    };
  }, [ref]);
}
