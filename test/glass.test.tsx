import { render } from "@testing-library/react";
import { createRef } from "react";
import { expect, test } from "vitest";

import { Glass } from "../src";

test("renders a glass surface and forwards its ref", () => {
  const ref = createRef<HTMLDivElement>();
  render(<Glass ref={ref} className="card" data-testid="glass" />);
  expect(ref.current?.className).toBe("lg-glass card");
});
