import type { BusinessDetails, PlatformConfig } from "@/lib/contracts";
export type PasswordPolicy = PlatformConfig["password_policy"];
export const validEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length <= 254;
export function passwordProblem(password: string, confirm: string, policy: PasswordPolicy): string {
  if (password.length < policy.min_length) return `Use at least ${policy.min_length} characters.`;
  if (password.length > 128) return "Use no more than 128 characters.";
  const rules: Record<string, RegExp> = {
    lower: /[a-z]/,
    upper: /[A-Z]/,
    number: /[0-9]/,
    symbol: /[^A-Za-z0-9\s]/,
  };
  if (policy.required_characters.some((kind) => rules[kind] && !rules[kind]!.test(password)))
    return "Include all the character types listed in the password requirements.";
  if (password !== confirm) return "Passwords do not match.";
  return "";
}
export function businessProblem(business: BusinessDetails): string {
  if (!business.name.trim() || !business.industry.trim() || !business.city.trim())
    return "Enter your business name, industry, and city or township.";
  if (
    business.name.trim().length > 200 ||
    business.industry.trim().length > 120 ||
    business.city.trim().length > 120 ||
    business.address.trim().length > 500
  )
    return "One of the business details is too long.";
  if (business.phone.trim() && !/^[+\d() .-]{5,40}$/.test(business.phone.trim()))
    return "Enter a valid business phone number.";
  return "";
}
export const emptyBusiness: BusinessDetails = {
  name: "",
  industry: "",
  city: "",
  phone: "",
  address: "",
  currency: "MMK",
};
