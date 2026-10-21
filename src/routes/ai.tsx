import { createFileRoute } from "@tanstack/react-router";
import { AIAnalyzerPage } from "@/features/ai-analyzer/AIAnalyzerPage";
export const Route = createFileRoute("/ai")({ component: AIAnalyzerPage });
