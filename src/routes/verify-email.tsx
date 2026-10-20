import { createFileRoute } from "@tanstack/react-router";
import { VerificationPage } from "@/features/auth/AuthPages";
export const Route = createFileRoute("/verify-email")({ component: VerificationPage });
