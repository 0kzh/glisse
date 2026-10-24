import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { SearchField } from "../src";

test("reports typing", () => {
  const onValueChange = vi.fn();
  render(<SearchField aria-label="Search docs" onValueChange={onValueChange} />);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search docs" }), { target: { value: "glass" } });
  expect(onValueChange).toHaveBeenLastCalledWith("glass");
});

test("clears and keeps focus", () => {
  render(<SearchField aria-label="Search docs" defaultValue="glass" />);
  const input = screen.getByRole("searchbox") as HTMLInputElement;

  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(input.value).toBe("");
  expect(document.activeElement).toBe(input);
  expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
});

test("hides the clear button while disabled", () => {
  render(<SearchField aria-label="Search docs" value="glass" disabled />);
  expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
});

test("takes a custom icon", () => {
  render(<SearchField aria-label="Search docs" icon={<svg data-testid="custom" />} />);
  expect(screen.getByTestId("custom")).toBeTruthy();
});
