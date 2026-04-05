import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JoinScreen } from "./JoinScreen";

describe("JoinScreen", () => {
  it("requires a display name before joining and submits the trimmed name to the socket client", async () => {
    const socketClient = {
      join: vi.fn().mockResolvedValue(undefined),
    };

    render(<JoinScreen socketClient={socketClient} />);

    const joinButton = screen.getByRole("button", { name: /join now/i });
    const nameInput = screen.getByLabelText(/display name/i);

    expect(nameInput).toHaveValue("");
    expect(joinButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: "   " } });
    expect(joinButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: "  Survivor  " } });
    expect(joinButton).toBeEnabled();

    fireEvent.click(joinButton);

    expect(socketClient.join).toHaveBeenCalledWith({ displayName: "Survivor" });
    expect(socketClient.join).toHaveBeenCalledTimes(1);
  });
});
