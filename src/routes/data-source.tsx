import { createFileRoute } from "@tanstack/react-router";
import { DataSourcePage } from "@/features/data-source/DataSourcePage";
export const Route = createFileRoute("/data-source")({ component: DataSourcePage });
