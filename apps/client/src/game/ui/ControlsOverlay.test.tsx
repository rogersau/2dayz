import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ControlsOverlay } from "./ControlsOverlay";

describe("ControlsOverlay", () => {
  it("shows the first-join field briefing, continues the pending join, and remembers dismissal for the current browser session", () => {
    const onContinue = vi.fn();

    const firstRender = render(<ControlsOverlay onContinue={onContinue} />);
    const controlsList = screen.getByRole("list");
    const controls = screen.getAllByRole("listitem").map((item) => item.textContent);

    expect(screen.getByRole("heading", { name: /field briefing/i })).toBeInTheDocument();
    expect(controlsList).toBeInTheDocument();
    expect(controls).toEqual([
      "Click to capture mouse",
      "Mouse aim",
      "Left click fire",
      "Right click aim",
      "Esc release mouse",
      "WASD move",
      "E interact",
      "R reload",
      "Tab inventory",
    ]);
    expect(screen.getByText(/your first left click captures the mouse and fires\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /enter session/i }));

    expect(onContinue).toHaveBeenCalledTimes(1);

    firstRender.unmount();
    render(<ControlsOverlay onContinue={onContinue} />);

    expect(screen.queryByRole("heading", { name: /field briefing/i })).not.toBeInTheDocument();
  });
});
