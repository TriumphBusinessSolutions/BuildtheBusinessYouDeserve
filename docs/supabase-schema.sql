-- Schema excerpts relevant to profit forecasting balances.

-- Existing monthly balances table gains an interim flag.
ALTER TABLE public.pf_monthly_balances
  ADD COLUMN IF NOT EXISTS is_interim boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pf_monthly_balances.is_interim IS
  'Indicates that the beginning balance for the month comes from a mid-month checkpoint.';

-- Weekly balance storage mirrors the monthly snapshot table.
CREATE TABLE IF NOT EXISTS public.pf_weekly_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ym char(7) NOT NULL,
  week_end_date date NOT NULL,
  pf_slug text NOT NULL,
  beginning_balance numeric NOT NULL DEFAULT 0,
  ending_balance numeric NOT NULL DEFAULT 0,
  is_interim boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pf_weekly_balances UNIQUE (client_id, week_end_date, pf_slug),
  CONSTRAINT fk_pf_weekly_balances_account FOREIGN KEY (client_id, pf_slug)
    REFERENCES public.pf_accounts(client_id, slug) ON DELETE CASCADE,
  CONSTRAINT ck_pf_weekly_balances_ym_format CHECK (ym ~ '^[0-9]{4}-[0-9]{2}$')
);

COMMENT ON TABLE public.pf_weekly_balances IS
  'Week-end balance snapshots for each Profit First account with beginning/ending balances and interim markers.';
COMMENT ON COLUMN public.pf_weekly_balances.ym IS
  'Year-month (YYYY-MM) indicating which calendar month the week belongs to.';
COMMENT ON COLUMN public.pf_weekly_balances.week_end_date IS
  'The ISO date that marks the end of the represented week.';
COMMENT ON COLUMN public.pf_weekly_balances.is_interim IS
  'True when the beginning balance was sourced from a mid-week checkpoint.';

CREATE INDEX IF NOT EXISTS idx_pf_weekly_balances_client_ym
  ON public.pf_weekly_balances (client_id, ym);
CREATE INDEX IF NOT EXISTS idx_pf_weekly_balances_client_week
  ON public.pf_weekly_balances (client_id, week_end_date);

CREATE OR REPLACE FUNCTION public.touch_pf_weekly_balances_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_pf_weekly_balances_updated_at ON public.pf_weekly_balances;
CREATE TRIGGER trg_touch_pf_weekly_balances_updated_at
  BEFORE UPDATE ON public.pf_weekly_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_pf_weekly_balances_updated_at();

CREATE OR REPLACE VIEW public.v_pf_weekly_balances AS
SELECT
  client_id,
  ym,
  week_end_date,
  pf_slug,
  beginning_balance,
  ending_balance,
  is_interim
FROM public.pf_weekly_balances;

GRANT SELECT ON public.v_pf_weekly_balances TO authenticated;
