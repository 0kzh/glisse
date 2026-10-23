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
