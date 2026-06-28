import type { Issue } from '../core';
import type { Report } from './types';

/** Metadata attached to a Report, supplied by the caller (keeps this pure). */
export interface ReportMeta {
  generatedAt: string;
  livemode: boolean;
  accountsChecked: string[];
}

/** Assemble issues + metadata into a structured Report with severity counts. */
export function buildReport(issues: Issue[], meta: ReportMeta): Report {
  const summary: Report['summary'] = { critical: 0, warning: 0, info: 0 };
  for (const issue of issues) summary[issue.severity] += 1;

  return {
    generatedAt: meta.generatedAt,
    livemode: meta.livemode,
    accountsChecked: meta.accountsChecked,
    issues,
    summary,
  };
}
