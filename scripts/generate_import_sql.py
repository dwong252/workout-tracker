"""
Converts strong_workouts.csv -> migrations/002_import_strong.sql
Run: python scripts/generate_import_sql.py
Then paste the generated SQL into Supabase SQL editor,
replacing YOUR_USER_ID_HERE with your UUID from Auth -> Users.
"""
import csv, re, uuid
from pathlib import Path
from datetime import datetime, timedelta

ROOT     = Path(__file__).parent.parent
CSV_PATH = ROOT / "strong_workouts.csv"
OUT_PATH = ROOT / "migrations" / "002_import_strong.sql"

BODY_PART = {
    "Barbell T Bar Row":                    "Back",
    "Bench Press (Barbell)":                "Chest",
    "Bench Press (Dumbbell)":               "Chest",
    "Bent Over Row (Barbell)":              "Back",
    "Bicep Curl (Barbell)":                 "Arms",
    "Bicep Curl (Dumbbell)":                "Arms",
    "Bicep Curl (Machine)":                 "Arms",
    "Cable Shrug":                          "Back",
    "Chest Fly":                            "Chest",
    "Chest Fly (Band)":                     "Chest",
    "Chest Press (Machine)":                "Chest",
    "Crunch (Machine)":                     "Core",
    "Decline Hack Squat":                   "Legs",
    "Face Pull (Cable)":                    "Back",
    "Glute Drive":                          "Legs",
    "Hack Squat":                           "Legs",
    "Incline Bench Press (Barbell)":        "Chest",
    "Incline Bench Press (Cable)":          "Chest",
    "Incline Bench Press (Dumbbell)":       "Chest",
    "Incline Chest Press (Machine)":        "Chest",
    "Incline Curl (Dumbbell)":              "Arms",
    "Kneeling Leg Curl":                    "Legs",
    "Lat Pulldown (Cable)":                 "Back",
    "Lateral Raise (Cable)":                "Shoulders",
    "Lateral Raise (Machine)":              "Shoulders",
    "Leg Extension (Machine)":              "Legs",
    "Leg Press":                            "Legs",
    "Lying Leg Curl (Machine)":             "Legs",
    "One Arm Tricep Cable Pushdown":        "Arms",
    "One Leg Lying Leg Curl Machine":       "Legs",
    "Preacher Curl (Barbell)":              "Arms",
    "Preacher Curl (Machine)":              "Arms",
    "Reverse Fly (Machine)":                "Shoulders",
    "Romanian Deadlift (Barbell)":          "Legs",
    "Romanian Deadlift (Dumbbell)":         "Legs",
    "Seated Calf Raise (Plate Loaded)":     "Legs",
    "Seated Lateral Raise":                 "Shoulders",
    "Seated Leg Curl (Machine)":            "Legs",
    "Seated Overhead Press (Dumbbell)":     "Shoulders",
    "Seated Row (Cable)":                   "Back",
    "Seated Row (Machine)":                 "Back",
    "Seated Wide-Grip Row (Cable)":         "Back",
    "Shoulder Press (Machine)":             "Shoulders",
    "Single Leg Extension":                 "Legs",
    "Squat (Barbell)":                      "Legs",
    "Standing Calf Raise (Machine)":        "Legs",
    "Standing Calf Raise (Smith Machine)":  "Legs",
    "T Bar Row":                            "Back",
    "Triceps Extension (Cable)":            "Arms",
    "Triceps Extension (Dumbbell)":         "Arms",
    "Triceps Extension (Machine)":          "Arms",
    "Triceps Pushdown (Cable - Straight Bar)": "Arms",
}

def parse_duration_hours(s):
    h = re.search(r'(\d+)h', s or '')
    m = re.search(r'(\d+)min', s or '')
    total = (int(h.group(1)) if h else 0) + (int(m.group(1)) if m else 0) / 60
    return total if 0 < total <= 5 else 1.0

def q(s):
    return s.replace("'", "''")

# ── Read & filter CSV ─────────────────────────────────────────
rows = []
with open(CSV_PATH, newline='', encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        if row['Set Order'].strip() != 'W':   # skip warm-up sets
            rows.append(row)

# ── Unique exercises ──────────────────────────────────────────
exercise_names = []
seen = set()
for row in rows:
    name = row['Exercise Name'].strip()
    if name not in seen:
        exercise_names.append(name)
        seen.add(name)

# ── Unique workouts ───────────────────────────────────────────
workouts = {}   # key -> {id, name, started_at, ended_at}
for row in rows:
    key = (row['Date'].strip(), row['Workout Name'].strip())
    if key not in workouts:
        started = row['Date'].strip()
        dt = datetime.strptime(started, '%Y-%m-%d %H:%M:%S')
        ended = dt + timedelta(hours=parse_duration_hours(row['Duration'].strip()))
        workouts[key] = {
            'id':         str(uuid.uuid4()),
            'name':       row['Workout Name'].strip(),
            'started_at': started,
            'ended_at':   ended.strftime('%Y-%m-%d %H:%M:%S'),
        }

# ── Sets (grouped for batch INSERT) ──────────────────────────
# Each set stores: (workout_id, exercise_name, set_number, weight, reps)
set_counter = {}
set_rows = []
for row in rows:
    ex_name = row['Exercise Name'].strip()
    wk_key  = (row['Date'].strip(), row['Workout Name'].strip())
    wk_id   = workouts[wk_key]['id']
    try:
        reps   = int(float(row['Reps'].strip()))
        weight = float(row['Weight'].strip() or '0')
    except ValueError:
        continue
    ck = (wk_id, ex_name)
    set_counter[ck] = set_counter.get(ck, 0) + 1
    set_rows.append((wk_id, ex_name, set_counter[ck], weight, reps))

# ── Generate SQL ──────────────────────────────────────────────
lines = [
    "-- ============================================================",
    "-- Strong export import",
    f"-- {len(workouts)} workouts  |  {len(exercise_names)} exercises  |  {len(set_rows)} sets",
    "-- Warm-up sets excluded.",
    "--",
    "-- 1. Replace YOUR_USER_ID_HERE with your UUID (Supabase -> Auth -> Users)",
    "-- 2. Paste this entire file into the Supabase SQL editor and run.",
    "-- ============================================================",
    "",
    "DO $$",
    "DECLARE",
    "  v_uid uuid := 'YOUR_USER_ID_HERE';",
    "BEGIN",
    "",
    "-- ── Step 1: exercises ─────────────────────────────────────────",
    "-- Uses WHERE NOT EXISTS so existing exercises are never duplicated.",
]

for name in exercise_names:
    bp = BODY_PART.get(name, 'Back')
    lines.append(
        f"  INSERT INTO public.exercises (user_id, name, body_part)"
        f" SELECT v_uid, '{q(name)}', '{bp}'"
        f" WHERE NOT EXISTS ("
        f"SELECT 1 FROM public.exercises WHERE user_id = v_uid AND name = '{q(name)}');"
    )

lines += [
    "",
    "-- ── Step 2: workouts ─────────────────────────────────────────",
]
for w in workouts.values():
    lines.append(
        f"  INSERT INTO public.workouts (id, user_id, name, started_at, ended_at)"
        f" VALUES ('{w['id']}', v_uid, '{q(w['name'])}', '{w['started_at']}+00', '{w['ended_at']}+00');"
    )

lines += [
    "",
    "-- ── Step 3: sets ─────────────────────────────────────────────",
    "-- JOIN resolves exercise names -> IDs, handling any name already",
    "-- in your library without needing pre-computed UUIDs.",
]

CHUNK = 150
for i in range(0, len(set_rows), CHUNK):
    chunk = set_rows[i:i+CHUNK]
    vals  = ",\n    ".join(
        f"('{wk_id}'::uuid, '{q(ex_name)}', {sn}, {w}, {r})"
        for wk_id, ex_name, sn, w, r in chunk
    )
    lines.append(
        f"  INSERT INTO public.workout_sets (workout_id, exercise_id, set_number, weight, reps)\n"
        f"  SELECT v.workout_id, e.id, v.set_number, v.weight, v.reps\n"
        f"  FROM (VALUES\n    {vals}\n"
        f"  ) AS v(workout_id, ex_name, set_number, weight, reps)\n"
        f"  JOIN public.exercises e ON e.user_id = v_uid AND e.name = v.ex_name::text;\n"
    )

lines += ["END $$;", ""]

OUT_PATH.write_text("\n".join(lines), encoding='utf-8')

# Stats (ASCII only to avoid Windows cp1252 issues)
print(f"Written to {OUT_PATH}")
print(f"  {len(exercise_names)} exercises")
print(f"  {len(workouts)} workouts")
print(f"  {len(set_rows)} sets (warm-up sets excluded)")
