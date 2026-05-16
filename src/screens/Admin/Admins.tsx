import { useEffect, useState, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useProfile } from '../../lib/ProfileContext'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

interface AdminUser {
  id: string
  display_name: string
  email: string
  is_bootstrap: boolean
  promoted_at: string | null
}

interface PendingInvite {
  id: string
  email: string
  invited_at: string
}

interface AuditEntry {
  id: string
  action: string
  actor_name: string | null
  target_name: string | null
  reason: string | null
  created_at: string
}

const ACCENT = '#04342C'

const ACTION_LABELS: Record<string, string> = {
  promoted:       'Promoted to admin',
  demoted:        'Demoted from admin',
  invited:        'Invite sent',
  bootstrap_auto: 'Auto-promoted (bootstrap)',
  post_hidden:              'Post hidden',
  post_unhidden:            'Post unhidden',
  post_featured:            'Post featured',
  post_unfeatured:          'Post unfeatured',
  post_approved:            'Post approved from queue',
  post_moderation_ignored:  'Moderation flag dismissed',
  prompt_created: 'Prompt created',
  prompt_edited:  'Prompt edited',
  prompt_deactivated: 'Prompt deactivated',
  prompt_reactivated: 'Prompt reactivated',
  note_created:   'Note created',
  note_edited:    'Note edited',
  note_deactivated: 'Note deactivated',
  note_reactivated: 'Note reactivated',
}

// ── Invite modal ───────────────────────────────────────────────────────────

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  useBodyScrollLock()
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleInvite() {
    if (!email.trim()) { setError('Enter an email address'); return }
    setSaving(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('invite_admin', { p_email: email.trim() })
    setSaving(false)
    if (rpcError) { setError(rpcError.message); return }
    setResult(data as string)
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div className="bg-white w-full max-w-sm mx-4 rounded-3xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
          <p className="text-base font-semibold text-gray-900">
            {result === 'promoted' ? '✓ Promoted immediately' : '✓ Invite created'}
          </p>
          <p className="text-sm text-gray-500">
            {result === 'promoted'
              ? `${email} already had an account and is now an admin.`
              : `${email} will become an admin when they sign in for the first time.`}
          </p>
          <button
            onClick={() => { onDone(); onClose() }}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-white"
            style={{ background: ACCENT }}
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-sm mx-4 rounded-3xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
        <h2 className="text-base font-semibold text-gray-900">Invite admin</h2>
        <p className="text-sm text-gray-500">
          If they already have an account they'll be promoted immediately. Otherwise they'll be promoted on first sign-in.
        </p>
        <div>
          <label htmlFor="invite-email" className="sr-only">Email address</label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="email@example.com"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
            autoFocus
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-gray-200 text-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            {saving ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function AdminAdmins() {
  const me = useProfile()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [pending, setPending] = useState<PendingInvite[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'admins' | 'audit'>('admins')
  const [showInvite, setShowInvite] = useState(false)
  const [confirmDemote, setConfirmDemote] = useState<string | null>(null)
  const [demoting, setDemoting] = useState(false)
  const [demoteError, setDemoteError] = useState('')
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: adminData }, { data: pendingData }, { data: auditData }] = await Promise.all([
      supabase.rpc('get_admin_list'),
      supabase
        .from('admin_invites')
        .select('id, email, invited_at')
        .is('consumed_at', null)
        .order('invited_at', { ascending: false }),
      supabase.rpc('get_audit_log', { p_limit: 50 }),
    ])
    setAdmins((adminData as AdminUser[]) ?? [])
    setPending((pendingData as PendingInvite[]) ?? [])
    setAudit((auditData as AuditEntry[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDemote(id: string) {
    setDemoting(true)
    setDemoteError('')
    const { error } = await supabase.rpc('demote_admin', { p_target_id: id })
    setDemoting(false)
    if (error) { setDemoteError(error.message); return }
    setConfirmDemote(null)
    load()
  }

  async function cancelInvite(id: string, email: string) {
    setCancellingInvite(id)
    await supabase.from('admin_invites').delete().eq('id', id)
    setCancellingInvite(null)
    setPending(prev => prev.filter(p => p.email !== email))
  }

  return (
    <div className="px-5 py-8 w-full max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Admins</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="rounded-xl px-4 py-2 text-sm font-medium text-white"
          style={{ background: ACCENT }}
        >
          + Invite admin
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {(['admins', 'audit'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === t ? 'white' : 'transparent',
              color: tab === t ? ACCENT : '#6b7280',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {t === 'admins' ? 'Admins' : 'Audit log'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : tab === 'admins' ? (
        <>
          {/* Admin list */}
          <div className="space-y-2">
            {admins.map(admin => {
              const isMe = admin.id === me?.id
              const isDemoting = confirmDemote === admin.id

              return (
                <div key={admin.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{admin.display_name}</span>
                        {isMe && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">you</span>
                        )}
                        {admin.is_bootstrap && (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ background: '#E1F5EE', color: ACCENT }}
                            title="Permanent — remove from bootstrap config to demote"
                          >
                            🔒 Bootstrap
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{admin.email}</p>
                      {admin.promoted_at && (
                        <p className="text-xs text-gray-400">
                          Admin since {format(parseISO(admin.promoted_at), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>

                    {!isMe && !admin.is_bootstrap && !isDemoting && (
                      <button
                        onClick={() => { setConfirmDemote(admin.id); setDemoteError('') }}
                        className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                        style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                      >
                        Demote
                      </button>
                    )}
                  </div>

                  {/* Inline demote confirmation */}
                  {isDemoting && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-700 mb-2">
                        Remove admin access for <strong>{admin.display_name}</strong>?
                      </p>
                      {demoteError && (
                        <p className="text-xs text-red-500 mb-2">{demoteError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setConfirmDemote(null); setDemoteError('') }}
                          className="flex-1 rounded-lg py-1.5 text-xs font-medium border border-gray-200 text-gray-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDemote(admin.id)}
                          disabled={demoting}
                          className="flex-1 rounded-lg py-1.5 text-xs font-medium border disabled:opacity-40"
                          style={{ borderColor: '#fca5a5', color: '#dc2626', background: '#fff5f5' }}
                        >
                          {demoting ? '…' : 'Yes, demote'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pending invites */}
          {pending.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Pending invites
              </p>
              <div className="space-y-2">
                {pending.map(inv => (
                  <div key={inv.id} className="rounded-2xl bg-white p-4 shadow-sm flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700">{inv.email}</p>
                      <p className="text-xs text-gray-400">
                        Invited {format(parseISO(inv.invited_at), 'MMM d, yyyy')} · awaiting sign-in
                      </p>
                    </div>
                    <button
                      onClick={() => cancelInvite(inv.id, inv.email)}
                      disabled={cancellingInvite === inv.id}
                      className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                    >
                      {cancellingInvite === inv.id ? '…' : 'Cancel'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Audit log */
        <div className="space-y-2">
          {audit.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">No audit entries yet.</p>
          ) : audit.map(entry => (
            <div key={entry.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {entry.actor_name ? `by ${entry.actor_name}` : 'system'}
                    {entry.target_name ? ` · ${entry.target_name}` : ''}
                    {entry.reason ? ` · ${entry.reason}` : ''}
                  </p>
                </div>
                <p className="text-xs text-gray-400 shrink-0">
                  {format(parseISO(entry.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onDone={load}
        />
      )}
    </div>
  )
}
