-- ============================================================
-- Workout Tracker – Initial Schema
-- Paste this entire file into the Supabase SQL editor and run.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.exercises (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  body_part  text NOT NULL CHECK (body_part IN (
               'Chest','Back','Shoulders','Legs','Arms','Core','Cardio')),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ordered list of exercises inside a template
CREATE TABLE IF NOT EXISTS public.template_exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  order_index  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- A logged workout session
CREATE TABLE IF NOT EXISTS public.workouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.templates(id),
  name        text,          -- override or free-style name
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Each set logged during a workout (one row per set)
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id),
  set_number  integer NOT NULL DEFAULT 1,
  weight      numeric(6,2),   -- kg or lb, user decides
  reps        integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS exercises_user_id_idx   ON public.exercises(user_id);
CREATE INDEX IF NOT EXISTS templates_user_id_idx   ON public.templates(user_id);
CREATE INDEX IF NOT EXISTS workouts_user_id_idx    ON public.workouts(user_id);
CREATE INDEX IF NOT EXISTS workouts_started_at_idx ON public.workouts(started_at DESC);
CREATE INDEX IF NOT EXISTS workout_sets_workout_idx   ON public.workout_sets(workout_id);
CREATE INDEX IF NOT EXISTS workout_sets_exercise_idx  ON public.workout_sets(exercise_id);
CREATE INDEX IF NOT EXISTS template_exercises_tpl_idx ON public.template_exercises(template_id);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.exercises        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets     ENABLE ROW LEVEL SECURITY;

-- exercises
CREATE POLICY exercises_owner ON public.exercises
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- templates
CREATE POLICY templates_owner ON public.templates
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- template_exercises (access via parent template)
CREATE POLICY template_exercises_owner ON public.template_exercises
  USING (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_exercises.template_id
        AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_exercises.template_id
        AND t.user_id = auth.uid()
    )
  );

-- workouts
CREATE POLICY workouts_owner ON public.workouts
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- workout_sets (access via parent workout)
CREATE POLICY workout_sets_owner ON public.workout_sets
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_sets.workout_id
        AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_sets.workout_id
        AND w.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- HELPER RPC: last completed sets for a list of exercises
-- Used by Active Workout to show "what you did last time"
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_last_sets_for_exercises(
  p_exercise_ids uuid[]
)
RETURNS TABLE (
  exercise_id  uuid,
  workout_id   uuid,
  workout_date timestamptz,
  set_number   integer,
  weight       numeric,
  reps         integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- For each exercise, find the most recent *completed* workout that
  -- included it, then return all sets from that workout+exercise.
  WITH last_workouts AS (
    SELECT DISTINCT ON (ws.exercise_id)
      ws.exercise_id,
      w.id   AS workout_id,
      w.started_at AS workout_date
    FROM workout_sets ws
    JOIN workouts w ON w.id = ws.workout_id
    WHERE ws.exercise_id = ANY(p_exercise_ids)
      AND w.user_id   = auth.uid()
      AND w.ended_at IS NOT NULL
    ORDER BY ws.exercise_id, w.started_at DESC
  )
  SELECT
    lw.exercise_id,
    lw.workout_id,
    lw.workout_date,
    ws.set_number,
    ws.weight,
    ws.reps
  FROM last_workouts lw
  JOIN workout_sets ws
    ON  ws.workout_id  = lw.workout_id
    AND ws.exercise_id = lw.exercise_id
  ORDER BY lw.exercise_id, ws.set_number;
$$;

-- ─────────────────────────────────────────────────────────────
-- SEED: common exercises (runs only if exercises table is empty
-- for the current user — safe to re-run after first login via
-- a trigger, but here we use a simple unconditional insert that
-- you'll associate with your user_id manually, OR you can run
-- the seed after signing up using the SEED_EXERCISES function
-- below which fires for the authenticated user).
-- ─────────────────────────────────────────────────────────────

-- Function you can call once after signing up.
-- Pass your user ID explicitly (find it in Supabase → Auth → Users):
--   SELECT seed_default_exercises('paste-your-user-uuid-here');
CREATE OR REPLACE FUNCTION public.seed_default_exercises(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.exercises (user_id, name, body_part) VALUES
    -- Chest
    (p_user_id, 'Bench Press',             'Chest'),
    (p_user_id, 'Incline Bench Press',     'Chest'),
    (p_user_id, 'Decline Bench Press',     'Chest'),
    (p_user_id, 'Dumbbell Fly',            'Chest'),
    (p_user_id, 'Cable Crossover',         'Chest'),
    (p_user_id, 'Push-Up',                 'Chest'),
    (p_user_id, 'Chest Dip',               'Chest'),
    -- Back
    (p_user_id, 'Deadlift',                'Back'),
    (p_user_id, 'Barbell Row',             'Back'),
    (p_user_id, 'Pull-Up',                 'Back'),
    (p_user_id, 'Lat Pulldown',            'Back'),
    (p_user_id, 'Seated Cable Row',        'Back'),
    (p_user_id, 'T-Bar Row',               'Back'),
    (p_user_id, 'Single-Arm Dumbbell Row', 'Back'),
    (p_user_id, 'Face Pull',               'Back'),
    -- Shoulders
    (p_user_id, 'Overhead Press',          'Shoulders'),
    (p_user_id, 'Arnold Press',            'Shoulders'),
    (p_user_id, 'Lateral Raise',           'Shoulders'),
    (p_user_id, 'Front Raise',             'Shoulders'),
    (p_user_id, 'Rear Delt Fly',           'Shoulders'),
    (p_user_id, 'Upright Row',             'Shoulders'),
    -- Legs
    (p_user_id, 'Squat',                   'Legs'),
    (p_user_id, 'Front Squat',             'Legs'),
    (p_user_id, 'Romanian Deadlift',       'Legs'),
    (p_user_id, 'Leg Press',               'Legs'),
    (p_user_id, 'Leg Extension',           'Legs'),
    (p_user_id, 'Leg Curl',                'Legs'),
    (p_user_id, 'Calf Raise',              'Legs'),
    (p_user_id, 'Hack Squat',              'Legs'),
    (p_user_id, 'Bulgarian Split Squat',   'Legs'),
    (p_user_id, 'Walking Lunge',           'Legs'),
    -- Arms
    (p_user_id, 'Barbell Curl',            'Arms'),
    (p_user_id, 'Dumbbell Curl',           'Arms'),
    (p_user_id, 'Hammer Curl',             'Arms'),
    (p_user_id, 'Preacher Curl',           'Arms'),
    (p_user_id, 'Tricep Pushdown',         'Arms'),
    (p_user_id, 'Skull Crusher',           'Arms'),
    (p_user_id, 'Overhead Tricep Extension','Arms'),
    (p_user_id, 'Tricep Dip',              'Arms'),
    (p_user_id, 'Close-Grip Bench Press',  'Arms'),
    -- Core
    (p_user_id, 'Plank',                   'Core'),
    (p_user_id, 'Crunch',                  'Core'),
    (p_user_id, 'Cable Crunch',            'Core'),
    (p_user_id, 'Leg Raise',               'Core'),
    (p_user_id, 'Russian Twist',           'Core'),
    (p_user_id, 'Ab Wheel Rollout',        'Core'),
    (p_user_id, 'Side Plank',              'Core'),
    -- Cardio
    (p_user_id, 'Running',                 'Cardio'),
    (p_user_id, 'Cycling',                 'Cardio'),
    (p_user_id, 'Rowing Machine',          'Cardio'),
    (p_user_id, 'Jump Rope',               'Cardio'),
    (p_user_id, 'Elliptical',              'Cardio'),
    (p_user_id, 'Stairmaster',             'Cardio')
  ON CONFLICT DO NOTHING;
$$;
