import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BODY_PART_COLORS } from '../lib/utils'
import Header from '../components/layout/Header'
import Card   from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input  from '../components/ui/Input'
import Modal, { ConfirmDialog } from '../components/ui/Modal'
import { PageSpinner } from '../components/ui/Spinner'
import { BodyPartBadge } from '../components/ui/Badge'
import { Plus, Trash2, GripVertical, ChevronRight, Pencil } from 'lucide-react'

export default function Templates() {
  const [loading, setLoading]         = useState(true)
  const [templates, setTemplates]     = useState([])
  const [exercises, setExercises]     = useState([])
  const [showCreate, setShowCreate]   = useState(false)
  const [editing, setEditing]         = useState(null) // template being edited

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: tmpl }, { data: exs }] = await Promise.all([
      supabase
        .from('templates')
        .select('id, name, template_exercises(id, order_index, exercise_id, exercises(id, name, body_part))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('exercises')
        .select('id, name, body_part')
        .eq('user_id', user.id)
        .order('body_part')
        .order('name'),
    ])
    setTemplates(tmpl?.map(t => ({
      ...t,
      template_exercises: [...(t.template_exercises ?? [])].sort((a, b) => a.order_index - b.order_index),
    })) ?? [])
    setExercises(exs ?? [])
    setLoading(false)
  }

  if (loading) return <PageSpinner />

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Templates"
        large
        right={
          <button
            onClick={() => setShowCreate(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-ios-blue active:opacity-70"
          >
            <Plus size={20} className="text-white" strokeWidth={2.5} />
          </button>
        }
      />

      <div className="flex-1 scroll-content px-4 py-4 space-y-3">
        {templates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-sys-label2 dark:text-white/50 text-center">
              No templates yet. Create your first one — e.g. "Push Day", "Pull Day", "Leg Day".
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-1" /> New Template
            </Button>
          </div>
        )}
        {templates.map(t => (
          <TemplateRow
            key={t.id}
            template={t}
            onEdit={() => setEditing(t)}
            onDelete={load}
          />
        ))}
      </div>

      {/* Create modal */}
      <TemplateEditor
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => { setShowCreate(false); load() }}
        exercises={exercises}
      />

      {/* Edit modal */}
      {editing && (
        <TemplateEditor
          isOpen
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
          exercises={exercises}
          template={editing}
        />
      )}
    </div>
  )
}

/* ── Template row ─────────────────────────────────────────── */
function TemplateRow({ template, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const exercises = template.template_exercises

  async function handleDelete() {
    await supabase.from('templates').delete().eq('id', template.id)
    onDelete()
  }

  const bodyParts = [...new Set(exercises.map(te => te.exercises?.body_part).filter(Boolean))]

  return (
    <>
      <Card padding={false} className="flex items-center">
        <button onClick={onEdit} className="flex-1 flex items-center p-4 gap-3 text-left active:opacity-70 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sys-label dark:text-white">{template.name}</p>
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
          <Pencil size={16} className="text-sys-label3 dark:text-white/30 flex-shrink-0" />
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          className="px-4 py-4 text-ios-red active:opacity-60"
        >
          <Trash2 size={18} />
        </button>
      </Card>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={`Delete "${template.name}"?`}
        message="This will not delete any logged workouts."
        confirmLabel="Delete"
      />
    </>
  )
}

/* ── Create / Edit template modal ─────────────────────────── */
function TemplateEditor({ isOpen, onClose, onSaved, exercises, template }) {
  const [name, setName]         = useState(template?.name ?? '')
  const [selected, setSelected] = useState(
    template?.template_exercises?.map(te => te.exercises) ?? []
  )
  const [search, setSearch]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [tab, setTab]           = useState('details') // 'details' | 'exercises'

  // Reset when template changes
  useEffect(() => {
    setName(template?.name ?? '')
    setSelected(template?.template_exercises?.map(te => te.exercises) ?? [])
    setSearch('')
    setTab('details')
  }, [template, isOpen])

  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  const byBodyPart = filtered.reduce((acc, e) => {
    if (!acc[e.body_part]) acc[e.body_part] = []
    acc[e.body_part].push(e)
    return acc
  }, {})

  function toggleExercise(ex) {
    setSelected(prev =>
      prev.find(e => e.id === ex.id)
        ? prev.filter(e => e.id !== ex.id)
        : [...prev, ex]
    )
  }

  function removeExercise(id) {
    setSelected(prev => prev.filter(e => e.id !== id))
  }

  async function save() {
    if (!name.trim() || selected.length === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (template) {
      // Update name
      await supabase.from('templates').update({ name: name.trim() }).eq('id', template.id)
      // Replace exercises
      await supabase.from('template_exercises').delete().eq('template_id', template.id)
      await supabase.from('template_exercises').insert(
        selected.map((ex, i) => ({
          template_id: template.id,
          exercise_id: ex.id,
          order_index: i,
        }))
      )
    } else {
      const { data: tmpl } = await supabase
        .from('templates')
        .insert({ user_id: user.id, name: name.trim() })
        .select()
        .single()
      await supabase.from('template_exercises').insert(
        selected.map((ex, i) => ({
          template_id: tmpl.id,
          exercise_id: ex.id,
          order_index: i,
        }))
      )
    }

    setSaving(false)
    onSaved()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={template ? 'Edit Template' : 'New Template'}
      fullHeight
    >
      {/* Tabs */}
      <div className="flex gap-1 bg-sys-bg3 dark:bg-white/10 rounded-ios p-1 mb-4">
        {['details', 'exercises'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-[8px] text-sm font-medium transition-colors capitalize
              ${tab === t ? 'bg-sys-bg2 dark:bg-white/10 text-sys-label dark:text-white shadow-ios-sm' : 'text-sys-label2 dark:text-white/50'}`}
          >
            {t} {t === 'exercises' && selected.length > 0 ? `(${selected.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="space-y-4">
          <Input
            label="Template name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Push Day"
            autoFocus
          />

          {selected.length > 0 && (
            <div>
              <p className="text-xs font-medium text-sys-label2 dark:text-white/50 uppercase tracking-wide px-1 mb-2">
                Exercises ({selected.length})
              </p>
              <Card padding={false}>
                {selected.map((ex, i) => (
                  <div key={ex.id}>
                    <div className="flex items-center px-4 py-3 gap-3">
                      <GripVertical size={16} className="text-sys-label3 dark:text-white/25 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-sys-label dark:text-white truncate">{ex.name}</p>
                        <BodyPartBadge bodyPart={ex.body_part} className="mt-0.5" />
                      </div>
                      <button onClick={() => removeExercise(ex.id)} className="text-ios-red active:opacity-60 p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {i < selected.length - 1 && <div className="ios-separator ml-12" />}
                  </div>
                ))}
              </Card>
            </div>
          )}

          <Button
            fullWidth
            disabled={!name.trim() || selected.length === 0 || saving}
            onClick={save}
          >
            {saving ? 'Saving…' : template ? 'Save Changes' : 'Create Template'}
          </Button>

          {selected.length === 0 && (
            <p className="text-xs text-sys-label3 dark:text-white/30 text-center">
              Switch to the Exercises tab to add exercises.
            </p>
          )}
        </div>
      )}

      {tab === 'exercises' && (
        <div className="space-y-3">
          <Input
            placeholder="Search exercises…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {Object.entries(byBodyPart).map(([bp, exs]) => (
            <div key={bp}>
              <p className="text-xs font-semibold text-sys-label2 dark:text-white/50 uppercase tracking-wide mb-1 px-1">
                {bp}
              </p>
              <Card padding={false}>
                {exs.map((ex, i) => {
                  const checked = !!selected.find(e => e.id === ex.id)
                  return (
                    <div key={ex.id}>
                      <button
                        onClick={() => toggleExercise(ex)}
                        className="flex items-center w-full px-4 py-3 gap-3 active:opacity-70 text-left"
                      >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                          ${checked ? 'bg-ios-blue border-ios-blue' : 'border-sys-separator dark:border-white/20'}`}>
                          {checked && <svg viewBox="0 0 12 10" className="w-3.5 h-3.5 fill-white"><path d="M1 5l3.5 3.5L11 1"/></svg>}
                        </div>
                        <span className="text-sm text-sys-label dark:text-white">{ex.name}</span>
                      </button>
                      {i < exs.length - 1 && <div className="ios-separator ml-14" />}
                    </div>
                  )
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
