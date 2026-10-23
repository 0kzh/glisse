import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ButtonHTMLAttributes,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from "react";

import { cx } from "./internal/cx";
import { usePress } from "./internal/press";
import { useRefraction } from "./internal/registry";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shown before the label. On its own, the button is a circle; give it an `aria-label`. */
  icon?: ReactNode;
}

export const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>> = /* @__PURE__ */ forwardRef<
  HTMLButtonElement,
  ButtonProps
>(function Button(
  { icon, children, className, type = "button", ...props },
  forwardedRef,
) {
  const ref = useRef<HTMLButtonElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current!);
  usePress(ref);
  useRefraction(ref);

  return (
    <button
      ref={ref}
      type={type}
      className={cx("lg-glass lg-button", className)}
      data-icon={icon == null ? undefined : children == null ? "only" : ""}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});
