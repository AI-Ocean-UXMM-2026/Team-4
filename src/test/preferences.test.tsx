import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DisplayPreferences } from "@/components/layout/DisplayPreferences";
import { Field, FormError, PasswordField } from "@/features/auth/Fields";
import { translate } from "@/lib/i18n";
import { preferenceBootScript, setPreferences } from "@/lib/preferences";

afterEach(() => {
  cleanup();
  setPreferences({ language: "en", theme: "light" });
  localStorage.clear();
});

function Form() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <>
      <DisplayPreferences />
      <Field label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
      <PasswordField value={password} onChange={setPassword} />
      <FormError message="Use at least 8 characters." />
    </>
  );
}

describe("language and appearance preferences", () => {
  it("changes labels and validation messages without losing entered credentials", () => {
    render(<Form />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "preview@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "sample-value" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "my" },
    });
    expect(document.documentElement.lang).toBe("my");
    expect(screen.getByLabelText(translate("Email address"))).toHaveValue("preview@example.test");
    expect(screen.getByLabelText(translate("Password"), { exact: true })).toHaveValue(
      "sample-value",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(translate("Use at least 8 characters."));
    expect(screen.getByRole("alert")).not.toHaveTextContent("Use at least");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "en" } });
    expect(screen.getByLabelText("Email address")).toHaveValue("preview@example.test");
  });

  it("persists preferences and applies them before the next page paints", () => {
    render(<DisplayPreferences />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement).toHaveClass("dark");
    act(() => setPreferences({ language: "my" }));
    expect(JSON.parse(localStorage.getItem("shay-sett.preferences.v1")!)).toEqual({
      language: "my",
      theme: "dark",
    });
    document.documentElement.classList.remove("dark");
    document.documentElement.lang = "en";
    window.eval(preferenceBootScript);
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.lang).toBe("my");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: translate("Switch to light mode") }));
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
