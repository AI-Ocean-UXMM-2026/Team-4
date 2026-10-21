import { createFileRoute } from "@tanstack/react-router";
import { CreditPage } from "@/features/credit/pages/CreditPage";

export const Route = createFileRoute("/credit")({ component: CreditPage });
