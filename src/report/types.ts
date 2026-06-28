import type { Issue } from '../core';

/** Counts of issues by severity. */
export interface ReportSummary {
  critical: number;
  warning: number;
  info: number;
}

/** The structured output of a reconciliation run. */
export interface Report {
  /** ISO-8601 timestamp of when the report was generated. */
  generatedAt: string;
  /** Whether the inspected data is from live mode. */
  livemode: boolean;
  /** Connected accounts that were inspected. */
  accountsChecked: string[];
  /** All detected issues, most severe first. */
  issues: Issue[];
  /** Issue counts by severity. */
  summary: ReportSummary;
}
