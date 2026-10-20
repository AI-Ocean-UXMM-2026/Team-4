import { createFileRoute } from "@tanstack/react-router";
import { OnboardingPage } from "@/features/auth/AuthPages";
export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });
