import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setPreferences } from "@/lib/preferences";
import { translate } from "@/lib/i18n";
import { ProfilePage } from "./ProfilePage";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  api: mocks.api,
}));
vi.mock("@/app/session", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

const initialProfile = {
  user: { id: "user-1", email: "owner@example.test", full_name: "Shop Owner" },
  business: {
    id: "owned-1",
    name: "My Shop",
    industry: "Retail",
    city: "Yangon",
    phone: "09123456789",
    address: "10 Market Street",
    currency: "MMK",
  },
};

let client: QueryClient;

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
}

function saveButton() {
  return screen.getByRole("button", { name: "Save changes" });
}

function postCalls() {
  return mocks.api.mock.calls.filter(([, options]) => options?.method === "POST");
}

async function openProfile() {
  render(
    <QueryClientProvider client={client}>
      <ProfilePage />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText("Full name")).toHaveValue("Shop Owner"));
}

beforeEach(() => {
  vi.clearAllMocks();
  setPreferences({ language: "en", theme: "light" });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mocks.api.mockResolvedValue(initialProfile);
});

afterEach(() => {
  cleanup();
  client.clear();
  localStorage.clear();
});

describe("User profile", () => {
  it("loads account and business details while keeping the sign-in email read-only", async () => {
    await openProfile();

    expect(mocks.api).toHaveBeenCalledWith("/api/v1/auth/profile");
    expect(screen.getByLabelText("Email address")).toHaveValue("owner@example.test");
    expect(screen.getByLabelText("Email address")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Company or business name")).toHaveValue("My Shop");
    expect(screen.getByLabelText("Business type or industry")).toHaveValue("Retail");
    expect(screen.getByLabelText("City or township")).toHaveValue("Yangon");
    expect(screen.getByLabelText("Business phone number (optional)")).toHaveValue("09123456789");
    expect(screen.getByLabelText("Business address (optional)")).toHaveValue("10 Market Street");
    expect(screen.getByLabelText("Preferred currency")).toHaveValue("MMK");
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByText("Profile saved.")).not.toBeInTheDocument();
  });

  it("saves editable details only and adopts the canonical server response", async () => {
    await openProfile();
    const savedProfile = {
      user: { ...initialProfile.user, full_name: "Updated Owner" },
      business: { ...initialProfile.business, name: "New Shop", city: "Mandalay" },
    };
    mocks.api.mockImplementation((_path: string, options?: RequestInit) =>
      Promise.resolve(options?.method === "POST" ? savedProfile : initialProfile),
    );

    fill("Full name", " Updated Owner ");
    fill("Company or business name", " New Shop ");
    fill("City or township", " Mandalay ");
    fireEvent.click(saveButton());

    await screen.findByText("Profile saved.");
    expect(postCalls()).toHaveLength(1);
    const [path, options] = postCalls()[0]!;
    expect(path).toBe("/api/v1/auth/profile");
    expect(JSON.parse(options.body)).toEqual({
      full_name: "Updated Owner",
      business: {
        name: "New Shop",
        industry: "Retail",
        city: "Mandalay",
        phone: "09123456789",
        address: "10 Market Street",
        currency: "MMK",
      },
    });
    expect(screen.getByLabelText("Full name")).toHaveValue("Updated Owner");
    expect(screen.getByLabelText("Company or business name")).toHaveValue("New Shop");
    expect(screen.getByLabelText("City or township")).toHaveValue("Mandalay");
    expect(saveButton()).toBeDisabled();
  });

  it("keeps the draft and reports a failed save without a success confirmation", async () => {
    await openProfile();
    mocks.api.mockRejectedValue(new Error("Connection lost. Please try again."));

    fill("Full name", "My unsaved name");
    fireEvent.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection lost. Please try again.",
    );
    expect(screen.getByLabelText("Full name")).toHaveValue("My unsaved name");
    expect(saveButton()).toBeEnabled();
    expect(postCalls()).toHaveLength(1);
    expect(screen.queryByText("Profile saved.")).not.toBeInTheDocument();
  });

  it("rejects a whitespace-only name before sending an update", async () => {
    await openProfile();
    fill("Full name", "   ");
    fireEvent.submit(saveButton().closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(/name/i);
    expect(postCalls()).toHaveLength(0);
  });

  it("validates business details before sending an update", async () => {
    await openProfile();
    fill("City or township", "   ");
    fireEvent.submit(saveButton().closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter your business name, industry, and city or township.",
    );
    expect(postCalls()).toHaveLength(0);
  });

  it("cancels unsaved account and business edits without making a request", async () => {
    await openProfile();
    fill("Full name", "Unsaved Owner");
    fill("Company or business name", "Unsaved Shop");
    fill("Business phone number (optional)", "09999999999");
    expect(saveButton()).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel changes" }));

    expect(screen.getByLabelText("Full name")).toHaveValue("Shop Owner");
    expect(screen.getByLabelText("Company or business name")).toHaveValue("My Shop");
    expect(screen.getByLabelText("Business phone number (optional)")).toHaveValue("09123456789");
    expect(saveButton()).toBeDisabled();
    expect(postCalls()).toHaveLength(0);
  });

  it("allows a personal-details update when no business is linked", async () => {
    const personalProfile = { user: initialProfile.user, business: null };
    mocks.api.mockResolvedValue(personalProfile);
    await openProfile();
    expect(screen.queryByLabelText("Company or business name")).not.toBeInTheDocument();
    expect(screen.getByText("No business is linked to this profile yet.")).toBeVisible();

    mocks.api.mockResolvedValue({
      ...personalProfile,
      user: { ...personalProfile.user, full_name: "Personal Owner" },
    });
    fill("Full name", "Personal Owner");
    fireEvent.click(saveButton());

    await screen.findByText("Profile saved.");
    expect(JSON.parse(postCalls()[0]![1].body)).toEqual({ full_name: "Personal Owner" });
    expect(saveButton()).toBeDisabled();
  });

  it("shows the profile and save controls in Myanmar when that language is selected", async () => {
    setPreferences({ language: "my", theme: "dark" });
    render(
      <QueryClientProvider client={client}>
        <ProfilePage />
      </QueryClientProvider>,
    );

    const heading = await screen.findByRole("heading", {
      name: translate("Your profile"),
      level: 1,
    });
    expect(heading).not.toHaveTextContent("Your profile");
    expect(screen.getByLabelText(translate("Full name"))).toHaveValue("Shop Owner");
    expect(screen.getByLabelText(translate("Email address"))).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: translate("Save changes") })).toBeDisabled();
    expect(screen.getByRole("button", { name: translate("Cancel changes") })).toBeDisabled();
  });
});
