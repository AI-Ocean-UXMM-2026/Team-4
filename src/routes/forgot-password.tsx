import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "@/features/auth/AuthPages";
export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });
