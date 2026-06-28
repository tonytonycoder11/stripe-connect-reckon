import type { Severity } from '../core';
import type { Report } from './types';

export interface RenderOptions {
  /** Wrap severity labels in ANSI colors (for terminals). Default false. */
  color?: boolean;
}

const SEVERITY_ORDER: Severity[] = ['critical', 'warning', 'info'];
const SEVERITY_SYMBOL: Record<Severity, string> = { critical: '✗', warning: '!', info: 'i' };

const ANSI_COLOR: Record<Severity, string> = {
  critical: '[31m', // red
  warning: '[33m', // yellow
  info: '[36m', // cyan
};
const ANSI_RESET = '[0m';
const ANSI_DIM = '[2m';

function colorize(text: string, severity: Severity, enabled: boolean): string {
  return enabled ? `${ANSI_COLOR[severity]}${text}${ANSI_RESET}` : text;
}

/**
 * Render a Report as readable plain text, optionally ANSI-colored. Pure and
 * deterministic — suitable for logs, CI output, or printing to a terminal.
 *
 * Issues are grouped by severity (critical first); each shows its type, account,
 * and message. An issue-free report renders a single "No issues detected." line.
 */
export function renderReport(report: Report, options: RenderOptions = {}): string {
  const color = options.color ?? false;
  const lines: string[] = [];

  lines.push('stripe-connect-reckon report');
  const mode = report.livemode ? 'live' : 'test';
  const header = `Generated ${report.generatedAt}  ·  mode: ${mode}  ·  accounts: ${report.accountsChecked.length}`;
  lines.push(color ? `${ANSI_DIM}${header}${ANSI_RESET}` : header);

  const { critical, warning, info } = report.summary;
  lines.push(`Summary: ${critical} critical, ${warning} warning, ${info} info`);
  lines.push('');

  if (report.issues.length === 0) {
    lines.push('No issues detected.');
    return lines.join('\n');
  }

  for (const severity of SEVERITY_ORDER) {
    const group = report.issues.filter((issue) => issue.severity === severity);
    if (group.length === 0) continue;

    lines.push(colorize(severity.toUpperCase(), severity, color));
    for (const issue of group) {
      lines.push(`  ${SEVERITY_SYMBOL[severity]} ${issue.type}  ${issue.accountId}`);
      lines.push(`    ${issue.message}`);
    }
    lines.push('');
  }

  // Trim the trailing blank line for tidy output.
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
