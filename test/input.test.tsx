import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { expect, test, vi } from "vitest";

import { Input } from "../src";

test("types uncontrolled and reports each change", () => {
  const onValueChange = vi.fn();
  render(<Input aria-label="Name" placeholder="Name" onValueChange={onValueChange} />);
  const input = screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "Ada" } });
  expect(input.value).toBe("Ada");
  expect(onValueChange).toHaveBeenCalledWith("Ada");
});

test("follows a controlled value and forwards input props", () => {
  const ref = createRef<HTMLInputElement>();
  render(<Input ref={ref} aria-label="Email" type="email" value="a@b.co" onValueChange={() => {}} icon={<svg />} />);
  expect(ref.current?.value).toBe("a@b.co");
  expect(ref.current?.type).toBe("email");
  expect(ref.current?.parentElement?.querySelector(".lg-input-icon")).toBeTruthy();
});
