export type AccountSlug = string;

export interface Occurrence {
  accountSlug: AccountSlug;
  /**
   * Positive values represent inflows while negative values represent outflows.
   */
  amount: number;
  /**
   * ISO-8601 timestamp that marks when the occurrence should be applied.
   */
  timestamp: string;
}

export interface AnchorCheckpoint {
  id: string;
  accountSlug: AccountSlug;
  /**
   * The balance that was observed at the checkpoint timestamp.
   */
  balance: number;
  /**
   * ISO-8601 timestamp for the observation.
   */
  timestamp: string;
}

export interface AnchorMetadata {
  balance: number;
  timestamp: string;
  source: 'checkpoint' | 'rollforward' | 'initial';
  checkpointId?: string;
  /**
   * True when a checkpoint within the period overrides the default beginning
   * balance.  This allows the consumer to surface that the balance represents a
   * mid-period reconciliation rather than the start-of-period roll forward.
   */
  isInterim?: boolean;
}

export interface EndingBalanceCell {
  ym: string;
  accountSlug: AccountSlug;
  /** Beginning balance that was used to compute the ending value. */
  beginningBalance: number;
  /** Ending balance for the period. */
  balance: number;
  /** Net activity applied after the anchor timestamp. */
  netAfterAnchor: number;
  anchor: AnchorMetadata;
}

export interface WeeklyBalanceCell {
  ym: string;
  accountSlug: AccountSlug;
  /** ISO date string representing the week end (Sunday). */
  weekKey: string;
  beginningBalance: number;
  balance: number;
  netAfterAnchor: number;
  anchor: AnchorMetadata;
}

export interface ForecastResult {
  months: string[];
  accounts: AccountSlug[];
  endingBalances: Record<string, Record<AccountSlug, EndingBalanceCell>>;
  weeklyBalances: Record<string, Record<string, Record<AccountSlug, WeeklyBalanceCell>>>;
}

export interface BuildForecastParams {
  months: string[];
  occurrences: Occurrence[];
  /** Prior ending balances that seed the roll-forward calculations. */
  priorEndingBalances: Record<AccountSlug, number>;
  checkpoints: AnchorCheckpoint[];
}

function toUtcDate(timestamp: string): Date {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }
  return date;
}

function startOfMonth(ym: string): Date {
  const [year, month] = ym.split('-').map(Number);
  if (!year || !month) {
    throw new Error(`Invalid month identifier: ${ym}`);
  }
  return new Date(Date.UTC(year, month - 1, 1));
}

function monthEndExclusive(ym: string): Date {
  const [year, month] = ym.split('-').map(Number);
  if (!year || !month) {
    throw new Error(`Invalid month identifier: ${ym}`);
  }
  return new Date(Date.UTC(year, month, 1));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toIsoTimestamp(date: Date): string {
  return date.toISOString();
}

function clonePriorBalances(source: Record<AccountSlug, number>): Record<AccountSlug, number> {
  return Object.fromEntries(Object.entries(source || {}).map(([key, value]) => [key, value]));
}

function listAccounts(
  occurrences: Occurrence[],
  checkpoints: AnchorCheckpoint[],
  priorEndingBalances: Record<AccountSlug, number>,
): AccountSlug[] {
  const accounts = new Set<AccountSlug>();
  occurrences.forEach((item) => accounts.add(item.accountSlug));
  checkpoints.forEach((item) => accounts.add(item.accountSlug));
  Object.keys(priorEndingBalances || {}).forEach((key) => accounts.add(key));
  return Array.from(accounts).sort();
}

function sortIsoStrings<T extends { timestamp: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const diff = toUtcDate(a.timestamp).getTime() - toUtcDate(b.timestamp).getTime();
    return diff;
  });
}

function filterOccurrencesForWindow(
  occurrences: Occurrence[],
  account: AccountSlug,
  windowStart: Date,
  windowEnd: Date,
): Occurrence[] {
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();
  return occurrences.filter((occ) => {
    if (occ.accountSlug !== account) return false;
    const ts = toUtcDate(occ.timestamp).getTime();
    return ts >= startMs && ts < endMs;
  });
}

function filterCheckpointsForWindow(
  checkpoints: AnchorCheckpoint[],
  account: AccountSlug,
  windowStart: Date,
  windowEnd: Date,
): AnchorCheckpoint[] {
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();
  return checkpoints.filter((cp) => {
    if (cp.accountSlug !== account) return false;
    const ts = toUtcDate(cp.timestamp).getTime();
    return ts >= startMs && ts < endMs;
  });
}

export function computeEndingBalances(
  months: string[],
  occurrences: Occurrence[],
  priorEndingBalances: Record<AccountSlug, number>,
  checkpoints: AnchorCheckpoint[],
): Record<string, Record<AccountSlug, EndingBalanceCell>> {
  const orderedMonths = [...months].sort();
  const accounts = listAccounts(occurrences, checkpoints, priorEndingBalances);
  const priorBalances = clonePriorBalances(priorEndingBalances);

  const monthlyResult: Record<string, Record<AccountSlug, EndingBalanceCell>> = {};

  for (const ym of orderedMonths) {
    const monthStart = startOfMonth(ym);
    const monthEnd = monthEndExclusive(ym);
    const monthCells: Record<AccountSlug, EndingBalanceCell> = {};

    for (const account of accounts) {
      const accountOccurrences = filterOccurrencesForWindow(occurrences, account, monthStart, monthEnd);
      const accountCheckpoints = sortIsoStrings(
        filterCheckpointsForWindow(checkpoints, account, monthStart, monthEnd),
      );

      const hadPriorBalance = Object.prototype.hasOwnProperty.call(priorBalances, account);
      const priorBalance = hadPriorBalance ? priorBalances[account] : 0;

      let anchor: AnchorMetadata = {
        balance: priorBalance,
        timestamp: toIsoTimestamp(monthStart),
        source: hadPriorBalance ? 'rollforward' : 'initial',
        isInterim: false,
      };

      if (accountCheckpoints.length > 0) {
        const latestCheckpoint = accountCheckpoints[accountCheckpoints.length - 1];
        const checkpointTimestamp = toUtcDate(latestCheckpoint.timestamp);
        anchor = {
          balance: latestCheckpoint.balance,
          timestamp: latestCheckpoint.timestamp,
          source: 'checkpoint',
          checkpointId: latestCheckpoint.id,
          isInterim: checkpointTimestamp.getTime() > monthStart.getTime(),
        };
      }

      const anchorTime = toUtcDate(anchor.timestamp).getTime();
      const netAfterAnchor = accountOccurrences
        .filter((occ) => {
          const occTime = toUtcDate(occ.timestamp).getTime();
          if (occTime < anchorTime) return false;
          if (anchor.source === 'checkpoint' && occTime === anchorTime) return false;
          return true;
        })
        .reduce((sum, occ) => sum + occ.amount, 0);

      const endingBalance = anchor.balance + netAfterAnchor;

      priorBalances[account] = endingBalance;

      monthCells[account] = {
        ym,
        accountSlug: account,
        beginningBalance: anchor.balance,
        balance: endingBalance,
        netAfterAnchor,
        anchor,
      };
    }

    monthlyResult[ym] = monthCells;
  }

  return monthlyResult;
}

interface WeekWindow {
  start: Date;
  end: Date; // exclusive end (start of next week)
  /** ISO date string for the week end (Sunday). */
  weekKey: string;
}

function computeWeeksInMonth(ym: string): WeekWindow[] {
  const result: WeekWindow[] = [];
  const monthStart = startOfMonth(ym);
  const monthEnd = monthEndExclusive(ym);

  let cursor = new Date(monthStart.getTime());

  while (cursor.getTime() < monthEnd.getTime()) {
    const weekStart = new Date(cursor.getTime());
    const dayOfWeek = weekStart.getUTCDay();
    const weekEnd = new Date(weekStart.getTime());
    weekEnd.setUTCDate(weekEnd.getUTCDate() + (dayOfWeek === 0 ? 0 : 7 - dayOfWeek));
    if (weekEnd.getTime() <= weekStart.getTime()) {
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    }
    const exclusiveEnd = new Date(Math.min(weekEnd.getTime() + 24 * 60 * 60 * 1000, monthEnd.getTime()));
    const weekKeyDate = new Date(exclusiveEnd.getTime() - 24 * 60 * 60 * 1000);
    const weekKey = toIsoDate(weekKeyDate);
    result.push({ start: weekStart, end: exclusiveEnd, weekKey });

    cursor = exclusiveEnd;
  }

  return result;
}

export function computeWeeklyBalances(
  months: string[],
  occurrences: Occurrence[],
  priorEndingBalances: Record<AccountSlug, number>,
  checkpoints: AnchorCheckpoint[],
): Record<string, Record<string, Record<AccountSlug, WeeklyBalanceCell>>> {
  const orderedMonths = [...months].sort();
  const accounts = listAccounts(occurrences, checkpoints, priorEndingBalances);
  const priorBalances = clonePriorBalances(priorEndingBalances);

  const weeklyResult: Record<string, Record<string, Record<AccountSlug, WeeklyBalanceCell>>> = {};

  for (const ym of orderedMonths) {
    const weeks = computeWeeksInMonth(ym);
    const monthWeeks: Record<string, Record<AccountSlug, WeeklyBalanceCell>> = {};

    for (const week of weeks) {
      const weekCells: Record<AccountSlug, WeeklyBalanceCell> = {};

      for (const account of accounts) {
        const accountOccurrences = filterOccurrencesForWindow(
          occurrences,
          account,
          week.start,
          week.end,
        );
        const accountCheckpoints = sortIsoStrings(
          filterCheckpointsForWindow(checkpoints, account, week.start, week.end),
        );

        const hadPriorBalance = Object.prototype.hasOwnProperty.call(priorBalances, account);
        const priorBalance = hadPriorBalance ? priorBalances[account] : 0;

        let anchor: AnchorMetadata = {
          balance: priorBalance,
          timestamp: toIsoTimestamp(week.start),
          source: hadPriorBalance ? 'rollforward' : 'initial',
          isInterim: false,
        };

        if (accountCheckpoints.length > 0) {
          const latestCheckpoint = accountCheckpoints[accountCheckpoints.length - 1];
          const checkpointTimestamp = toUtcDate(latestCheckpoint.timestamp);
          anchor = {
            balance: latestCheckpoint.balance,
            timestamp: latestCheckpoint.timestamp,
            source: 'checkpoint',
            checkpointId: latestCheckpoint.id,
            isInterim: checkpointTimestamp.getTime() > week.start.getTime(),
          };
        }

        const anchorTime = toUtcDate(anchor.timestamp).getTime();
        const netAfterAnchor = accountOccurrences
          .filter((occ) => {
            const occTime = toUtcDate(occ.timestamp).getTime();
            if (occTime < anchorTime) return false;
            if (anchor.source === 'checkpoint' && occTime === anchorTime) return false;
            return true;
          })
          .reduce((sum, occ) => sum + occ.amount, 0);

        const endingBalance = anchor.balance + netAfterAnchor;
        priorBalances[account] = endingBalance;

        weekCells[account] = {
          ym,
          accountSlug: account,
          weekKey: week.weekKey,
          beginningBalance: anchor.balance,
          balance: endingBalance,
          netAfterAnchor,
          anchor,
        };
      }

      monthWeeks[week.weekKey] = weekCells;
    }

    weeklyResult[ym] = monthWeeks;
  }

  return weeklyResult;
}

function almostEqual(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function assertBalanceRollForward(
  endingBalances: Record<string, Record<AccountSlug, EndingBalanceCell>>,
): void {
  const orderedMonths = Object.keys(endingBalances).sort();
  const lastEnding: Record<AccountSlug, number> = {};

  for (const ym of orderedMonths) {
    const monthCells = endingBalances[ym];
    for (const [account, cell] of Object.entries(monthCells)) {
      const expectedBeginning = lastEnding[account];
      if (expectedBeginning !== undefined && !almostEqual(cell.beginningBalance, expectedBeginning)) {
        throw new Error(
          `Monthly roll-forward violation for ${account} in ${ym}: expected beginning ${expectedBeginning}, got ${cell.beginningBalance}`,
        );
      }
      lastEnding[account] = cell.balance;
    }
  }
}

export function assertWeeklyBalanceRollForward(
  weeklyBalances: Record<string, Record<string, Record<AccountSlug, WeeklyBalanceCell>>>,
  endingBalances: Record<string, Record<AccountSlug, EndingBalanceCell>>,
): void {
  const orderedMonths = Object.keys(weeklyBalances).sort();
  const lastEnding: Record<AccountSlug, number> = {};

  for (const ym of orderedMonths) {
    const weekMap = weeklyBalances[ym];
    const weekKeys = Object.keys(weekMap).sort();

    for (const weekKey of weekKeys) {
      const weekCells = weekMap[weekKey];
      for (const [account, cell] of Object.entries(weekCells)) {
        const expectedBeginning = lastEnding[account];
        if (expectedBeginning !== undefined && !almostEqual(cell.beginningBalance, expectedBeginning)) {
          throw new Error(
            `Weekly roll-forward violation for ${account} in week ${weekKey}: expected beginning ${expectedBeginning}, got ${cell.beginningBalance}`,
          );
        }
        lastEnding[account] = cell.balance;
      }
    }

    const monthEndingCells = endingBalances[ym] || {};
    for (const [account, monthCell] of Object.entries(monthEndingCells)) {
      const lastWeekKey = weekKeys[weekKeys.length - 1];
      const lastWeekCell = lastWeekKey ? weekMap[lastWeekKey]?.[account] : undefined;
      if (lastWeekCell && !almostEqual(lastWeekCell.balance, monthCell.balance)) {
        throw new Error(
          `Weekly/monthly mismatch for ${account} in ${ym}: weekly ending ${lastWeekCell.balance}, monthly ending ${monthCell.balance}`,
        );
      }
    }
  }
}

export function buildForecast(params: BuildForecastParams): ForecastResult {
  const { months, occurrences, priorEndingBalances, checkpoints } = params;
  const orderedMonths = [...months].sort();
  const accounts = listAccounts(occurrences, checkpoints, priorEndingBalances);

  const endingBalances = computeEndingBalances(orderedMonths, occurrences, priorEndingBalances, checkpoints);
  assertBalanceRollForward(endingBalances);

  const weeklyBalances = computeWeeklyBalances(orderedMonths, occurrences, priorEndingBalances, checkpoints);
  assertWeeklyBalanceRollForward(weeklyBalances, endingBalances);

  return {
    months: orderedMonths,
    accounts,
    endingBalances,
    weeklyBalances,
  };
}

