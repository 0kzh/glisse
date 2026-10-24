import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type ReactNode,
  type RefAttributes,
} from "react";

import { cx } from "./internal/cx";
import { refractsBackdrop, useRefraction } from "./internal/refraction";

export interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * A copy of what sits behind the glass, laid out to fill the glass's
   * positioned parent. Safari and Firefox can't refract the live page, so they
   * refract this copy instead; Chromium ignores it.
   */
  backdrop?: ReactNode;
}

const useIsomorphicLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

// Keeps the copy lined up with what it copies as the glass moves, scrolls or
// scales: each frame, it's placed where the parent's box falls inside the glass.
function useAlignment(glass: HTMLElement | null, content: HTMLElement | null): void {
  useIsomorphicLayoutEffect(() => {
    if (!glass || !content) return;
    let frame = 0;
    let last = "";
    const align = () => {
      frame = requestAnimationFrame(align);
      const parent = glass.offsetParent as HTMLElement | null;
      if (!parent || !glass.offsetWidth || !glass.offsetHeight) return;
      const box = glass.getBoundingClientRect();
      const frame0 = parent.getBoundingClientRect();
      const sx = box.width / glass.offsetWidth;
      const sy = box.height / glass.offsetHeight;
      const x = (frame0.left + parent.clientLeft - box.left) / sx;
      const y = (frame0.top + parent.clientTop - box.top) / sy;
      const next = `${parent.clientWidth}|${parent.clientHeight}|translate(${x}px, ${y}px) scale(${1 / sx}, ${1 / sy})`;
      if (next === last) return;
      last = next;
      content.style.width = `${parent.clientWidth}px`;
      content.style.height = `${parent.clientHeight}px`;
      content.style.transform = `translate(${x}px, ${y}px) scale(${1 / sx}, ${1 / sy})`;
    };
    align();
    return () => cancelAnimationFrame(frame);
  }, [glass, content]);
}

export const Glass: ForwardRefExoticComponent<GlassProps & RefAttributes<HTMLDivElement>> = /* @__PURE__ */ forwardRef<
  HTMLDivElement,
  GlassProps
>(function Glass({ backdrop, className, children, ...props }, forwardedRef) {
  const ref = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  // Decided after mount, so the server and the first client render agree.
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(backdrop != null && !refractsBackdrop()), [backdrop != null]);
  useImperativeHandle(forwardedRef, () => ref.current!);
  useRefraction(ref, false, copied);
  useAlignment(copied ? ref.current : null, content);

  return (
    <div ref={ref} className={cx("lg-glass", className)} data-copy={copied ? "" : undefined} {...props}>
      {copied ? (
        <>
          <div className="lg-glass-copy" aria-hidden ref={(node) => {
              node?.setAttribute("inert", "");
            }}>
            <div ref={setContent}>{backdrop}</div>
          </div>
          <span className="lg-glass-skin" aria-hidden />
        </>
      ) : null}
      {children}
    </div>
  );
});
