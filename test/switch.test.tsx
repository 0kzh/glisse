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

test("defaults to the small size", () => {
  render(<Switch aria-label="Wi-Fi" />);
  expect(screen.getByRole("switch").dataset.size).toBe("sm");
});

test("takes a size", () => {
  render(<Switch aria-label="Wi-Fi" size="lg" />);
  expect(screen.getByRole("switch").dataset.size).toBe("lg");
});
