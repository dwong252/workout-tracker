import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { epley1RM, best1RM, totalVolume, formatWeight, formatShortDate, BODY_PART_COLORS } from '../lib/utils'
import Header from '../components/layout/Header'
import Card   from '../components/ui/Card'
import { PageSpinner } from '../components/ui/Spinner'
import { BodyPartBadge, PRBadge } from '../components/ui/Badge'
import { Trophy, TrendingUp, Layers } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts'

export default function ExerciseDetail() {
  const { id } = useParams()
  const [loading, setLoading]   = useState(true)
  const [exercise, setExercise] = useState(null)
  const [history, setHistory]   = useState([])   // [{date, sets, volume, best1RM}]
  const [tab, setTab]           = useState('1rm') // '1rm' | 'volume' | 'weight'

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)

    const [{ data: ex }, { data: sets }] = await Promise.all([
      supabase.from('exercises').select('*').eq('id', id).single(),
      supabase
        .from('workout_sets')
        .select('weight, reps, workouts!inner(id, started_at, ended_at)')
        .eq('exercise_id', id)
        .not('workouts.ended_at', 'is', null)
        .order('workouts.started_at', { ascending: true }),
    ])

    setExercise(ex)

    // Group sets by workout date
    const byWorkout = {}
    for (const s of sets ?? []) {
      const date = s.workouts?.started_at
      const wid  = s.workouts?.id
      if (!date) continue
      if (!byWorkout[wid]) byWorkout[wid] = { date, sets: [] }
      byWorkout[wid].sets.push({ weight: Number(s.weight), reps: s.reps })
    }

    const hist = Object.values(byWorkout)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(w => ({
        date: w.date,
        label: formatShortDate(w.date),
        best1RM: best1RM(w.sets),
        maxWeight: Math.max(...w.sets.map(s => s.weight || 0)),
        volume: totalVolume(w.sets),
        setsCount: w.sets.length,
        sets: w.sets,
      }))

    setHistory(hist)
    setLoading(false)
  }

  if (loading) return <PageSpinner />
  if (!exercise) return null

  const allTimePR   = history.length ? Math.max(...history.map(h => h.best1RM)) : 0
  const latestEntry = history[history.length - 1]
  const color       = BODY_PART_COLORS[exercise.body_part] ?? '#007AFF'

  const chartData = history.map(h => ({
    label: h.label,
    '1RM':    h.best1RM,
    'Volume': Math.round(h.volume),
    'Weight': h.maxWeight,
  }))

  const chartKey   = tab === '1rm' ? '1RM' : tab === 'volume' ? 'Volume' : 'Weight'
  const chartLabel = tab === '1rm' ? 'Est. 1RM (kg)' : tab === 'volume' ? 'Volume (kg)' : 'Max Weight (kg)'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={exercise.name} back="Exercises" />

      <div className="flex-1 scroll-content px-4 py-4 space-y-4">
        {/* Header stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <BodyPartBadge bodyPart={exercise.body_part} />
          {allTimePR > 0 && (
            <>
              <PRBadge />
              <span className="text-sm font-semibold text-sys-label dark:text-white">
                {formatWeight(allTimePR)} kg 1RM
              </span>
            </>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Sessions" value={history.length} icon={<Layers size={14} className="text-ios-blue" />} />
          <StatCard label="Best 1RM" value={allTimePR > 0 ? `${formatWeight(allTimePR)} kg` : '—'} icon={<Trophy size={14} className="text-yellow-500" />} />
          <StatCard
            label="Best Weight"
            value={latestEntry ? `${formatWeight(latestEntry.maxWeight)} kg` : '—'}
            icon={<TrendingUp size={14} className="text-ios-green" />}
          />
        </div>

        {/* Chart */}
        {history.length > 1 && (
          <Card>
            {/* Tab switcher */}
            <div className="flex gap-1 bg-sys-bg dark:bg-black/20 rounded-ios p-1 mb-4">
              {[['1rm','1RM'],['weight','Weight'],['volume','Volume']].map(([key, label]) => (
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

            <p className="text-xs text-sys-label3 dark:text-white/30 mb-2">{chartLabel}</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={color} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#1C1C1E',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: 12,
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartKey}
                  stroke={color}
                  strokeWidth={2.5}
                  fill="url(#chartGrad)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: color }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* History */}
        {history.length === 0 ? (
          <Card>
            <p className="text-sys-label2 dark:text-white/50 text-sm text-center py-4">
              No workout history yet for this exercise.
            </p>
          </Card>
        ) : (
          <section>
            <p className="text-sm font-semibold text-sys-label dark:text-white mb-2 px-1">History</p>
            <div className="space-y-2">
              {[...history].reverse().map((h, i) => {
                const isPR = h.best1RM >= allTimePR && allTimePR > 0
                return (
                  <Card key={i}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-sys-label dark:text-white">{h.label}</p>
                        <p className="text-xs text-sys-label2 dark:text-white/50">{h.setsCount} set{h.setsCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPR && <PRBadge />}
                        <span className="text-sm font-bold" style={{ color }}>
                          {formatWeight(h.best1RM)} kg
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {h.sets.map((s, j) => (
                        <span key={j} className="text-xs text-sys-label2 dark:text-white/60">
                          <span className="font-semibold text-sys-label dark:text-white">{formatWeight(s.weight)} × {s.reps}</span>
                        </span>
                      ))}
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-center gap-1">{icon}<span className="text-[10px] text-sys-label2 dark:text-white/50">{label}</span></div>
      <p className="text-sm font-bold text-sys-label dark:text-white">{value}</p>
    </Card>
  )
}
