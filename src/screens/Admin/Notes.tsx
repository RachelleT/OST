import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

interface Note {
  id: string
  text: string
  pool: 'empty_state' | 'completed_state'
  day_of_week: number | null
  active: boolean
  created_at: string
}

type Pool = 'empty_state' | 'completed_state'

interface ModalState {
  open: boolean
  id: string | null
  text: string
  pool: Pool
  day_of_week: number | null
}

const ACCENT = '#04342C'
const MAX = 140
const MIN = 3

const DOW_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Any', value: null },
  { label: 'Mon', value: 0 },
  { label: 'Tue', value: 1 },
  { label: 'Wed', value: 2 },
  { label: 'Thu', value: 3 },
  { label: 'Fri', value: 4 },
  { label: 'Sat', value: 5 },
  { label: 'Sun', value: 6 },
]

const DOW_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function NoteModal({
  state,
  onClose,
  onSave,
}: {
  state: ModalState
  onClose: () => void
  onSave: (text: string, pool: Pool, dow: number | null) => Promise<string | null>
}) {
  useBodyScrollLock()
  const [text, setText] = useState(state.text)
  const [pool, setPool] = useState<Pool>(state.pool)
  const [dow, setDow] = useState<number | null>(state.day_of_week)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isEdit = state.id !== null
  const len = text.trim().length

  async function handleSave() {
    if (len < MIN || len > MAX) {
      setError(`Must be ${MIN}–${MAX} characters`)
      return
    }
    setSaving(true)
    setError('')
    const err = await onSave(text.trim(), pool, dow)
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
        <h2 className="text-base font-semibold text-gray-900">
          {isEdit ? 'Edit note' : 'New note'}
        </h2>

        {/* Text */}
        <div>
          <label htmlFor="note-text" className="sr-only">Note text</label>
          <textarea
            id="note-text"
            value={text}
            onChange={e => { setText(e.target.value); setError('') }}
            maxLength={MAX}
            rows={3}
            placeholder="Write a warm note (3–140 characters)…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
            autoFocus
          />
          <div className="flex items-center justify-between mt-1">
            {error ? <p className="text-xs text-red-500">{error}</p> : <span />}
            <p className="text-xs text-gray-400">{len}/{MAX}</p>
          </div>
        </div>

        {/* Pool — only show on new note */}
        {!isEdit && (
          <fieldset>
            <legend className="text-xs font-medium text-gray-600 mb-2">Pool</legend>
            <div className="flex gap-2">
              {(['empty_state', 'completed_state'] as Pool[]).map(p => (
                <label
                  key={p}
                  className="flex-1 flex items-center justify-center rounded-xl py-2 text-xs font-medium cursor-pointer border-2 transition-colors"
                  style={{
                    borderColor: pool === p ? ACCENT : 'transparent',
                    background: pool === p ? '#E1F5EE' : '#f9fafb',
                    color: pool === p ? ACCENT : '#6b7280',
                  }}
                >
                  <input
                    type="radio"
                    name="pool"
                    value={p}
                    checked={pool === p}
                    onChange={() => setPool(p)}
                    className="sr-only"
                  />
                  {p === 'empty_state' ? '🌱 Before posting' : '👀 After posting'}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Day of week */}
        <fieldset>
          <legend className="text-xs font-medium text-gray-600 mb-2">Day of week</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {DOW_OPTIONS.map(({ label, value }) => (
              <label
                key={label}
                className="flex items-center justify-center rounded-lg py-1.5 text-xs font-medium cursor-pointer border-2 transition-colors"
                style={{
                  borderColor: dow === value ? ACCENT : 'transparent',
                  background: dow === value ? '#E1F5EE' : '#f9fafb',
                  color: dow === value ? ACCENT : '#6b7280',
                }}
              >
                <input
                  type="radio"
                  name="dow"
                  checked={dow === value}
                  onChange={() => setDow(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-gray-200 text-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || len < MIN}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [activePool, setActivePool] = useState<Pool>('empty_state')
  const [modal, setModal] = useState<ModalState>({
    open: false, id: null, text: '', pool: 'empty_state', day_of_week: null,
  })
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('notes')
      .select('id, text, pool, day_of_week, active, created_at')
      .order('created_at', { ascending: false })
    setNotes((data as Note[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const visible = notes.filter(n => n.pool === activePool)

  function openNew() {
    setModal({ open: true, id: null, text: '', pool: activePool, day_of_week: null })
  }

  function openEdit(n: Note) {
    setModal({ open: true, id: n.id, text: n.text, pool: n.pool, day_of_week: n.day_of_week })
  }

  async function handleSave(text: string, pool: Pool, dow: number | null): Promise<string | null> {
    if (modal.id) {
      const { error } = await supabase.rpc('admin_update_note', {
        p_id: modal.id, p_text: text, p_day_of_week: dow,
      })
      if (error) return error.message
    } else {
      const { error } = await supabase.rpc('admin_create_note', {
        p_text: text, p_pool: pool, p_day_of_week: dow,
      })
      if (error) return error.message
    }
    setModal({ open: false, id: null, text: '', pool: activePool, day_of_week: null })
    load()
    return null
  }

  async function toggleActive(n: Note) {
    setTogglingId(n.id)
    await supabase.rpc('admin_set_note_active', { p_id: n.id, p_active: !n.active })
    setTogglingId(null)
    load()
  }

  return (
    <div className="px-5 py-8 w-full max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Notes</h1>
        <button
          onClick={openNew}
          className="rounded-xl px-4 py-2 text-sm font-medium text-white"
          style={{ background: ACCENT }}
        >
          + New note
        </button>
      </div>

      {/* Pool tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {(['empty_state', 'completed_state'] as Pool[]).map(p => (
          <button
            key={p}
            onClick={() => setActivePool(p)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: activePool === p ? 'white' : 'transparent',
              color: activePool === p ? ACCENT : '#6b7280',
              boxShadow: activePool === p ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {p === 'empty_state' ? '🌱 Before posting' : '👀 After posting'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">No notes in this pool yet.</p>
      ) : (
        <div className="space-y-2">
          {visible.map(n => (
            <div key={n.id} className="rounded-2xl bg-white p-4 shadow-sm flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 leading-snug">{n.text}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: n.active ? '#E1F5EE' : '#f3f4f6',
                      color: n.active ? ACCENT : '#6b7280',
                    }}
                  >
                    {n.active ? 'Active' : 'Inactive'}
                  </span>
                  {n.day_of_week !== null ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                      {DOW_SHORT[n.day_of_week]} only
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Any day</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {format(new Date(n.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(n)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(n)}
                  disabled={togglingId === n.id}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-50"
                  style={{ borderColor: n.active ? '#fca5a5' : '#d1d5db', color: n.active ? '#dc2626' : '#6b7280' }}
                >
                  {togglingId === n.id ? '…' : n.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <NoteModal
          state={modal}
          onClose={() => setModal({ open: false, id: null, text: '', pool: activePool, day_of_week: null })}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
