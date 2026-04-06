import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeathOverlay } from "./DeathOverlay";

describe("DeathOverlay", () => {
  it("announces death without exposing dialog semantics", () => {
    render(<DeathOverlay isVisible />);

    expect(screen.getByRole("alert")).toHaveTextContent(/you died/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
