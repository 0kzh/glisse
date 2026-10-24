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
import { useRefraction } from "./internal/refraction";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shown before the label. On its own, the button is a circle; give it an `aria-label`. */
  icon?: ReactNode;
  /** `glass` is clear; `prominent` fills it with the accent colour, for the primary action. */
  variant?: "glass" | "prominent";
  /** Marks an action that deletes or can't be undone. */
  destructive?: boolean;
}

export const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>> = /* @__PURE__ */ forwardRef<
  HTMLButtonElement,
  ButtonProps
>(function Button(
  { icon, variant = "glass", destructive, children, className, type = "button", ...props },
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
      data-variant={variant === "glass" ? undefined : variant}
      data-destructive={destructive ? "" : undefined}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});
