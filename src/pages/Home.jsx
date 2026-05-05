import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { best1RM, formatWeight, formatShortDate, workoutsThisWeek, workoutsThisMonth, BODY_PART_COLORS } from '../lib/utils'
import Header from '../components/layout/Header'
import Card   from '../components/ui/Card'
import Button from '../components/ui/Button'
import { BodyPartBadge, PRBadge } from '../components/ui/Badge'
import { PageSpinner } from '../components/ui/Spinner'
import { Plus, Play, LogOut, Trophy, Flame } from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()
  const [loading, setLoading]     = useState(true)
  const [templates, setTemplates] = useState([])
  const [workouts, setWorkouts]   = useState([])
  const [prs, setPrs]             = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const [{ data: tmpl }, { data: wkts }, { data: sets }] = await Promise.all([
      supabase
        .from('templates')
        .select('id, name, template_exercises(exercise_id, order_index, exercises(name, body_part))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('workouts')
        .select('id, started_at, ended_at, template_id')
        .eq('user_id', user.id)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(60),

      // Recent sets for PR detection (last 30 days of sets)
      supabase
        .from('workout_sets')
        .select('exercise_id, weight, reps, workouts!inner(user_id, started_at, ended_at, exercises(name, body_part))')
        .eq('workouts.user_id', user.id)
        .not('workouts.ended_at', 'is', null)
        .order('workouts.started_at', { ascending: false })
        .limit(500),
    ])

    setTemplates(tmpl ?? [])
    setWorkouts(wkts ?? [])
    computePRs(sets ?? [])
    setLoading(false)
  }

  function computePRs(sets) {
    // Group sets by exercise, find all-time best 1RM
    const byExercise = {}
    for (const s of sets) {
      const id = s.exercise_id
      if (!byExercise[id]) byExercise[id] = { name: s.workouts?.exercises?.name ?? '', bodyPart: s.workouts?.exercises?.body_part ?? '', sets: [] }
      byExercise[id].sets.push(s)
    }

    // Sort sets by date per exercise, check if most recent workout contains the all-time best
    const prs = []
    for (const [, ex] of Object.entries(byExercise)) {
      if (!ex.sets.length || !ex.name) continue
      const allTime = best1RM(ex.sets)
      // Most recent set for this exercise
      const sorted = [...ex.sets].sort((a, b) =>
        new Date(b.workouts?.started_at) - new Date(a.workouts?.started_at))
      const recentDate = sorted[0]?.workouts?.started_at
      const recentBest = best1RM(sorted.filter(s => s.workouts?.started_at === recentDate))

      if (recentBest >= allTime && allTime > 0) {
        prs.push({
          name: ex.name,
          bodyPart: ex.bodyPart,
          rm: allTime,
          date: recentDate,
        })
      }
    }

    // Sort by most recent PR first, show top 5
    prs.sort((a, b) => new Date(b.date) - new Date(a.date))
    setPrs(prs.slice(0, 5))
  }

  async function startFreeWorkout() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workout } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, name: 'Free Workout' })
      .select()
      .single()
    navigate(`/workout/${workout.id}`)
  }

  async function startTemplateWorkout(template) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workout } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, template_id: template.id, name: template.name })
      .select()
      .single()
    navigate(`/workout/${workout.id}?template=${template.id}`)
  }

  const weekCount  = workoutsThisWeek(workouts)
  const monthCount = workoutsThisMonth(workouts)

  if (loading) return <PageSpinner />

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Workout Tracker"
        large
        right={
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-sys-bg3 dark:bg-white/10 active:opacity-60"
          >
            <LogOut size={16} className="text-sys-label2 dark:text-white/60" />
          </button>
        }
      />

      <div className="flex-1 scroll-content px-4 py-4 space-y-5 pb-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Flame size={16} className="text-ios-orange" />
              <span className="text-xs font-medium text-sys-label2 dark:text-white/50">This week</span>
            </div>
            <p className="text-3xl font-bold text-sys-label dark:text-white">{weekCount}</p>
            <p className="text-xs text-sys-label3 dark:text-white/30">workouts</p>
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Flame size={16} className="text-ios-blue" />
              <span className="text-xs font-medium text-sys-label2 dark:text-white/50">This month</span>
            </div>
            <p className="text-3xl font-bold text-sys-label dark:text-white">{monthCount}</p>
            <p className="text-xs text-sys-label3 dark:text-white/30">workouts</p>
          </Card>
        </div>

        {/* Quick start */}
        <Button fullWidth size="lg" onClick={startFreeWorkout}>
          <Play size={20} className="mr-2" fill="currentColor" />
          Start Empty Workout
        </Button>

        {/* Recent PRs */}
        {prs.length > 0 && (
          <section>
            <SectionHeader title="Recent PRs" icon={<Trophy size={16} className="text-yellow-500" />} />
            <Card padding={false}>
              {prs.map((pr, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-sys-label dark:text-white">{pr.name}</p>
                      <p className="text-xs text-sys-label2 dark:text-white/50">{formatShortDate(pr.date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <BodyPartBadge bodyPart={pr.bodyPart} />
                      <PRBadge />
                      <span className="text-sm font-bold text-ios-blue">{formatWeight(pr.rm)} kg 1RM</span>
                    </div>
                  </div>
                  {i < prs.length - 1 && <div className="ios-separator ml-4" />}
                </div>
              ))}
            </Card>
          </section>
        )}

        {/* Templates */}
        <section>
          <SectionHeader
            title="Templates"
            right={
              <button onClick={() => navigate('/templates')} className="text-ios-blue text-sm active:opacity-60">
                Manage
              </button>
            }
          />
          {templates.length === 0 ? (
            <Card>
              <p className="text-sys-label2 dark:text-white/50 text-sm text-center py-2">
                No templates yet — create your first one.
              </p>
              <Button fullWidth variant="secondary" onClick={() => navigate('/templates')} className="mt-3">
                <Plus size={16} className="mr-1" /> Create Template
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <TemplateCard key={t.id} template={t} onStart={() => startTemplateWorkout(t)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function SectionHeader({ title, icon, right }) {
  return (
    <div className="flex items-center justify-between mb-2 px-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <h2 className="text-base font-semibold text-sys-label dark:text-white">{title}</h2>
      </div>
      {right}
    </div>
  )
}

function TemplateCard({ template, onStart }) {
  const exercises = template.template_exercises ?? []
  const bodyParts = [...new Set(exercises.map(te => te.exercises?.body_part).filter(Boolean))]

  return (
    <Card padding={false} className="flex items-center gap-3 pr-3">
      <button
        onClick={onStart}
        className="flex-1 flex items-center gap-3 p-4 text-left active:opacity-60"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sys-label dark:text-white truncate">{template.name}</p>
          <p className="text-xs text-sys-label2 dark:text-white/50 mt-0.5">
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {bodyParts.map(bp => (
              <span
                key={bp}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${BODY_PART_COLORS[bp]}22`, color: BODY_PART_COLORS[bp] }}
              >
                {bp}
              </span>
            ))}
          </div>
        </div>
      </button>
      <button
        onClick={onStart}
        className="w-10 h-10 rounded-full bg-ios-blue flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
      >
        <Play size={18} className="text-white ml-0.5" fill="white" />
      </button>
    </Card>
  )
}
