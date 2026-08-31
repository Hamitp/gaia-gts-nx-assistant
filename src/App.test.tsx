// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(cleanup);

describe("GAIA açılış deneyimi", () => {
  it("yalnız iki ana başlangıç eylemini ve güven dilini gösterir", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Yeni proje/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Projeyi aç/i })).toBeVisible();
    expect(screen.getByText(/Tamamen çevrimdışı/i)).toBeVisible();
    expect(screen.getByText(/Değer uydurmaz/i)).toBeVisible();
  });
});

describe("GAIA sade analiz seçimi", () => {
  it("GTS çözüm adı yerine kullanıcı amacını ve seçim gerekçesini öne çıkarır", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Yeni proje/i }));
    fireEvent.click(screen.getByRole("button", { name: /Devam et/i }));
    expect(screen.getByRole("button", { name: /Oturma ve deplasman/i })).toBeVisible();
    const choice = screen.getByRole("button", { name: /Gerçekçi kalıcı deformasyon/i });
    expect(choice).toHaveTextContent(/Şunu seçin:/i);
    fireEvent.click(choice);
    expect(screen.getByText("1", { selector: ".selection-count strong" })).toBeVisible();
  });
});
