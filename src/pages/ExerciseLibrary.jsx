import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BODY_PARTS, BODY_PART_COLORS } from '../lib/utils'
import Header from '../components/layout/Header'
import Card   from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input  from '../components/ui/Input'
import Modal, { ConfirmDialog } from '../components/ui/Modal'
import { PageSpinner } from '../components/ui/Spinner'
import { BodyPartBadge } from '../components/ui/Badge'
import { Plus, Trash2, Pencil, ChevronRight, Search } from 'lucide-react'

export default function ExerciseLibrary() {
  const navigate = useNavigate()
  const [loading, setLoading]       = useState(true)
  const [exercises, setExercises]   = useState([])
  const [search, setSearch]         = useState('')
  const [showAdd, setShowAdd]       = useState(false)
  const [editing, setEditing]       = useState(null)
  const [selectedBP, setSelectedBP] = useState('All')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('exercises')
      .select('id, name, body_part, notes')
      .eq('user_id', user.id)
      .order('body_part').order('name')
    setExercises(data ?? [])
    setLoading(false)
  }

  const bodyParts = ['All', ...BODY_PARTS]

  const filtered = exercises.filter(e => {
    const matchBP = selectedBP === 'All' || e.body_part === selectedBP
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase())
    return matchBP && matchSearch
  })

  const grouped = filtered.reduce((acc, e) => {
    if (!acc[e.body_part]) acc[e.body_part] = []
    acc[e.body_part].push(e)
    return acc
  }, {})

  if (loading) return <PageSpinner />

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Exercises"
        large
        right={
          <button
            onClick={() => setShowAdd(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-ios-blue active:opacity-70"
          >
            <Plus size={20} className="text-white" strokeWidth={2.5} />
          </button>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search + filter bar */}
        <div className="px-4 pt-2 pb-2 space-y-2 flex-shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sys-label3 dark:text-white/30" />
            <input
              type="text"
              placeholder="Search exercises…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-ios bg-sys-bg3 dark:bg-white/10 text-sys-label dark:text-white placeholder:text-sys-label3 dark:placeholder:text-white/30 border-0 outline-none text-base"
            />
          </div>

          {/* Body-part pill filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {bodyParts.map(bp => {
              const color = BODY_PART_COLORS[bp]
              const active = selectedBP === bp
              return (
                <button
                  key={bp}
                  onClick={() => setSelectedBP(bp)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors active:opacity-70 ${
                    active
                      ? 'bg-ios-blue text-white'
                      : 'bg-sys-bg3 dark:bg-white/10 text-sys-label2 dark:text-white/50'
                  }`}
                >
                  {bp}
                </button>
              )
            })}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 scroll-content px-4 pb-4 space-y-4">
          {Object.entries(grouped).map(([bp, exs]) => (
            <section key={bp}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BODY_PART_COLORS[bp] }} />
                <h2 className="text-sm font-semibold text-sys-label2 dark:text-white/60">{bp}</h2>
                <span className="text-xs text-sys-label3 dark:text-white/30">{exs.length}</span>
              </div>
              <Card padding={false}>
                {exs.map((ex, i) => (
                  <div key={ex.id}>
                    <div className="flex items-center">
                      <button
                        onClick={() => navigate(`/exercises/${ex.id}`)}
                        className="flex-1 flex items-center px-4 py-3 gap-3 text-left active:opacity-70 min-w-0"
                      >
                        <p className="flex-1 text-sm font-medium text-sys-label dark:text-white truncate">{ex.name}</p>
                        <ChevronRight size={16} className="text-sys-label3 dark:text-white/25 flex-shrink-0" />
                      </button>
                      <button onClick={() => setEditing(ex)} className="px-3 py-3 text-sys-label3 dark:text-white/25 active:opacity-60">
                        <Pencil size={15} />
                      </button>
                    </div>
                    {i < exs.length - 1 && <div className="ios-separator ml-4" />}
                  </div>
                ))}
              </Card>
            </section>
          ))}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sys-label2 dark:text-white/50">No exercises found.</p>
              <Button onClick={() => setShowAdd(true)} variant="secondary">
                <Plus size={16} className="mr-1" /> Add Exercise
              </Button>
            </div>
          )}
        </div>
      </div>

      <ExerciseForm
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={() => { setShowAdd(false); load() }}
      />

      {editing && (
        <ExerciseForm
          isOpen
          exercise={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
          onDeleted={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

/* ── Create / Edit exercise modal ────────────────────────── */
function ExerciseForm({ isOpen, onClose, onSaved, onDeleted, exercise }) {
  const [name, setName]       = useState(exercise?.name ?? '')
  const [bodyPart, setBodyPart] = useState(exercise?.body_part ?? 'Chest')
  const [notes, setNotes]     = useState(exercise?.notes ?? '')
  const [saving, setSaving]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    setName(exercise?.name ?? '')
    setBodyPart(exercise?.body_part ?? 'Chest')
    setNotes(exercise?.notes ?? '')
  }, [exercise, isOpen])

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (exercise) {
      await supabase.from('exercises').update({ name: name.trim(), body_part: bodyPart, notes: notes.trim() || null }).eq('id', exercise.id)
    } else {
      await supabase.from('exercises').insert({ user_id: user.id, name: name.trim(), body_part: bodyPart, notes: notes.trim() || null })
    }
    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    await supabase.from('exercises').delete().eq('id', exercise.id)
    onDeleted?.()
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={exercise ? 'Edit Exercise' : 'New Exercise'}>
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Bench Press"
            autoFocus
          />

          <div>
            <p className="text-xs font-medium text-sys-label2 dark:text-white/50 uppercase tracking-wide px-1 mb-2">Body Part</p>
            <div className="grid grid-cols-2 gap-2">
              {BODY_PARTS.map(bp => (
                <button
                  key={bp}
                  onClick={() => setBodyPart(bp)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-ios text-sm font-medium active:opacity-70 transition-colors text-left ${
                    bodyPart === bp
                      ? 'bg-ios-blue text-white'
                      : 'bg-sys-bg3 dark:bg-white/10 text-sys-label dark:text-white'
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: bodyPart === bp ? 'white' : BODY_PART_COLORS[bp] }}
                  />
                  {bp}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Use neutral grip"
          />

          <Button fullWidth disabled={!name.trim() || saving} onClick={save}>
            {saving ? 'Saving…' : exercise ? 'Save Changes' : 'Add Exercise'}
          </Button>

          {exercise && (
            <button
              onClick={() => setConfirmDel(true)}
              className="w-full text-ios-red text-sm font-medium py-2 active:opacity-60"
            >
              Delete Exercise
            </button>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={handleDelete}
        title={`Delete "${exercise?.name}"?`}
        message="This will not delete any logged workout data."
      />
    </>
  )
}
