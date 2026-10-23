import { useEffect, type RefObject } from "react";

export type Refract = (element: HTMLElement, selection: boolean) => () => void;

const key = Symbol.for("liquidglass.refraction");
const registry = globalThis as unknown as Record<symbol, Refract | undefined>;

export function register(refract: Refract): void {
  registry[key] = refract;
}

export function useRefraction(ref: RefObject<HTMLElement | null>, selection = false): void {
  useEffect(() => {
    const refract = registry[key];
    const element = ref.current;
    if (refract && element) return refract(element, selection);
  }, [ref, selection]);
}
