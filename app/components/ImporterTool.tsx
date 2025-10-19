'use client';

import React, { useCallback, useState } from 'react';
import type { EndingBalanceCell, WeeklyBalanceCell } from '../../lib/forecast';

interface ImportPayload {
  monthly: EndingBalanceCell[];
  weekly: WeeklyBalanceCell[];
}

async function persistMonthlyBalances(rows: EndingBalanceCell[]): Promise<void> {
  await fetch('/api/pf_monthly_balances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

async function persistWeeklyBalances(rows: WeeklyBalanceCell[]): Promise<void> {
  await fetch('/api/pf_weekly_balances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

function parseImportPayload(text: string): ImportPayload {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.monthly) || !Array.isArray(parsed.weekly)) {
    throw new Error('Import payload must include monthly and weekly arrays.');
  }
  return {
    monthly: parsed.monthly as EndingBalanceCell[],
    weekly: parsed.weekly as WeeklyBalanceCell[],
  };
}

const ImporterTool: React.FC = () => {
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleImport = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = formData.get('payload');

    if (typeof text !== 'string' || text.trim().length === 0) {
      setError('Paste the JSON payload before importing.');
      setStatus('');
      return;
    }

    try {
      setError('');
      setStatus('Importing…');
      const payload = parseImportPayload(text);
      await persistMonthlyBalances(payload.monthly);
      await persistWeeklyBalances(payload.weekly);
      setStatus('Import complete. Monthly and weekly balances saved.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error during import.';
      setError(message);
      setStatus('');
    }
  }, []);

  return (
    <section className="importer">
      <h2 className="text-xl font-semibold mb-2">Bulk Balance Import</h2>
      <p className="text-sm text-gray-600 mb-4">
        Paste the exported JSON containing <code>monthly</code> and <code>weekly</code> arrays to persist ending balances
        along with interim flags.
      </p>
      <form onSubmit={handleImport} className="grid gap-3">
        <textarea
          name="payload"
          rows={12}
          className="border rounded p-2 font-mono text-sm"
          placeholder='{"monthly": [...], "weekly": [...]}'
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          Import balances
        </button>
      </form>
      {status && <p className="text-sm text-green-700 mt-2" role="status">{status}</p>}
      {error && <p className="text-sm text-red-600 mt-2" role="alert">{error}</p>}
    </section>
  );
};

export default ImporterTool;
