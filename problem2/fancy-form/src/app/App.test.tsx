import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { EASY_FEED, jsonResponse, stubFetch } from "@/test/helpers";
import App from "./App";

describe("App (the whole page, as a user first sees it)", () => {
  it("renders the real Fancy Form with every control, never a placeholder", async () => {
    stubFetch(() => jsonResponse(EASY_FEED));
    render(
      <MemoryRouter>
        <App />
        <Toaster />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Swap" })).toBeInTheDocument();

    // swap card
    expect(screen.getByRole("combobox", { name: "Token to send" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Token to receive" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Amount to Send" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Amount to Receive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Swap" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Max" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Swap sending and receiving tokens" }),
    ).toBeInTheDocument();

    // header controls
    expect(screen.getByRole("button", { name: /switch language to/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Demo wallet/ })).toBeInTheDocument();

    expect(document.body).not.toHaveTextContent(/scaffold ready/i);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
