import { useEffect, useReducer, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { epley1RM, formatWeight, formatShortDate, BODY_PART_COLORS } from '../lib/utils'
import Header from '../components/layout/Header'
import Card   from '../components/ui/Card'
import Button from '../components/ui/Button'
import { SetInput } from '../components/ui/Input'
import Modal, { ConfirmDialog } from '../components/ui/Modal'
import { PageSpinner } from '../components/ui/Spinner'
import { BodyPartBadge } from '../components/ui/Badge'
import { Plus, Check, ChevronDown, ChevronUp, Flag, X, Clock } from 'lucide-react'

// ── State shape ───────────────────────────────────────────────
// exercises: [{ exercise, sets: [{weight,reps,saved_id}], lastSets, lastDate, skipped, collapsed }]

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...state, exercises: action.exercises, workoutId: action.workoutId, startedAt: action.startedAt }

    case 'ADD_SET': {
      const exercises = state.exercises.map((ex, i) =>
        i === action.idx
          ? { ...ex, sets: [...ex.sets, { weight: '', reps: '', saved_id: null }] }
          : ex
      )
      return { ...state, exercises }
    }

    case 'UPDATE_SET': {
      const exercises = state.exercises.map((ex, i) =>
        i === action.idx
          ? { ...ex, sets: ex.sets.map((s, j) => j === action.setIdx ? { ...s, [action.field]: action.value } : s) }
          : ex
      )
      return { ...state, exercises }
    }

    case 'REMOVE_SET': {
      const exercises = state.exercises.map((ex, i) =>
        i === action.idx
          ? { ...ex, sets: ex.sets.filter((_, j) => j !== action.setIdx) }
          : ex
      )
      return { ...state, exercises }
    }

    case 'SET_SAVED_ID': {
      const exercises = state.exercises.map((ex, i) =>
        i === action.idx
          ? { ...ex, sets: ex.sets.map((s, j) => j === action.setIdx ? { ...s, saved_id: action.id } : s) }
          : ex
      )
      return { ...state, exercises }
    }

    case 'TOGGLE_SKIP': {
      const exercises = state.exercises.map((ex, i) =>
        i === action.idx ? { ...ex, skipped: !ex.skipped } : ex
      )
      return { ...state, exercises }
    }

    case 'TOGGLE_COLLAPSE': {
      const exercises = state.exercises.map((ex, i) =>
        i === action.idx ? { ...ex, collapsed: !ex.collapsed } : ex
      )
      return { ...state, exercises }
    }

    case 'ADD_EXERCISE':
      return { ...state, exercises: [...state.exercises, action.exercise] }

    default:
      return state
  }
}

const initialState = { exercises: [], workoutId: null, startedAt: null }

export default function ActiveWorkout() {
  const { id: workoutId } = useParams()
  const [searchParams]    = useSearchParams()
  const templateId        = searchParams.get('template')
  const navigate          = useNavigate()

  const [state, dispatch]             = useReducer(reducer, initialState)
  const [loading, setLoading]         = useState(true)
  const [confirmEnd, setConfirmEnd]   = useState(false)
  const [addExerciseOpen, setAddExerciseOpen] = useState(false)
  const [allExercises, setAllExercises]       = useState([])
  const [elapsed, setElapsed]         = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!state.startedAt) return
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(state.startedAt)) / 1000))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [state.startedAt])

  useEffect(() => { load() }, [workoutId])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: workout } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .single()

    if (!workout || workout.ended_at) { navigate('/'); return }

    const { data: allExs } = await supabase
      .from('exercises')
      .select('id, name, body_part')
      .eq('user_id', user.id)
      .order('body_part').order('name')
    setAllExercises(allExs ?? [])

    let exerciseList = []

    if (templateId) {
      const { data: te } = await supabase
        .from('template_exercises')
        .select('order_index, exercises(id, name, body_part)')
        .eq('template_id', templateId)
        .order('order_index')
      exerciseList = (te ?? []).map(row => row.exercises)
    }

    const { data: existingSets } = await supabase
      .from('workout_sets')
      .select('id, exercise_id, set_number, weight, reps, exercises(id, name, body_part)')
      .eq('workout_id', workoutId)
      .order('set_number')

    for (const s of existingSets ?? []) {
      if (!exerciseList.find(e => e.id === s.exercise_id)) {
        exerciseList.push(s.exercises)
      }
    }

    const exerciseIds = exerciseList.map(e => e.id)
    const { data: lastSets } = exerciseIds.length
      ? await supabase.rpc('get_last_sets_for_exercises', { p_exercise_ids: exerciseIds })
      : { data: [] }

    const lastByExercise = {}
    for (const s of lastSets ?? []) {
      if (!lastByExercise[s.exercise_id]) {
        lastByExercise[s.exercise_id] = { date: s.workout_date, sets: [] }
      }
      lastByExercise[s.exercise_id].sets.push(s)
    }

    const existingByExercise = {}
    for (const s of existingSets ?? []) {
      if (!existingByExercise[s.exercise_id]) existingByExercise[s.exercise_id] = []
      existingByExercise[s.exercise_id].push({
        weight: s.weight?.toString() ?? '',
        reps: s.reps?.toString() ?? '',
        saved_id: s.id,
      })
    }

    const exercises = exerciseList.map(ex => ({
      exercise: ex,
      sets: existingByExercise[ex.id] ?? [{ weight: '', reps: '', saved_id: null }],
      lastSets: lastByExercise[ex.id]?.sets ?? [],
      lastDate: lastByExercise[ex.id]?.date ?? null,
      skipped: false,
      collapsed: false,
    }))

    dispatch({ type: 'INIT', exercises, workoutId, startedAt: workout.started_at })
    setLoading(false)
  }

  async function saveSet(exerciseIdx, setIdx) {
    const ex = state.exercises[exerciseIdx]
    const s  = ex.sets[setIdx]
    const w  = parseFloat(s.weight)
    const r  = parseInt(s.reps)
    if (!w || !r) return

    if (s.saved_id) {
      await supabase.from('workout_sets')
        .update({ weight: w, reps: r, set_number: setIdx + 1 })
        .eq('id', s.saved_id)
    } else {
      const { data } = await supabase
        .from('workout_sets')
        .insert({ workout_id: state.workoutId, exercise_id: ex.exercise.id, set_number: setIdx + 1, weight: w, reps: r })
        .select('id')
        .single()
      if (data?.id) dispatch({ type: 'SET_SAVED_ID', idx: exerciseIdx, setIdx, id: data.id })
    }
  }

  async function removeSet(exerciseIdx, setIdx) {
    const s = state.exercises[exerciseIdx].sets[setIdx]
    if (s.saved_id) await supabase.from('workout_sets').delete().eq('id', s.saved_id)
    dispatch({ type: 'REMOVE_SET', idx: exerciseIdx, setIdx })
  }

  async function endWorkout() {
    const toDelete = []
    for (const ex of state.exercises) {
      if (ex.skipped) {
        ex.sets.forEach(s => { if (s.saved_id) toDelete.push(s.saved_id) })
        continue
      }
      const validSets = ex.sets.filter(s => s.saved_id && parseFloat(s.weight) && parseInt(s.reps))
      if (validSets.length === 0) {
        ex.sets.forEach(s => { if (s.saved_id) toDelete.push(s.saved_id) })
      }
    }
    if (toDelete.length > 0) await supabase.from('workout_sets').delete().in('id', toDelete)
    await supabase.from('workouts').update({ ended_at: new Date().toISOString() }).eq('id', state.workoutId)
    navigate('/')
  }

  async function addExercise(exercise) {
    if (state.exercises.find(ex => ex.exercise.id === exercise.id)) {
      setAddExerciseOpen(false)
      return
    }
    const { data: lastSets } = await supabase.rpc('get_last_sets_for_exercises', { p_exercise_ids: [exercise.id] })
    dispatch({
      type: 'ADD_EXERCISE',
      exercise: {
        exercise,
        sets: [{ weight: '', reps: '', saved_id: null }],
        lastSets: lastSets ?? [],
        lastDate: lastSets?.[0]?.workout_date ?? null,
        skipped: false,
        collapsed: false,
      },
    })
    setAddExerciseOpen(false)
  }

  function formatElapsed(secs) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${m}:${String(s).padStart(2,'0')}`
  }

  const completedCount = state.exercises.filter(ex =>
    !ex.skipped && ex.sets.some(s => s.saved_id && parseFloat(s.weight) && parseInt(s.reps))
  ).length

  if (loading) return <PageSpinner />

  return (
    <div className="flex flex-col h-full overflow-hidden bg-sys-bg dark:bg-black">
      <Header
        title="Active Workout"
        back="Cancel"
        right={
          <div className="flex items-center gap-1 text-sys-label2 dark:text-white/50">
            <Clock size={14} />
            <span className="text-sm font-mono">{formatElapsed(elapsed)}</span>
          </div>
        }
      />

      <div className="flex-1 scroll-content px-4 py-4 space-y-3">
        {state.exercises.map((ex, idx) => (
          <ExerciseCard
            key={ex.exercise.id}
            ex={ex}
            idx={idx}
            dispatch={dispatch}
            onSaveSet={saveSet}
            onRemoveSet={removeSet}
          />
        ))}

        <button
          onClick={() => setAddExerciseOpen(true)}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-ios border-2 border-dashed border-sys-separator dark:border-white/15 text-ios-blue active:opacity-60"
        >
          <Plus size={18} />
          <span className="text-sm font-medium">Add Exercise</span>
        </button>

        <div className="pt-2 pb-6">
          <Button fullWidth size="lg" onClick={() => setConfirmEnd(true)} disabled={completedCount === 0}>
            <Flag size={18} className="mr-2" />
            End Workout ({completedCount} exercise{completedCount !== 1 ? 's' : ''})
          </Button>
          {completedCount === 0 && (
            <p className="text-xs text-sys-label3 dark:text-white/30 text-center mt-2">
              Log at least one set to end the workout.
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={endWorkout}
        title="End Workout?"
        message={`${completedCount} exercise${completedCount !== 1 ? 's' : ''} with sets will be saved. Others will be discarded.`}
        confirmLabel="End Workout"
        destructive={false}
      />

      <AddExerciseSheet
        isOpen={addExerciseOpen}
        onClose={() => setAddExerciseOpen(false)}
        exercises={allExercises}
        onAdd={addExercise}
        alreadyAdded={state.exercises.map(ex => ex.exercise.id)}
      />
    </div>
  )
}

/* ── Exercise card ────────────────────────────────────────── */
function ExerciseCard({ ex, idx, dispatch, onSaveSet, onRemoveSet }) {
  const hasSavedSets = ex.sets.some(s => s.saved_id && parseFloat(s.weight) && parseInt(s.reps))

  const leftBorder = ex.skipped
    ? 'border-l-4 border-l-sys-separator dark:border-l-white/15'
    : hasSavedSets
    ? 'border-l-4 border-l-ios-green'
    : 'border-l-4 border-l-transparent'

  return (
    <div className={`ios-card overflow-hidden ${leftBorder} ${ex.skipped ? 'opacity-50' : ''}`}>
      {/* Card header */}
      <div className="flex items-center gap-2 p-4 pb-2">
        <button
          onClick={() => dispatch({ type: 'TOGGLE_COLLAPSE', idx })}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {hasSavedSets && <Check size={14} className="text-ios-green flex-shrink-0" />}
              <p className="font-semibold text-sys-label dark:text-white">{ex.exercise.name}</p>
            </div>
            <BodyPartBadge bodyPart={ex.exercise.body_part} className="mt-1" />
          </div>
          {ex.collapsed
            ? <ChevronDown size={18} className="text-sys-label3 dark:text-white/30 flex-shrink-0" />
            : <ChevronUp   size={18} className="text-sys-label3 dark:text-white/30 flex-shrink-0" />}
        </button>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SKIP', idx })}
          className={`text-xs font-medium px-2.5 py-1 rounded-full active:opacity-70 ${
            ex.skipped
              ? 'bg-sys-bg3 dark:bg-white/10 text-sys-label2 dark:text-white/50'
              : 'bg-ios-orange/15 text-ios-orange'
          }`}
        >
          {ex.skipped ? 'Skipped' : 'Skip'}
        </button>
      </div>

      {!ex.collapsed && !ex.skipped && (
        <div className="px-4 pb-4 space-y-3">
          {/* Last-time reference */}
          {ex.lastSets.length > 0 && (
            <div className="bg-sys-bg dark:bg-black/30 rounded-ios p-3">
              <p className="text-[10px] font-semibold text-sys-label3 dark:text-white/30 uppercase tracking-wide mb-1.5">
                Last · {formatShortDate(ex.lastDate)}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {ex.lastSets.map((s, i) => {
                  const rm = epley1RM(s.weight, s.reps)
                  return (
                    <span key={i} className="text-xs text-sys-label2 dark:text-white/60">
                      <span className="font-semibold text-sys-label dark:text-white">
                        {formatWeight(s.weight)} × {s.reps}
                      </span>
                      {rm > 0 && <span className="text-sys-label3 dark:text-white/30 ml-1">({formatWeight(rm)})</span>}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Set column headers */}
          <div className="flex gap-2 px-1">
            <span className="w-6 text-center text-[10px] font-medium text-sys-label3 dark:text-white/30">#</span>
            <span className="flex-1 text-center text-[10px] font-medium text-sys-label3 dark:text-white/30">KG</span>
            <span className="flex-1 text-center text-[10px] font-medium text-sys-label3 dark:text-white/30">REPS</span>
            <span className="w-10 text-center text-[10px] font-medium text-sys-label3 dark:text-white/30">1RM</span>
            <span className="w-8" />
          </div>

          {/* Set rows */}
          <div className="space-y-2">
            {ex.sets.map((s, setIdx) => {
              const rm = epley1RM(parseFloat(s.weight), parseInt(s.reps))
              const isSaved = !!s.saved_id && parseFloat(s.weight) && parseInt(s.reps)
              return (
                <div key={setIdx} className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs text-sys-label3 dark:text-white/30">{setIdx + 1}</span>
                  <SetInput
                    value={s.weight}
                    onChange={e => dispatch({ type: 'UPDATE_SET', idx, setIdx, field: 'weight', value: e.target.value })}
                    onBlur={() => onSaveSet(idx, setIdx)}
                    placeholder={ex.lastSets[setIdx]?.weight?.toString() ?? ''}
                    className="flex-1"
                  />
                  <SetInput
                    value={s.reps}
                    onChange={e => dispatch({ type: 'UPDATE_SET', idx, setIdx, field: 'reps', value: e.target.value })}
                    onBlur={() => onSaveSet(idx, setIdx)}
                    placeholder={ex.lastSets[setIdx]?.reps?.toString() ?? ''}
                    className="flex-1"
                  />
                  <span className={`w-10 text-center text-[11px] font-medium ${isSaved ? 'text-ios-blue' : 'text-sys-label3 dark:text-white/25'}`}>
                    {rm > 0 ? formatWeight(rm) : '—'}
                  </span>
                  <button
                    onClick={() => onRemoveSet(idx, setIdx)}
                    className="w-8 flex items-center justify-center text-ios-red active:opacity-60"
                  >
                    <X size={16} />
                  </button>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => dispatch({ type: 'ADD_SET', idx })}
            className="flex items-center gap-1.5 text-ios-blue text-sm font-medium active:opacity-60 pt-1"
          >
            <Plus size={16} />
            Add Set
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Add exercise sheet ───────────────────────────────────── */
function AddExerciseSheet({ isOpen, onClose, exercises, onAdd, alreadyAdded }) {
  const [search, setSearch] = useState('')

  const byBodyPart = exercises
    .filter(e => e.name.toLowerCase().includes(search.toLowerCase()) && !alreadyAdded.includes(e.id))
    .reduce((acc, e) => {
      if (!acc[e.body_part]) acc[e.body_part] = []
      acc[e.body_part].push(e)
      return acc
    }, {})

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Exercise" fullHeight>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Search exercises…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-11 px-4 rounded-ios bg-sys-bg3 dark:bg-white/10 text-sys-label dark:text-white placeholder:text-sys-label3 dark:placeholder:text-white/30 border-0 outline-none focus:ring-2 focus:ring-ios-blue/40 text-base"
        />
        {Object.entries(byBodyPart).map(([bp, exs]) => (
          <div key={bp}>
            <p className="text-xs font-semibold text-sys-label2 dark:text-white/50 uppercase tracking-wide mb-1 px-1">{bp}</p>
            <div className="ios-card overflow-hidden">
              {exs.map((ex, i) => (
                <div key={ex.id}>
                  <button
                    onClick={() => onAdd(ex)}
                    className="flex items-center w-full px-4 py-3 gap-3 active:opacity-70 text-left"
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: BODY_PART_COLORS[ex.body_part] }} />
                    <span className="text-sm text-sys-label dark:text-white">{ex.name}</span>
                    <Plus size={14} className="ml-auto text-ios-blue flex-shrink-0" />
                  </button>
                  {i < exs.length - 1 && <div className="ios-separator ml-10" />}
                </div>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(byBodyPart).length === 0 && (
          <p className="text-center text-sys-label2 dark:text-white/50 text-sm py-8">No exercises found.</p>
        )}
      </div>
    </Modal>
  )
}
