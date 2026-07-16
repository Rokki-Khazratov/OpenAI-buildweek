import type { AttemptSummaryDto, ExamStatisticsDto } from "./api";
import type { ExamAttempt } from "./types";

/**
 * UI model for the Exam statistics screen. Every value is either a
 * backend-supported aggregate or `null` when the backend reported no data.
 * An empty statistics response is a valid state, not an error.
 */
export type AttemptHistoryPoint = {
  id: string;
  percentage: number;
  scoreLabel: string;
  completedAtLabel: string;
  durationLabel: string;
};

export type ExamStatisticsView = {
  attemptCount: number;
  averagePercentage: number | null;
  bestPercentage: number | null;
  latestPercentage: number | null;
  averageDurationLabel: string | null;
  lowConfidence: boolean;
  /** Completed attempts in chronological order (oldest first). */
  history: AttemptHistoryPoint[];
};

export function formatDurationSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours} h ${minutes % 60} min`;
  }
  if (minutes === 0) return `${seconds} s`;
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;
}

function historyFromAttempts(attempts: AttemptSummaryDto[]): AttemptHistoryPoint[] {
  // The backend returns evaluated attempts newest-first; the trajectory reads oldest-first.
  return [...attempts]
    .reverse()
    .map((attempt) => ({
      id: attempt.attempt_id,
      percentage: attempt.percentage,
      scoreLabel: `${attempt.score}/${attempt.max_score} points`,
      completedAtLabel: new Date(attempt.submitted_at).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      durationLabel: formatDurationSeconds(attempt.duration_seconds),
    }));
}

export function statisticsViewFromApi(
  statistics: ExamStatisticsDto,
  attempts: AttemptSummaryDto[] = [],
): ExamStatisticsView {
  return {
    attemptCount: statistics.attempt_count,
    averagePercentage: statistics.average_percentage,
    bestPercentage: statistics.best_percentage,
    latestPercentage: statistics.latest_percentage,
    averageDurationLabel:
      statistics.average_duration_seconds === null
        ? null
        : formatDurationSeconds(statistics.average_duration_seconds),
    lowConfidence: statistics.low_confidence,
    history: historyFromAttempts(attempts),
  };
}

/** Demo mode keeps working without the backend: derive the same view locally. */
export function statisticsViewFromDemoAttempts(attempts: ExamAttempt[]): ExamStatisticsView {
  // Demo attempts are stored newest-first, mirroring the backend ordering.
  const percentages = attempts.map((attempt) =>
    Math.round((attempt.score / Math.max(1, attempt.maxScore)) * 100),
  );
  const durations = attempts.map((attempt) => attempt.durationMinutes * 60);
  return {
    attemptCount: attempts.length,
    averagePercentage: percentages.length
      ? Math.round(percentages.reduce((total, value) => total + value, 0) / percentages.length)
      : null,
    bestPercentage: percentages.length ? Math.max(...percentages) : null,
    latestPercentage: percentages.length ? percentages[0] : null,
    averageDurationLabel: durations.length
      ? formatDurationSeconds(
          Math.round(durations.reduce((total, value) => total + value, 0) / durations.length),
        )
      : null,
    lowConfidence: attempts.length < 5,
    history: [...attempts].reverse().map((attempt, index) => ({
      id: attempt.id || `demo-attempt-${index + 1}`,
      percentage: Math.round((attempt.score / Math.max(1, attempt.maxScore)) * 100),
      scoreLabel: `${attempt.score}/${attempt.maxScore} points`,
      completedAtLabel: attempt.completedAt,
      durationLabel: `${attempt.durationMinutes} min`,
    })),
  };
}
