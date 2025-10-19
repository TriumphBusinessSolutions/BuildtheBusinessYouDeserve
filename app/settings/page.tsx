'use client';

import React, { useState } from 'react';

interface MonthlyFormState {
  ym: string;
  accountSlug: string;
  isInterim: boolean;
}

interface WeeklyFormState {
  ym: string;
  weekEnd: string;
  accountSlug: string;
  isInterim: boolean;
}

async function updateMonthlyInterim(payload: MonthlyFormState): Promise<void> {
  await fetch('/api/pf_monthly_balances/interim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function updateWeeklyInterim(payload: WeeklyFormState): Promise<void> {
  await fetch('/api/pf_weekly_balances/interim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

const SettingsPage: React.FC = () => {
  const [monthlyForm, setMonthlyForm] = useState<MonthlyFormState>({
    ym: '2025-01',
    accountSlug: 'operating',
    isInterim: false,
  });
  const [weeklyForm, setWeeklyForm] = useState<WeeklyFormState>({
    ym: '2025-01',
    weekEnd: '2025-01-12',
    accountSlug: 'operating',
    isInterim: false,
  });
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleMonthlyChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = event.target;
    setMonthlyForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleWeeklyChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = event.target;
    setWeeklyForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setError('');
      setStatus('Saving…');
      await updateMonthlyInterim(monthlyForm);
      await updateWeeklyInterim(weeklyForm);
      setStatus('Settings updated. Interim flags saved for monthly and weekly balances.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save settings.';
      setError(message);
      setStatus('');
    }
  };

  return (
    <main className="p-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Balance Settings</h1>
        <p className="text-gray-600 max-w-xl">
          Toggle whether a period&apos;s beginning balance originates from a mid-period checkpoint. Weekly settings mirror the
          existing monthly controls to keep forecasts aligned with the data stored in Supabase.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Monthly Interim Flag</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span>Month (YYYY-MM)</span>
              <input
                type="text"
                name="ym"
                value={monthlyForm.ym}
                onChange={handleMonthlyChange}
                className="border rounded px-2 py-1"
                placeholder="2025-01"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Account Slug</span>
              <input
                type="text"
                name="accountSlug"
                value={monthlyForm.accountSlug}
                onChange={handleMonthlyChange}
                className="border rounded px-2 py-1"
                placeholder="operating"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isInterim"
                checked={monthlyForm.isInterim}
                onChange={handleMonthlyChange}
              />
              <span>Beginning balance comes from a checkpoint</span>
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Weekly Interim Flag</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1 text-sm">
              <span>Month (YYYY-MM)</span>
              <input
                type="text"
                name="ym"
                value={weeklyForm.ym}
                onChange={handleWeeklyChange}
                className="border rounded px-2 py-1"
                placeholder="2025-01"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Week Ending (ISO date)</span>
              <input
                type="date"
                name="weekEnd"
                value={weeklyForm.weekEnd}
                onChange={handleWeeklyChange}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Account Slug</span>
              <input
                type="text"
                name="accountSlug"
                value={weeklyForm.accountSlug}
                onChange={handleWeeklyChange}
                className="border rounded px-2 py-1"
                placeholder="operating"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isInterim"
                checked={weeklyForm.isInterim}
                onChange={handleWeeklyChange}
              />
              <span>Checkpoint overrides beginning balance</span>
            </label>
          </div>
        </section>

        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          Save settings
        </button>
      </form>

      {status && <p className="text-sm text-green-700" role="status">{status}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </main>
  );
};

export default SettingsPage;
