import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JoinScreen } from "./JoinScreen";

describe("JoinScreen", () => {
  it("requires a display name before reviewing the briefing and submits the trimmed name to the parent flow", async () => {
    const onContinue = vi.fn();

    render(<JoinScreen onContinue={onContinue} />);

    const continueButton = screen.getByRole("button", { name: /review briefing/i });
    const nameInput = screen.getByLabelText(/display name/i);

    expect(nameInput).toHaveValue("");
    expect(continueButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: "   " } });
    expect(continueButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: "  Survivor  " } });
    expect(continueButton).toBeEnabled();

    fireEvent.click(continueButton);

    expect(onContinue).toHaveBeenCalledWith("Survivor");
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
