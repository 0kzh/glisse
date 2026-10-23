import { fireEvent, render, screen } from "@testing-library/react";
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { expect, test, vi } from "vitest";

import { TabBar } from "../src";

const items = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

test("selects tabs by click", () => {
  const onValueChange = vi.fn();
  render(<TabBar aria-label="Range" items={items} defaultValue="day" onValueChange={onValueChange} />);
  expect(screen.getByRole("tablist", { name: "Range" })).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "Month" }));
  expect(onValueChange).toHaveBeenLastCalledWith("month");
  expect(screen.getByRole("tab", { name: "Month" }).getAttribute("aria-selected")).toBe("true");
});

test("moves between tabs with arrow keys", () => {
  render(<TabBar aria-label="Range" items={items} defaultValue="week" />);
  fireEvent.keyDown(screen.getByRole("tab", { name: "Week" }), { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Month" }).getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Month" }));

  fireEvent.keyDown(screen.getByRole("tab", { name: "Month" }), { key: "Home" });
  expect(screen.getByRole("tab", { name: "Day" }).getAttribute("aria-selected")).toBe("true");
});

test("keeps one tab in the tab order", () => {
  render(<TabBar aria-label="Range" items={items} value="week" />);
  const order = screen.getAllByRole("tab").map((tab) => tab.tabIndex);
  expect(order).toEqual([-1, 0, -1]);
});

test("renders links through a custom component", () => {
  const Link = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>((props, ref) => (
    <a ref={ref} data-custom="" {...props} />
  ));
  const links = [
    { value: "/", label: "Home", href: "/" },
    { value: "/blog", label: "Blog", href: "/blog" },
  ];
  render(<TabBar aria-label="Main" items={links} value="/blog" link={Link} />);

  expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
  const current = screen.getByRole("link", { name: "Blog" });
  expect(current.getAttribute("aria-current")).toBe("page");
  expect(current.hasAttribute("data-custom")).toBe(true);
});
