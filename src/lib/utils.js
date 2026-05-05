import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

// Epley 1RM formula
export function epley1RM(weight, reps) {
  if (!weight || !reps || reps === 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

// Best 1RM from an array of sets
export function best1RM(sets) {
  if (!sets || sets.length === 0) return 0
  return sets.reduce((best, s) => {
    const rm = epley1RM(s.weight, s.reps)
    return rm > best ? rm : best
  }, 0)
}

// Volume for a set of sets
export function totalVolume(sets) {
  return sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0)
}

export function formatWeight(w) {
  if (!w && w !== 0) return '—'
  return Number.isInteger(w) ? `${w}` : `${w.toFixed(1)}`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  return format(new Date(dateStr), 'MMM d, yyyy')
}

export function formatShortDate(dateStr) {
  if (!dateStr) return ''
  return format(new Date(dateStr), 'MMM d')
}

export function formatTime(dateStr) {
  if (!dateStr) return ''
  return format(new Date(dateStr), 'h:mm a')
}

export function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return ''
  const diff = new Date(endedAt) - new Date(startedAt)
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function workoutsThisWeek(workouts) {
  const now = new Date()
  const start = startOfWeek(now, { weekStartsOn: 1 })
  const end   = endOfWeek(now,   { weekStartsOn: 1 })
  return workouts.filter(w =>
    w.ended_at && isWithinInterval(new Date(w.started_at), { start, end })
  ).length
}

export function workoutsThisMonth(workouts) {
  const now   = new Date()
  const start = startOfMonth(now)
  const end   = endOfMonth(now)
  return workouts.filter(w =>
    w.ended_at && isWithinInterval(new Date(w.started_at), { start, end })
  ).length
}

export const BODY_PARTS = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Cardio']

export const BODY_PART_COLORS = {
  Chest:     '#FF3B30',
  Back:      '#007AFF',
  Shoulders: '#FFCC00',
  Legs:      '#34C759',
  Arms:      '#AF52DE',
  Core:      '#FF2D55',
  Cardio:    '#FF9500',
}

export const BODY_PART_BG = {
  Chest:     'bg-[#FF3B30]',
  Back:      'bg-[#007AFF]',
  Shoulders: 'bg-[#FFCC00]',
  Legs:      'bg-[#34C759]',
  Arms:      'bg-[#AF52DE]',
  Core:      'bg-[#FF2D55]',
  Cardio:    'bg-[#FF9500]',
}
