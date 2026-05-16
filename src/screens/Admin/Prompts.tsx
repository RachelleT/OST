import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'

interface Prompt {
  id: string
  text: string
  active: boolean
  created_at: string
  times_shown: number
}

interface ModalState {
  open: boolean
  id: string | null   // null = new prompt
  text: string
}

const ACCENT = '#04342C'
const MAX = 200
const MIN = 5

function PromptModal({
  state,
  onClose,
  onSave,
}: {
  state: ModalState
  onClose: () => void
  onSave: (text: string) => Promise<void>
}) {
  const [text, setText] = useState(state.text)
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
    await onSave(text.trim())
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">
          {isEdit ? 'Edit prompt' : 'New prompt'}
        </h2>

        <div>
          <label htmlFor="prompt-text" className="sr-only">Prompt text</label>
          <textarea
            id="prompt-text"
            value={text}
            onChange={e => { setText(e.target.value); setError('') }}
            maxLength={MAX}
            rows={4}
            placeholder="Write a prompt (5–200 characters)…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
            autoFocus
          />
          <div className="flex items-center justify-between mt-1">
            {error
              ? <p className="text-xs text-red-500">{error}</p>
              : <span />
            }
            <p className="text-xs text-gray-400">{len}/{MAX}</p>
          </div>
        </div>

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

export default function AdminPrompts() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>({ open: false, id: null, text: '' })
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('prompts')
      .select('id, text, active, created_at')
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    // Fetch times shown per prompt
    const { data: counts } = await supabase
      .from('daily_assignments')
      .select('prompt_id')

    const countMap: Record<string, number> = {}
    for (const row of counts ?? []) {
      const pid = row.prompt_id as string
      countMap[pid] = (countMap[pid] ?? 0) + 1
    }

    setPrompts((data as { id: string; text: string; active: boolean; created_at: string }[])
      .map(p => ({ ...p, times_shown: countMap[p.id] ?? 0 })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setModal({ open: true, id: null, text: '' })
  }

  function openEdit(p: Prompt) {
    setModal({ open: true, id: p.id, text: p.text })
  }

  async function handleSave(text: string) {
    if (modal.id) {
      await supabase.rpc('admin_update_prompt', { p_id: modal.id, p_text: text })
    } else {
      await supabase.rpc('admin_create_prompt', { p_text: text })
    }
    setModal({ open: false, id: null, text: '' })
    load()
  }

  async function toggleActive(p: Prompt) {
    setTogglingId(p.id)
    await supabase.rpc('admin_set_prompt_active', { p_id: p.id, p_active: !p.active })
    setTogglingId(null)
    load()
  }

  return (
    <div className="px-6 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Prompts</h1>
        <button
          onClick={openNew}
          className="rounded-xl px-4 py-2 text-sm font-medium text-white"
          style={{ background: ACCENT }}
        >
          + New prompt
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">No prompts yet.</p>
      ) : (
        <div className="space-y-2">
          {prompts.map(p => (
            <div
              key={p.id}
              className="rounded-2xl bg-white p-4 shadow-sm flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 leading-snug">{p.text}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: p.active ? '#E1F5EE' : '#f3f4f6',
                      color: p.active ? ACCENT : '#6b7280',
                    }}
                  >
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {p.times_shown} {p.times_shown === 1 ? 'time' : 'times'} shown
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(p.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(p)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  disabled={togglingId === p.id}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  style={{ borderColor: p.active ? '#fca5a5' : '#d1d5db', color: p.active ? '#dc2626' : '#6b7280' }}
                >
                  {togglingId === p.id ? '…' : p.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <PromptModal
          state={modal}
          onClose={() => setModal({ open: false, id: null, text: '' })}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
