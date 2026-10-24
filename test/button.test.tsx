import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { expect, test } from "vitest";

import { Button } from "../src";

test("renders a labelled button", () => {
  render(<Button>Continue</Button>);
  const button = screen.getByRole("button", { name: "Continue" });
  expect(button.getAttribute("type")).toBe("button");
  expect(button.hasAttribute("data-icon")).toBe(false);
});

test("is round with only an icon", () => {
  render(<Button icon={<svg />} aria-label="Share" />);
  expect(screen.getByRole("button", { name: "Share" }).dataset.icon).toBe("only");
});

test("forwards its ref and props", () => {
  const ref = createRef<HTMLButtonElement>();
  render(<Button ref={ref} className="extra" disabled>Save</Button>);
  expect(ref.current).toBe(screen.getByRole("button"));
  expect(ref.current?.className).toBe("lg-glass lg-button extra");
  expect(ref.current?.disabled).toBe(true);
});

test("marks its variant and destructive role", () => {
  render(
    <>
      <Button>Glass</Button>
      <Button variant="prominent" destructive>Delete</Button>
    </>,
  );
  const glass = screen.getByRole("button", { name: "Glass" });
  const remove = screen.getByRole("button", { name: "Delete" });
  expect(glass.hasAttribute("data-variant")).toBe(false);
  expect(glass.hasAttribute("data-destructive")).toBe(false);
  expect(remove.dataset.variant).toBe("prominent");
  expect(remove.dataset.destructive).toBe("");
});

test("takes a custom tint", () => {
  render(<Button variant="prominent" tint="#ff8d28">Order</Button>);
  const button = screen.getByRole("button", { name: "Order" });
  expect(button.hasAttribute("data-tint")).toBe(true);
  expect(button.style.getPropertyValue("--lg-tint")).toBe("#ff8d28");
});
