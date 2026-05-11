import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { best1RM, totalVolume, formatShortDate, BODY_PARTS, BODY_PART_COLORS } from '../lib/utils'
import { startOfWeek, format, eachWeekOfInterval, subWeeks } from 'date-fns'
import Header from '../components/layout/Header'
import Card   from '../components/ui/Card'
import { PageSpinner } from '../components/ui/Spinner'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell,
} from 'recharts'

export default function Progress() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('frequency') // frequency | bodypart | exercises
  const [workouts, setWorkouts]       = useState([])
  const [sets, setSets]               = useState([])
  const [exercises, setExercises]     = useState([])
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [exerciseChartTab, setExerciseChartTab] = useState('1rm')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const [{ data: wkts }, { data: rawSets }, { data: exs }] = await Promise.all([
      supabase
        .from('workouts')
        .select('id, started_at, ended_at')
        .eq('user_id', user.id)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: true }),
      supabase
        .from('workout_sets')
        .select('exercise_id, weight, reps, workouts!inner(started_at, ended_at, user_id)')
        .eq('workouts.user_id', user.id)
        .not('workouts.ended_at', 'is', null),
      supabase
        .from('exercises')
        .select('id, name, body_part')
        .eq('user_id', user.id)
        .order('body_part').order('name'),
    ])

    setWorkouts(wkts ?? [])
    setSets(rawSets ?? [])
    setExercises(exs ?? [])
    if (exs?.length > 0) setSelectedExercise(exs[0])
    setLoading(false)
  }

  if (loading) return <PageSpinner />

  // ── Frequency chart: workouts per week (last 12 weeks) ──────
  function frequencyData() {
    const weeks = eachWeekOfInterval(
      { start: subWeeks(new Date(), 11), end: new Date() },
      { weekStartsOn: 1 }
    )
    return weeks.map(weekStart => {
      const label = format(weekStart, 'MMM d')
      const count = workouts.filter(w => {
        const ws = startOfWeek(new Date(w.started_at), { weekStartsOn: 1 })
        return ws.getTime() === weekStart.getTime()
      }).length
      return { label, count }
    })
  }

  // ── Body-part volume: total vol per body-part last 30 days ──
  function bodyPartData() {
    const cutoff = subWeeks(new Date(), 4)
    const volByBP = {}
    for (const bp of BODY_PARTS) volByBP[bp] = 0

    for (const s of sets) {
      const date = s.workouts?.started_at
      if (!date || new Date(date) < cutoff) continue
      const ex = exercises.find(e => e.id === s.exercise_id)
      if (!ex) continue
      volByBP[ex.body_part] = (volByBP[ex.body_part] ?? 0) + (s.weight || 0) * (s.reps || 0)
    }

    return BODY_PARTS.map(bp => ({
      label: bp,
      volume: Math.round(volByBP[bp] / 1000), // tonnes
      color: BODY_PART_COLORS[bp],
    })).filter(d => d.volume > 0).sort((a, b) => b.volume - a.volume)
  }

  // ── Per-exercise history ────────────────────────────────────
  function exerciseChartData() {
    if (!selectedExercise) return []

    const byWorkout = {}
    for (const s of sets) {
      if (s.exercise_id !== selectedExercise.id) continue
      const date = s.workouts?.started_at
      if (!date) continue
      if (!byWorkout[date]) byWorkout[date] = { date, sets: [] }
      byWorkout[date].sets.push({ weight: Number(s.weight), reps: s.reps })
    }

    return Object.values(byWorkout)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(w => ({
        label: formatShortDate(w.date),
        '1RM':    Math.round(best1RM(w.sets) * 10) / 10,
        'Volume': Math.round(totalVolume(w.sets)),
        'Weight': Math.max(...w.sets.map(s => s.weight || 0)),
      }))
  }

  const freqData = frequencyData()
  const bpData   = bodyPartData()
  const exData   = exerciseChartData()
  const exColor  = BODY_PART_COLORS[selectedExercise?.body_part] ?? '#007AFF'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Progress" large />

      <div className="flex-1 scroll-content px-4 py-4 space-y-4">
        {/* Top-level tab switcher */}
        <div className="flex gap-1 bg-sys-bg3 dark:bg-white/10 rounded-ios p-1">
          {[['frequency','Frequency'],['bodypart','By Muscle'],['exercises','Exercises']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-1.5 rounded-[8px] text-xs font-semibold transition-colors
                ${tab === key ? 'bg-sys-bg2 dark:bg-white/10 text-sys-label dark:text-white shadow-ios-sm' : 'text-sys-label2 dark:text-white/50'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Frequency ── */}
        {tab === 'frequency' && (
          <>
            <SectionCard title="Workouts per Week" subtitle="Last 12 weeks">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={freqData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#1C1C1E', border: 'none', borderRadius: 10, fontSize: 12, color: '#fff' }}
                    formatter={(v) => [v, 'Workouts']}
                  />
                  <Bar dataKey="count" fill="#007AFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            <Card>
              <p className="text-sm font-semibold text-sys-label dark:text-white mb-2">Overview</p>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Total workouts" value={workouts.length} />
                <Stat label="This month" value={workouts.filter(w => {
                  const d = new Date(w.started_at)
                  const now = new Date()
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                }).length} />
                <Stat label="This week" value={workouts.filter(w => {
                  const ws = startOfWeek(new Date(w.started_at), { weekStartsOn: 1 })
                  const tw = startOfWeek(new Date(), { weekStartsOn: 1 })
                  return ws.getTime() === tw.getTime()
                }).length} />
                <Stat label="Best week" value={Math.max(0, ...freqData.map(d => d.count))} suffix="workouts" />
              </div>
            </Card>
          </>
        )}

        {/* ── Body Part Volume ── */}
        {tab === 'bodypart' && (
          <>
            <SectionCard title="Volume by Muscle" subtitle="Last 4 weeks (in tonnes = 1,000 lb)">
              {bpData.length === 0 ? (
                <p className="text-sys-label2 dark:text-white/50 text-sm py-6 text-center">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={bpData} layout="vertical" margin={{ top: 4, right: 20, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#00000010" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="t" />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={65} />
                    <Tooltip
                      contentStyle={{ background: '#1C1C1E', border: 'none', borderRadius: 10, fontSize: 12, color: '#fff' }}
                      formatter={(v) => [`${v} tonnes`, 'Volume']}
                    />
                    <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
                      {bpData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </>
        )}

        {/* ── Per-exercise ── */}
        {tab === 'exercises' && (
          <>
            {/* Exercise picker */}
            <div>
              <p className="text-xs font-medium text-sys-label2 dark:text-white/50 uppercase tracking-wide px-1 mb-2">Exercise</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {exercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => { setSelectedExercise(ex); setExerciseChartTab('1rm') }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors active:opacity-70 ${
                      selectedExercise?.id === ex.id
                        ? 'bg-ios-blue text-white'
                        : 'bg-sys-bg3 dark:bg-white/10 text-sys-label2 dark:text-white/50'
                    }`}
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedExercise && (
              <SectionCard
                title={selectedExercise.name}
                subtitle={selectedExercise.body_part}
                action={
                  <button
                    onClick={() => navigate(`/exercises/${selectedExercise.id}`)}
                    className="text-ios-blue text-xs active:opacity-60"
                  >
                    Details
                  </button>
                }
              >
                {/* Chart type tabs */}
                <div className="flex gap-1 bg-sys-bg dark:bg-black/20 rounded-ios p-1 mb-4">
                  {[['1rm','1RM'],['weight','Weight'],['volume','Volume']].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setExerciseChartTab(key)}
                      className={`flex-1 py-1 rounded-[8px] text-xs font-semibold transition-colors
                        ${exerciseChartTab === key ? 'bg-sys-bg2 dark:bg-white/10 text-sys-label dark:text-white shadow-ios-sm' : 'text-sys-label2 dark:text-white/50'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {exData.length <= 1 ? (
                  <p className="text-sys-label2 dark:text-white/50 text-sm py-6 text-center">
                    Need at least 2 sessions to show a chart.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={exData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#1C1C1E', border: 'none', borderRadius: 10, fontSize: 12, color: '#fff' }}
                      />
                      <Line
                        type="monotone"
                        dataKey={exerciseChartTab === '1rm' ? '1RM' : exerciseChartTab === 'volume' ? 'Volume' : 'Weight'}
                        stroke={exColor}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0, fill: exColor }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SectionCard({ title, subtitle, children, action }) {
  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-sys-label dark:text-white">{title}</p>
          {subtitle && <p className="text-xs text-sys-label2 dark:text-white/50">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

function Stat({ label, value, suffix }) {
  return (
    <div>
      <p className="text-2xl font-bold text-sys-label dark:text-white">
        {value}{suffix ? <span className="text-xs ml-1 text-sys-label2 dark:text-white/50 font-normal">{suffix}</span> : ''}
      </p>
      <p className="text-xs text-sys-label2 dark:text-white/50">{label}</p>
    </div>
  )
}
