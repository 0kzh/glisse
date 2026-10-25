import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Switch } from "../src";

test("toggles when clicked", () => {
  const onCheckedChange = vi.fn();
  render(<Switch aria-label="Wi-Fi" onCheckedChange={onCheckedChange} />);
  const toggle = screen.getByRole("switch", { name: "Wi-Fi" });
  expect(toggle.getAttribute("aria-checked")).toBe("false");

  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(onCheckedChange).toHaveBeenLastCalledWith(true);
});

test("follows the checked prop when controlled", () => {
  const onCheckedChange = vi.fn();
  render(<Switch aria-label="Wi-Fi" checked onCheckedChange={onCheckedChange} />);
  const toggle = screen.getByRole("switch");

  fireEvent.click(toggle);
  expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
});

test("ignores input while disabled", () => {
  const onCheckedChange = vi.fn();
  render(<Switch aria-label="Wi-Fi" disabled onCheckedChange={onCheckedChange} />);
  fireEvent.click(screen.getByRole("switch"));
  expect(onCheckedChange).not.toHaveBeenCalled();
});

const touchmove = (target: Element) => {
  const event = new Event("touchmove", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

test("keeps a held touch from scrolling the page, but lets a quick swipe scroll", () => {
  const onCheckedChange = vi.fn();
  render(<Switch aria-label="Wi-Fi" onCheckedChange={onCheckedChange} />);
  const toggle = screen.getByRole("switch");
  vi.spyOn(toggle, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 100, 60, 25));
  const pointer = { pointerId: 3, pointerType: "touch", isPrimary: true, button: 0, clientX: 10, clientY: 112 };
  const now = vi.spyOn(performance, "now").mockReturnValue(1000);

  // A quick vertical swipe scrolls, and lets go of the switch.
  fireEvent.pointerDown(toggle, pointer);
  now.mockReturnValue(1050);
  expect(touchmove(toggle)).toBe(false);
  fireEvent.pointerMove(toggle, { ...pointer, clientY: 160 });
  fireEvent.pointerUp(toggle, { ...pointer, clientY: 160 });
  expect(onCheckedChange).not.toHaveBeenCalled();

  // Once held, the switch keeps the touch as it moves.
  now.mockReturnValue(2000);
  fireEvent.pointerDown(toggle, pointer);
  now.mockReturnValue(2200);
  expect(touchmove(toggle)).toBe(true);
  fireEvent.pointerMove(toggle, { ...pointer, clientY: 160 });
  expect(touchmove(toggle)).toBe(true);
  // Let go off the switch, a held tap doesn't toggle it.
  fireEvent.pointerUp(toggle, { ...pointer, clientY: 160 });
  expect(onCheckedChange).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
