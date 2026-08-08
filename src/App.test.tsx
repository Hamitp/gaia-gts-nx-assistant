// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("GAIA açılış deneyimi", () => {
  it("yalnız iki ana başlangıç eylemini ve güven dilini gösterir", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Yeni proje/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Projeyi aç/i })).toBeVisible();
    expect(screen.getByText(/Tamamen çevrimdışı/i)).toBeVisible();
    expect(screen.getByText(/Değer uydurmaz/i)).toBeVisible();
  });
});

