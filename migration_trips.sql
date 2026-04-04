-- Таблица командировочных расходов ЦК
-- Выполнить в Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS calculation_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id uuid NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
  days integer NOT NULL DEFAULT 1,
  accommodation numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  sum numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Индекс для быстрой выборки по calculation_id
CREATE INDEX IF NOT EXISTS idx_calculation_trips_calc_id ON calculation_trips(calculation_id);

-- RLS (если включён)
ALTER TABLE calculation_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read trips"
  ON calculation_trips FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Competence center can manage trips"
  ON calculation_trips FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('competence_center', 'admin')
    )
  );
