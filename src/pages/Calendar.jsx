import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BODY_PART_COLORS, formatDuration, formatTime } from '../lib/utils'
import {
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  format, isSameDay, isSameMonth, addMonths, subMonths, parseISO,
} from 'date-fns'
import Header from '../components/layout/Header'
import Card   from '../components/ui/Card'
import Modal  from '../components/ui/Modal'
import { PageSpinner } from '../components/ui/Spinner'
import { BodyPartBadge } from '../components/ui/Badge'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Calendar() {
  const [loading, setLoading]       = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [workoutMap, setWorkoutMap] = useState({})  // { 'YYYY-MM-DD': [{...workout data}] }
  const [exercises, setExercises]   = useState({})  // { exercise_id: exercise }
  const [selected, setSelected]     = useState(null) // selected day's workouts
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => { load() }, [currentMonth])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const monthStart = startOfMonth(currentMonth)
    const monthEnd   = endOfMonth(currentMonth)

    const [{ data: wkts }, { data: exs }] = await Promise.all([
      supabase
        .from('workouts')
        .select('id, name, started_at, ended_at, template_id')
        .eq('user_id', user.id)
        .not('ended_at', 'is', null)
        .gte('started_at', monthStart.toISOString())
        .lte('started_at', monthEnd.toISOString()),
      supabase
        .from('exercises')
        .select('id, name, body_part')
        .eq('user_id', user.id),
    ])

    const exerciseMap = {}
    for (const ex of exs ?? []) exerciseMap[ex.id] = ex
    setExercises(exerciseMap)

    if ((wkts ?? []).length === 0) {
      setWorkoutMap({})
      setLoading(false)
      return
    }

    // Fetch sets for all workouts in this month
    const workoutIds = (wkts ?? []).map(w => w.id)
    const { data: sets } = await supabase
      .from('workout_sets')
      .select('workout_id, exercise_id')
      .in('workout_id', workoutIds)

    // Map: workout_id → unique body parts
    const bpByWorkout = {}
    for (const s of sets ?? []) {
      const ex = exerciseMap[s.exercise_id]
      if (!ex) continue
      if (!bpByWorkout[s.workout_id]) bpByWorkout[s.workout_id] = new Set()
      bpByWorkout[s.workout_id].add(ex.body_part)
    }

    // Build day map
    const dayMap = {}
    for (const w of wkts ?? []) {
      const key = format(parseISO(w.started_at), 'yyyy-MM-dd')
      if (!dayMap[key]) dayMap[key] = []
      dayMap[key].push({
        ...w,
        bodyParts: [...(bpByWorkout[w.id] ?? [])],
      })
    }

    setWorkoutMap(dayMap)
    setLoading(false)
  }

  // Load detail for selected day (including sets)
  async function selectDay(date) {
    const key = format(date, 'yyyy-MM-dd')
    const dayWorkouts = workoutMap[key]
    if (!dayWorkouts || dayWorkouts.length === 0) return

    const workoutIds = dayWorkouts.map(w => w.id)
    const { data: sets } = await supabase
      .from('workout_sets')
      .select('workout_id, exercise_id, set_number, weight, reps')
      .in('workout_id', workoutIds)
      .order('set_number')

    // Group sets by workout → exercise
    const detail = dayWorkouts.map(w => {
      const workoutSets = (sets ?? []).filter(s => s.workout_id === w.id)
      const byExercise = {}
      for (const s of workoutSets) {
        if (!byExercise[s.exercise_id]) byExercise[s.exercise_id] = []
        byExercise[s.exercise_id].push(s)
      }
      return {
        ...w,
        exercises: Object.entries(byExercise).map(([eid, sts]) => ({
          exercise: exercises[eid],
          sets: sts,
        })),
      }
    })

    setSelectedDate(date)
    setSelected(detail)
  }

  // Calendar grid
  const monthStart  = startOfMonth(currentMonth)
  const monthEnd    = endOfMonth(currentMonth)
  const calStart    = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd      = endOfWeek(monthEnd,     { weekStartsOn: 1 })
  const calDays     = eachDayOfInterval({ start: calStart, end: calEnd })

  const today = new Date()

  if (loading) return <PageSpinner />

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Calendar" large />

      <div className="flex-1 scroll-content px-4 py-4 space-y-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="w-9 h-9 flex items-center justify-center rounded-full bg-sys-bg3 dark:bg-white/10 active:opacity-60">
            <ChevronLeft size={18} className="text-sys-label dark:text-white" />
          </button>
          <p className="text-base font-semibold text-sys-label dark:text-white">
            {format(currentMonth, 'MMMM yyyy')}
          </p>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="w-9 h-9 flex items-center justify-center rounded-full bg-sys-bg3 dark:bg-white/10 active:opacity-60">
            <ChevronRight size={18} className="text-sys-label dark:text-white" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-1">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-sys-label3 dark:text-white/30">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calDays.map(day => {
            const key       = format(day, 'yyyy-MM-dd')
            const dayData   = workoutMap[key] ?? []
            const isToday   = isSameDay(day, today)
            const inMonth   = isSameMonth(day, currentMonth)
            const hasWorkout = dayData.length > 0
            // Unique body parts for this day
            const bps = [...new Set(dayData.flatMap(w => w.bodyParts))]

            return (
              <button
                key={key}
                onClick={() => hasWorkout && selectDay(day)}
                disabled={!hasWorkout}
                className={`flex flex-col items-center rounded-ios py-1.5 min-h-[52px] transition-colors active:opacity-70
                  ${isToday ? 'bg-ios-blue text-white' : hasWorkout ? 'bg-sys-bg2 dark:bg-[#2C2C2E]' : 'bg-transparent'}
                  ${!inMonth ? 'opacity-30' : ''}
                `}
              >
                <span className={`text-xs font-semibold ${isToday ? 'text-white' : 'text-sys-label dark:text-white'}`}>
                  {format(day, 'd')}
                </span>
                {/* Body-part dots */}
                {bps.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-0.5 mt-1 max-w-[36px]">
                    {bps.slice(0, 4).map(bp => (
                      <div
                        key={bp}
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: isToday ? 'white' : BODY_PART_COLORS[bp] }}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <Card>
          <p className="text-xs font-semibold text-sys-label2 dark:text-white/50 mb-2">Body Part Key</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {Object.entries(BODY_PART_COLORS).map(([bp, color]) => (
              <div key={bp} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-sys-label dark:text-white">{bp}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Day detail sheet */}
      {selected && (
        <Modal
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          title={selectedDate ? format(selectedDate, 'EEEE, MMM d') : ''}
          fullHeight
        >
          <div className="space-y-4">
            {selected.map((workout, wi) => (
              <WorkoutDetail key={wi} workout={workout} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

function WorkoutDetail({ workout }) {
  return (
    <div>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-sys-label dark:text-white">{workout.name ?? 'Workout'}</p>
          <p className="text-xs text-sys-label2 dark:text-white/50">
            {formatTime(workout.started_at)}
            {workout.ended_at && ` · ${formatDuration(workout.started_at, workout.ended_at)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 max-w-[120px] justify-end">
          {workout.bodyParts.map(bp => (
            <span key={bp} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BODY_PART_COLORS[bp] }} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {workout.exercises.map(({ exercise, sets }, ei) => {
          if (!exercise) return null
          return (
            <div key={ei} className="bg-sys-bg dark:bg-black/20 rounded-ios p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <BodyPartBadge bodyPart={exercise.body_part} />
                <p className="text-sm font-semibold text-sys-label dark:text-white">{exercise.name}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {sets.map((s, si) => (
                  <span key={si} className="text-xs text-sys-label2 dark:text-white/60">
                    <span className="font-semibold text-sys-label dark:text-white">{s.weight} × {s.reps}</span>
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
