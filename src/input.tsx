import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ForwardRefExoticComponent,
  type InputHTMLAttributes,
  type ReactNode,
  type RefAttributes,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { useRefraction } from "./internal/refraction";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Shown before the text, such as a person or envelope glyph. */
  icon?: ReactNode;
}

export const Input: ForwardRefExoticComponent<InputProps & RefAttributes<HTMLInputElement>> = /* @__PURE__ */ forwardRef<
  HTMLInputElement,
  InputProps
>(function Input({ value: valueProp, defaultValue = "", onValueChange, icon, className, style, ...props }, forwardedRef) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useControllable(valueProp, defaultValue, onValueChange);
  useImperativeHandle(forwardedRef, () => inputRef.current!);
  useRefraction(rootRef);

  return (
    <div ref={rootRef} className={cx("lg-glass lg-input", className)} style={style} onPointerDown={() => inputRef.current?.focus()}>
      {icon == null ? null : <span className="lg-input-icon">{icon}</span>}
      <input ref={inputRef} value={value} onChange={(event) => setValue(event.currentTarget.value)} {...props} />
    </div>
  );
});
