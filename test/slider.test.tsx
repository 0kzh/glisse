import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Slider } from "../src";

test("reports changes from the native range input", () => {
  const onValueChange = vi.fn();
  render(<Slider aria-label="Volume" defaultValue={20} onValueChange={onValueChange} />);
  const input = screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement;
  expect(input.value).toBe("20");

  fireEvent.change(input, { target: { value: "75" } });
  expect(onValueChange).toHaveBeenLastCalledWith(75);
  expect(input.value).toBe("75");
});

test("exposes progress for the thumb and fill", () => {
  const { container } = render(<Slider aria-label="Volume" value={30} min={20} max={70} />);
  const root = container.firstElementChild as HTMLElement;
  expect(root.style.getPropertyValue("--lg-progress")).toBe("0.2");
});

test("passes range attributes through", () => {
  render(<Slider aria-label="Volume" min={0} max={10} step={2} disabled />);
  const input = screen.getByRole("slider") as HTMLInputElement;
  expect([input.min, input.max, input.step, input.disabled]).toEqual(["0", "10", "2", true]);
});
