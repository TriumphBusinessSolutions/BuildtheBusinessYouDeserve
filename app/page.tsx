import React from 'react';
import {
  buildForecast,
  type BuildForecastParams,
  type WeeklyBalanceCell,
  type EndingBalanceCell,
} from '../lib/forecast';

const sampleParams: BuildForecastParams = {
  months: ['2025-01', '2025-02'],
  priorEndingBalances: {
    operating: 1250,
    profit: 300,
  },
  occurrences: [
    { accountSlug: 'operating', amount: 450, timestamp: '2025-01-03T10:00:00Z' },
    { accountSlug: 'operating', amount: -180, timestamp: '2025-01-07T18:30:00Z' },
    { accountSlug: 'operating', amount: -220, timestamp: '2025-01-20T15:45:00Z' },
    { accountSlug: 'operating', amount: 375, timestamp: '2025-02-04T09:05:00Z' },
    { accountSlug: 'operating', amount: -120, timestamp: '2025-02-12T12:00:00Z' },
    { accountSlug: 'operating', amount: -315, timestamp: '2025-02-21T13:15:00Z' },
    { accountSlug: 'profit', amount: 75, timestamp: '2025-01-10T11:00:00Z' },
    { accountSlug: 'profit', amount: -50, timestamp: '2025-01-25T08:00:00Z' },
    { accountSlug: 'profit', amount: 80, timestamp: '2025-02-08T16:00:00Z' },
  ],
  checkpoints: [
    {
      id: 'cp-operating-jan',
      accountSlug: 'operating',
      balance: 1480,
      timestamp: '2025-01-17T14:00:00Z',
    },
    {
      id: 'cp-profit-feb',
      accountSlug: 'profit',
      balance: 430,
      timestamp: '2025-02-18T13:30:00Z',
    },
  ],
};

const forecast = buildForecast(sampleParams);

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function renderMonthlyRow(month: string, account: string, cell: EndingBalanceCell): JSX.Element {
  return (
    <tr key={`${month}-${account}`}>
      <td className="font-mono text-xs text-gray-500">{month}</td>
      <td className="font-semibold capitalize">{account}</td>
      <td>{formatCurrency(cell.beginningBalance)}</td>
      <td>{formatCurrency(cell.netAfterAnchor)}</td>
      <td>{formatCurrency(cell.balance)}</td>
      <td>{cell.anchor.source}</td>
      <td>{cell.anchor.isInterim ? 'Yes' : 'No'}</td>
    </tr>
  );
}

function renderWeeklyRows(month: string, weekKey: string, cells: Record<string, WeeklyBalanceCell>): JSX.Element[] {
  return forecast.accounts.map((account) => {
    const cell = cells[account];
    if (!cell) return null;
    return (
      <tr key={`${month}-${weekKey}-${account}`}>
        <td className="font-mono text-xs text-gray-500">{month}</td>
        <td className="font-mono text-xs">{weekKey}</td>
        <td className="capitalize font-medium">{account}</td>
        <td>{formatCurrency(cell.beginningBalance)}</td>
        <td>{formatCurrency(cell.netAfterAnchor)}</td>
        <td>{formatCurrency(cell.balance)}</td>
        <td>{cell.anchor.source}</td>
        <td>{cell.anchor.isInterim ? 'Yes' : 'No'}</td>
      </tr>
    );
  }).filter(Boolean) as JSX.Element[];
}

export default function Page(): JSX.Element {
  return (
    <main className="p-8 space-y-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Forecast Dashboard</h1>
        <p className="text-gray-600 max-w-2xl">
          Monthly and weekly balances now track interim checkpoints. Beginning balances roll forward from the prior period
          unless a checkpoint overrides the anchor mid-period.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Monthly Balances</h2>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Month</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Account</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Beginning</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Net Activity</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Ending</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Anchor Source</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Interim?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {forecast.months.flatMap((month) =>
                forecast.accounts.map((account) => {
                  const cell = forecast.endingBalances[month]?.[account];
                  return cell ? renderMonthlyRow(month, account, cell) : null;
                }),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Weekly Balances</h2>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Month</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Week Ending</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Account</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Beginning</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Net Activity</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Ending</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Anchor Source</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Interim?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {forecast.months.flatMap((month) => {
                const weeks = Object.entries(forecast.weeklyBalances[month] || {}).sort((a, b) =>
                  a[0].localeCompare(b[0]),
                );
                return weeks.flatMap(([weekKey, cells]) => renderWeeklyRows(month, weekKey, cells));
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
