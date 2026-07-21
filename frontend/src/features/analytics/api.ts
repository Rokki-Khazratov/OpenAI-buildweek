import { apiFetch } from "@/lib/api/browser";

import type { AnalyticsOverview, ExamAnalytics } from "./types";

export const getAnalyticsOverview = () =>
  apiFetch<AnalyticsOverview>("/analytics/overview");

export const getExamAnalytics = (examId: string) =>
  apiFetch<ExamAnalytics>(`/exams/${examId}/analytics`);
