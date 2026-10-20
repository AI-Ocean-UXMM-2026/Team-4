import { createFileRoute } from "@tanstack/react-router";
import { EmailCallbackPage } from "@/features/auth/AuthPages";
export const Route = createFileRoute("/auth/callback")({ component: EmailCallbackPage });
