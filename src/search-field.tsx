import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ForwardRefExoticComponent,
  type InputHTMLAttributes,
  type RefAttributes,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { useRefraction } from "./internal/refraction";

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export const SearchField: ForwardRefExoticComponent<SearchFieldProps & RefAttributes<HTMLInputElement>> = /* @__PURE__ */ forwardRef<
  HTMLInputElement,
  SearchFieldProps
>(function SearchField(
  { value: valueProp, defaultValue = "", onValueChange, placeholder = "Search", className, style, ...props },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useControllable(valueProp, defaultValue, onValueChange);
  useImperativeHandle(forwardedRef, () => inputRef.current!);
  useRefraction(rootRef);

  return (
    <div ref={rootRef} role="search" className={cx("lg-glass lg-search", className)} style={style}>
      <svg className="lg-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
        <circle cx="7" cy="7" r="4.75" />
        <path d="m10.5 10.5 3.25 3.25" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.currentTarget.value)}
        {...props}
      />
      {value && !props.disabled ? (
        <button
          type="button"
          className="lg-search-clear"
          aria-label="Clear"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
            <path d="m4.5 4.5 7 7m0-7-7 7" />
          </svg>
        </button>
      ) : null}
    </div>
  );
});
