import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConnectionBanner } from "./ConnectionBanner";

describe("ConnectionBanner", () => {
  it("shows a retryable join failure, reconnect progress, and unhealthy-room retry messaging", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <ConnectionBanner
        connectionState={{ phase: "failed", reason: "internal-error" }}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/could not join the session/i);
    fireEvent.click(screen.getByRole("button", { name: /retry join/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).not.toContainElement(screen.getByRole("button", { name: /retry join/i }));

    rerender(
      <ConnectionBanner
        connectionState={{ phase: "reconnecting" }}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/reconnecting to your session/i);

    rerender(
      <ConnectionBanner
        connectionState={{ phase: "failed", reason: "room-unavailable" }}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/the room was unavailable or unhealthy/i);
    expect(screen.getByRole("button", { name: /retry join/i })).toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toContainElement(screen.getByRole("button", { name: /retry join/i }));
  });
});
