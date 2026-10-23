import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Menu } from "../src";

const open = () => fireEvent.click(screen.getByRole("button", { name: "Options" }));

test("opens, focuses the first item and selects", () => {
  const onPin = vi.fn();
  render(
    <Menu
      aria-label="Options"
      items={[{ label: "Pin", onSelect: onPin }, "separator", { label: "Delete", destructive: true }]}
    />,
  );
  open();

  expect(screen.getByRole("menu", { name: "Options" })).toBeTruthy();
  expect(screen.getByRole("separator")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Pin" }));
  expect(screen.getByRole("menuitem", { name: "Delete" }).hasAttribute("data-destructive")).toBe(true);

  fireEvent.click(screen.getByRole("menuitem", { name: "Pin" }));
  expect(onPin).toHaveBeenCalledOnce();
});

test("closes on Escape and returns focus to the trigger", async () => {
  vi.useFakeTimers();
  render(<Menu aria-label="Options" items={[{ label: "Pin" }]} />);
  open();

  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Pin" }), { key: "Escape" });
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Options" }));
  vi.useRealTimers();
});

test("skips disabled items with the arrow keys", () => {
  render(<Menu aria-label="Options" items={[{ label: "Pin" }, { label: "Rename", disabled: true }, { label: "Delete" }]} />);
  open();

  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Pin" }), { key: "ArrowDown" });
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
});
