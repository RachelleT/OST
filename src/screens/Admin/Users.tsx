import { useEffect, useState, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'

interface AdminUser {
  id: string
  display_name: string
  email: string
  joined_at: string
  current_streak: number
  longest_streak: number
  post_count: number
  is_admin: boolean
  deactivated_at: string | null
}

type FilterTab = 'all' | 'week' | 'month' | 'admin' | 'deactivated'

const ACCENT = '#04342C'
const PAGE_SIZE = 50

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'week',        label: 'This week' },
  { key: 'month',       label: 'This month' },
  { key: 'admin',       label: 'Admins' },
  { key: 'deactivated', label: 'Deactivated' },
]

export default function AdminUsers() {
  const [users, setUsers]   = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal]   = useState<number | null>(null)

  const loadUsers = useCallback(async (currentTab: FilterTab, searchText: string, pageNum: number) => {
    setLoading(true)
    const { data } = await supabase.rpc('admin_get_users', {
      p_search: searchText.trim() || null,
      p_filter: currentTab,
      p_limit:  PAGE_SIZE + 1,
      p_offset: pageNum * PAGE_SIZE,
    })
    const rows = (data as AdminUser[]) ?? []
    const hasNext = rows.length > PAGE_SIZE
    const page_rows = hasNext ? rows.slice(0, PAGE_SIZE) : rows

    if (pageNum === 0) {
      setUsers(page_rows)
      // rough total from first page
      if (!hasNext) setTotal(page_rows.length + pageNum * PAGE_SIZE)
    } else {
      setUsers(prev => [...prev, ...page_rows])
    }
    setHasMore(hasNext)
    setLoading(false)
  }, [])

  // Total count (all users, no filter)
  useEffect(() => {
    supabase.from('profiles').select('id', { count: 'exact', head: true })
      .then(({ count }) => setTotal(count ?? null))
  }, [])

  useEffect(() => {
    setPage(0)
    loadUsers(tab, search, 0)
  }, [tab, search, loadUsers])

  function loadMore() {
    const next = page + 1
    setPage(next)
    loadUsers(tab, search, next)
  }

  return (
    <div className="px-5 py-8 pb-24 w-full max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          {total !== null && (
            <p className="text-sm text-gray-400 mt-0.5">{total} total</p>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              background: tab === key ? 'white' : 'transparent',
              color:      tab === key ? ACCENT : '#6b7280',
              boxShadow:  tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <label htmlFor="user-search" className="sr-only">Search users</label>
        <input
          id="user-search"
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2"
          style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
        />
      </div>

      {/* List */}
      {loading && users.length === 0 ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">No users found.</p>
      ) : (
        <>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{u.display_name}</span>
                      {u.is_admin && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: '#E1F5EE', color: ACCENT }}
                        >
                          Admin
                        </span>
                      )}
                      {u.deactivated_at && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                    <p className="text-xs text-gray-400">
                      Joined {format(parseISO(u.joined_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-900">{u.post_count}</span> post{u.post_count !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      🔥 <span className="font-semibold text-gray-900">{u.current_streak}</span> day streak
                    </p>
                    <p className="text-xs text-gray-400">
                      best {u.longest_streak}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
