import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ControlsOverlay } from "./ControlsOverlay";

describe("ControlsOverlay", () => {
  it("shows the first-join controls list, continues the pending join, and remembers dismissal for the current browser session", () => {
    const onContinue = vi.fn();

    const firstRender = render(<ControlsOverlay onContinue={onContinue} />);

    expect(screen.getByRole("heading", { name: /before you drop in/i })).toBeInTheDocument();
    expect(screen.getByText(/wasd move/i)).toBeInTheDocument();
    expect(screen.getByText(/mouse aim/i)).toBeInTheDocument();
    expect(screen.getByText(/click shoot/i)).toBeInTheDocument();
    expect(screen.getByText(/e interact/i)).toBeInTheDocument();
    expect(screen.getByText(/r reload/i)).toBeInTheDocument();
    expect(screen.getByText(/tab inventory/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue to session/i }));

    expect(onContinue).toHaveBeenCalledTimes(1);

    firstRender.unmount();
    render(<ControlsOverlay onContinue={onContinue} />);

    expect(screen.queryByRole("heading", { name: /before you drop in/i })).not.toBeInTheDocument();
  });
});
