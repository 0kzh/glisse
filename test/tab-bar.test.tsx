import { act, fireEvent, render, screen } from "@testing-library/react";
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { TabBar } from "../src";

afterEach(() => vi.restoreAllMocks());

const items = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function touchTabs({ navigation = false, controlled = false } = {}) {
  const onValueChange = vi.fn();
  const entries = navigation ? items.map((item) => ({ ...item, href: `#${item.value}` })) : items;
  render(<TabBar aria-label="Range" items={entries} defaultValue="day" value={controlled ? "day" : undefined} onValueChange={onValueChange} />);
  const bar = screen.getByRole(navigation ? "navigation" : "tablist", { name: "Range" });
  const day = screen.getByRole(navigation ? "link" : "tab", { name: "Day" });
  const lens = bar.querySelector<HTMLElement>(".lg-tab-lens")!;
  bar.style.padding = "4px";
  bar.style.setProperty("--lg-lens-grow-x", "27px");
  bar.style.setProperty("--lg-lens-grow-y", "20px");
  vi.spyOn(lens, "offsetHeight", "get").mockReturnValue(32);
  vi.spyOn(bar, "clientWidth", "get").mockReturnValue(260);
  vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
    x: 20, y: 100, left: 20, top: 100, right: 280, bottom: 140,
    width: 260, height: 40, toJSON() {},
  });
  const pointer = { pointerId: 7, pointerType: "touch", isPrimary: true, button: 0, clientX: 66, clientY: 120 };
  return { bar, day, lens, pointer, onValueChange };
}

test("keeps dragging when touch capture transfers from the tab to the bar", () => {
  const { bar, day, pointer, onValueChange } = touchTabs();
  fireEvent.pointerDown(day, pointer);
  fireEvent.pointerMove(day, { ...pointer, clientX: 80 });
  // Touch starts with implicit capture on the button. Transferring capture to
  // its parent emits this bubbling event before the next captured move.
  fireEvent.lostPointerCapture(day, pointer);
  expect(bar.hasAttribute("data-lifted")).toBe(true);

  fireEvent.pointerMove(bar, { ...pointer, clientX: 234 });
  fireEvent.pointerUp(bar, { ...pointer, clientX: 234 });
  expect(onValueChange).toHaveBeenCalledExactlyOnceWith("month");
  expect(screen.getByRole("tab", { name: "Month" }).getAttribute("aria-selected")).toBe("true");
  expect(bar.hasAttribute("data-lifted")).toBe(false);
});

test("activates only the destination link after a touch capture handoff", () => {
  const { bar, day, pointer, onValueChange } = touchTabs({ navigation: true });
  fireEvent.pointerDown(day, pointer);
  const month = screen.getByRole("link", { name: "Month" });
  const clicked = vi.fn((event: Event) => event.preventDefault());
  month.addEventListener("click", clicked);
  fireEvent.pointerMove(day, { ...pointer, clientX: 80 });
  fireEvent.lostPointerCapture(day, pointer);
  fireEvent.pointerMove(bar, { ...pointer, clientX: 234 });
  fireEvent.pointerUp(bar, { ...pointer, clientX: 234 });
  expect(onValueChange).toHaveBeenCalledExactlyOnceWith("month");
  expect(clicked).toHaveBeenCalledOnce();
  expect(month.getAttribute("aria-current")).toBe("page");
});

test("selects where a drag leaves the lens, even released off the bar", () => {
  const { bar, day, pointer, onValueChange } = touchTabs();
  fireEvent.pointerDown(day, pointer);
  fireEvent.pointerMove(day, { ...pointer, clientX: 80 });
  fireEvent.pointerMove(bar, { ...pointer, clientX: 400, clientY: 320 });
  fireEvent.pointerUp(bar, { ...pointer, clientX: 400, clientY: 320 });
  expect(onValueChange).toHaveBeenCalledExactlyOnceWith("month");
  expect(screen.getByRole("tab", { name: "Month" }).getAttribute("aria-selected")).toBe("true");
});

test("follows a mouse that leaves the bar before the drag starts", () => {
  const { bar, day, pointer, onValueChange } = touchTabs();
  const mouse = { ...pointer, pointerType: "mouse" };
  fireEvent.pointerDown(day, mouse);
  fireEvent.pointerMove(document.body, { ...mouse, clientX: 400, clientY: 320 });
  fireEvent.pointerUp(document.body, { ...mouse, clientX: 400, clientY: 320 });
  expect(onValueChange).toHaveBeenCalledExactlyOnceWith("month");
  expect(bar.hasAttribute("data-lifted")).toBe(false);
});

test("keeps a held touch from scrolling the page, but lets a quick swipe scroll", () => {
  const { bar, day, pointer } = touchTabs();
  const now = vi.spyOn(performance, "now").mockReturnValue(1000);
  const swipe = () => {
    const event = new Event("touchmove", { bubbles: true, cancelable: true });
    day.dispatchEvent(event);
    return event.defaultPrevented;
  };

  fireEvent.pointerDown(day, pointer);
  now.mockReturnValue(1050);
  expect(swipe()).toBe(false);
  fireEvent.pointerCancel(bar, pointer);

  now.mockReturnValue(2000);
  fireEvent.pointerDown(day, pointer);
  now.mockReturnValue(2200);
  expect(swipe()).toBe(true);
  fireEvent.pointerUp(bar, pointer);
  expect(swipe()).toBe(false);
});

test("ignores a tap released off the bar", () => {
  const { bar, pointer, onValueChange } = touchTabs();
  const month = screen.getByRole("tab", { name: "Month" });
  fireEvent.pointerDown(month, { ...pointer, clientX: 234 });
  fireEvent.pointerUp(bar, { ...pointer, clientX: 234, clientY: 320 });
  expect(onValueChange).not.toHaveBeenCalled();
  expect(bar.hasAttribute("data-lifted")).toBe(false);
});

test.each(["pointerCancel", "lostPointerCapture"] as const)("cancels a drag on %s from the bar", (event) => {
  const { bar, day, pointer, onValueChange } = touchTabs();
  fireEvent.pointerDown(day, pointer);
  fireEvent.pointerMove(day, { ...pointer, clientX: 234 });
  fireEvent[event](bar, { ...pointer, clientX: 234 });
  fireEvent.pointerUp(bar, { ...pointer, clientX: 234 });
  expect(onValueChange).not.toHaveBeenCalled();
  expect(day.getAttribute("aria-selected")).toBe("true");
  expect(bar.hasAttribute("data-lifted")).toBe(false);
});

test.each([false, true])("a tap never sends the indicator back toward the old tab (navigation: %s)", (navigation) => {
  const { lens, pointer, onValueChange } = touchTabs({ navigation });
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  const month = screen.getByRole(navigation ? "link" : "tab", { name: "Month" });
  month.addEventListener("click", (event) => event.preventDefault());
  const writes = vi.spyOn(lens.style, "transform", "set");
  fireEvent.pointerDown(month, { ...pointer, clientX: 234 });
  writes.mockClear();
  fireEvent.pointerUp(month, { ...pointer, clientX: 234 });

  expect(onValueChange).toHaveBeenCalledExactlyOnceWith("month");
  expect(writes.mock.calls.length).toBeGreaterThan(0);
  for (const [transform] of writes.mock.calls) {
    expect(transform).toMatch(/^translateX\(168px\)/);
  }
  expect(month.getAttribute(navigation ? "aria-current" : "aria-selected")).toBe(navigation ? "page" : "true");
});

test("settles back when a controlled value declines a tap", async () => {
  const { bar, lens, pointer, onValueChange } = touchTabs({ controlled: true });
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  const month = bar.querySelectorAll<HTMLElement>(".lg-tab")[2]!;
  fireEvent.pointerDown(month, { ...pointer, clientX: 234 });
  fireEvent.pointerUp(month, { ...pointer, clientX: 234 });
  await act(async () => { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); });

  expect(onValueChange).toHaveBeenCalledExactlyOnceWith("month");
  expect(month.getAttribute("aria-selected")).toBe("false");
  expect(lens.style.transform).toMatch(/^translateX\(0px\)/);
});

test("a tap on the selected tab releases its lift", async () => {
  const { bar, day, lens, pointer, onValueChange } = touchTabs();
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  fireEvent.pointerDown(day, pointer);
  fireEvent.pointerUp(day, pointer);
  await act(async () => { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); });
  expect(onValueChange).toHaveBeenCalledExactlyOnceWith("day");
  expect(bar.hasAttribute("data-lifted")).toBe(false);
  expect(lens.style.transform).toBe("translateX(0px) scale(1, 1)");
});

test("the held lens's shadow follows its lift, against its stretch", async () => {
  const { day, lens, pointer } = touchTabs();
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  fireEvent.pointerDown(day, pointer);
  expect(lens.style.getPropertyValue("--lg-lift")).toBe("1");
  expect(lens.style.getPropertyValue("--lg-lift-y")).toBe("1.625");
  fireEvent.pointerUp(day, pointer);
  await act(async () => { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); });
  expect(lens.style.getPropertyValue("--lg-lift")).toBe("0");
  expect(lens.style.getPropertyValue("--lg-lift-y")).toBe("1");
});

test("over the selected tab, lifted or not, the selection draws its label alone", async () => {
  // A visible page, in motion: springs animate rather than jump.
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
  const { bar, day, lens, pointer } = touchTabs();
  const frame = () => act(async () => { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); });
  const frames = async (count: number) => {
    for (let i = 0; i < count; i++) await frame();
  };
  const arrive = async () => {
    for (let i = 0; i < 120 && bar.hasAttribute("data-away"); i++) await frame();
  };
  // Mounted on Day: Day's own label is the one to hide.
  expect(bar.hasAttribute("data-away")).toBe(false);
  expect(day.querySelector(":scope > .lg-tab-face")).not.toBeNull();

  // Held and lifted over Day, the lens draws Day, so its label stays hidden:
  // nothing switches as it lifts or as it settles back.
  fireEvent.pointerDown(day, pointer);
  await frames(10);
  expect(bar.hasAttribute("data-lifted")).toBe(true);
  expect(bar.hasAttribute("data-away")).toBe(false);
  // Dragged off Day, Day's label shows again.
  fireEvent.pointerMove(day, { ...pointer, clientX: 66 + 40 });
  await frames(10);
  expect(bar.hasAttribute("data-away")).toBe(true);
  fireEvent.pointerCancel(bar, pointer);
  await arrive();
  expect(bar.hasAttribute("data-away")).toBe(false);

  // Choosing Month marks the bar before the next frame, so Month's label
  // never vanishes ahead of the selection.
  fireEvent.click(screen.getByRole("tab", { name: "Month" }));
  expect(bar.hasAttribute("data-away")).toBe(true);
  await arrive();
  expect(bar.hasAttribute("data-away")).toBe(false);
  await frames(60);
  expect(lens.style.transform).toBe("translateX(168px) scale(1, 1)");
});

test("marks a held lens on a light page, read afresh on each hold", () => {
  const { bar, day, pointer } = touchTabs();
  fireEvent.pointerDown(day, pointer);
  expect(bar.hasAttribute("data-light")).toBe(true);
  fireEvent.pointerCancel(bar, pointer);

  // The page turns dark: the next hold keeps the lens as dark pages have it.
  bar.closest("div")!.parentElement!.setAttribute("data-theme", "dark");
  fireEvent.pointerDown(day, pointer);
  expect(bar.hasAttribute("data-light")).toBe(false);
  fireEvent.pointerCancel(bar, pointer);
});

test("leaves modified link taps to the browser", () => {
  const { bar, pointer, onValueChange } = touchTabs({ navigation: true });
  const month = screen.getByRole("link", { name: "Month" });
  const clicked = vi.fn((event: Event) => event.preventDefault());
  month.addEventListener("click", clicked);
  fireEvent.pointerDown(month, { ...pointer, clientX: 234, metaKey: true });
  fireEvent.pointerUp(month, { ...pointer, clientX: 234, metaKey: true });
  expect(clicked).not.toHaveBeenCalled();
  expect(bar.hasAttribute("data-lifted")).toBe(false);
  fireEvent.click(month, { metaKey: true });
  expect(clicked).toHaveBeenCalledOnce();
  expect(onValueChange).not.toHaveBeenCalled();
});

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

test("draws each tab's icon above its label, and copies both for the selection", () => {
  const icon = (name: string) => <svg data-icon={name} viewBox="0 0 24 24" />;
  render(
    <TabBar
      aria-label="Sections"
      items={[
        { value: "today", label: "Today", icon: icon("today") },
        { value: "sports", label: "Sports", icon: icon("sports") },
      ]}
      defaultValue="sports"
    />,
  );
  const bar = screen.getByRole("tablist", { name: "Sections" });
  expect(bar.hasAttribute("data-icons")).toBe(true);
  // The icon is decoration: the tab is named by its label.
  const sports = screen.getByRole("tab", { name: "Sports" });
  expect(sports.querySelector(".lg-tab-icon [data-icon='sports']")).not.toBeNull();
  expect(sports.querySelector(".lg-tab-icon")!.getAttribute("aria-hidden")).toBe("true");
  // The tint and the lens's two copies (what the labels cover, and what they add) show the same icons.
  expect(bar.querySelectorAll(".lg-tab-copy [data-icon='sports']")).toHaveLength(3);
});

test("keeps the plain layout when no tab has an icon", () => {
  render(<TabBar aria-label="Range" items={items} defaultValue="day" />);
  expect(screen.getByRole("tablist").hasAttribute("data-icons")).toBe(false);
  expect(screen.getByRole("tab", { name: "Day" }).querySelector(".lg-tab-icon")).toBeNull();
});
