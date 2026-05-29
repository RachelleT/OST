import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import FeedPostCard, { type FeedPost } from '../components/FeedPostCard'

const PAGE_SIZE = 20
const NEUTRAL_BG = '#F1EFE8'

function SkeletonCard() {
  return (
    <div className="bg-white rounded-[18px] p-4 animate-pulse" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
      <div className="h-3 bg-gray-100 rounded w-full mb-2" />
      <div className="h-3 bg-gray-100 rounded w-4/5 mb-4" />
      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
        <div className="h-3 bg-gray-100 rounded w-1/4" />
        <div className="h-6 bg-gray-100 rounded-full w-14" />
      </div>
    </div>
  )
}

export default function Feed() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  async function loadPosts(cursor: string | null, replace: boolean) {
    try {
      const { data, error } = await supabase.rpc('get_feed', {
        cursor_created_at: cursor,
        page_size: PAGE_SIZE,
      })
      if (error) throw error
      const rows = (data ?? []) as FeedPost[]
      setPosts(prev => replace ? rows : [...prev, ...rows])
      setHasMore(rows.length === PAGE_SIZE)
    } catch {
      setLoadError(true)
    }
  }

  // Initial load
  useEffect(() => {
    setIsLoading(true)
    setLoadError(false)
    loadPosts(null, true).finally(() => setIsLoading(false))
  }, [])

  // Infinite scroll via IntersectionObserver
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || posts.length === 0) return
    const cursor = posts[posts.length - 1].created_at
    setIsLoadingMore(true)
    await loadPosts(cursor, false)
    setIsLoadingMore(false)
  }, [isLoadingMore, hasMore, posts])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  // Pull-to-refresh
  async function handleRefresh() {
    setLoadError(false)
    setHasMore(true)
    setIsLoading(true)
    await loadPosts(null, true)
    setIsLoading(false)
  }

  // Optimistic reaction toggle
  function handleReactionToggle(postId: string, newReacted: boolean) {
    setPosts(prev => prev.map(p =>
      p.post_id === postId
        ? {
            ...p,
            user_reacted: newReacted,
            reaction_count: newReacted ? p.reaction_count + 1 : Math.max(0, p.reaction_count - 1),
          }
        : p
    ))
  }

  return (
    <div className="min-h-full flex flex-col" style={{ background: NEUTRAL_BG }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-4">
        <h1 className="text-2xl font-medium text-gray-900 tracking-tight">Feed</h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
          aria-label="Refresh feed"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 px-4 pb-8 space-y-3">
        {/* Loading state */}
        {isLoading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {/* Error state */}
        {!isLoading && loadError && (
          <div className="text-center py-16 space-y-3">
            <p className="text-gray-500 text-sm">Couldn't load the Feed.</p>
            <button
              onClick={handleRefresh}
              className="text-sm underline text-gray-400 hover:text-gray-600"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !loadError && posts.length === 0 && (
          <div className="text-center py-20 space-y-3 px-6">
            <p className="text-2xl">✨</p>
            <p className="text-gray-700 font-medium">The Feed is just getting started.</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Be the first to share a post.
            </p>
            <Link
              to="/"
              className="inline-block mt-2 text-sm underline text-gray-400 hover:text-gray-600"
            >
              Go to Today →
            </Link>
          </div>
        )}

        {/* Posts */}
        {!isLoading && posts.map(post => (
          <FeedPostCard
            key={post.post_id}
            post={post}
            onReactionToggle={handleReactionToggle}
          />
        ))}

        {/* Load more sentinel + skeleton */}
        {!isLoading && hasMore && posts.length > 0 && (
          <>
            <div ref={sentinelRef} />
            {isLoadingMore && <SkeletonCard />}
          </>
        )}

        {/* End of feed */}
        {!isLoading && !hasMore && posts.length > 0 && (
          <p className="text-center text-xs text-gray-300 py-6">You're all caught up ✦</p>
        )}
      </div>
    </div>
  )
}
