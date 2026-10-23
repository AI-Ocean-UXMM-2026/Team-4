import { createFileRoute, redirect } from "@tanstack/react-router";
import { DataSourcePage } from "@/features/data-source/DataSourcePage";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/data-source" });
  },
  component: DataSourcePage,
});
