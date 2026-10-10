import { isValidClosed, type HistoricalJob } from "@workspace/material-accounting";

/** Takes already workspace- and date-filtered records. Never uses the recent-job slice. */
export function performanceJobs<T extends HistoricalJob>(jobs: T[]): T[] {
  return jobs.filter(isValidClosed)
    .sort((a, b) => Date.parse(b.closedAt!) - Date.parse(a.closedAt!) || a.id.localeCompare(b.id))
    .slice(0, 6);
}
