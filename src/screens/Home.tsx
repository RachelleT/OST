import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dayPalette } from '../lib/palette'
import DayBackground from '../components/DayBackground'

interface FeaturedCard {
  post_id: string
  display_mode: string
  posts: {
    text: string | null
    date: string
    prompts: { text: string } | null
    profiles: { display_name: string; show_name_on_shared: boolean } | null
  } | null
}

function PostCard({ card }: { card: FeaturedCard }) {
  const post = card.posts
  if (!post) return null
  const palette = dayPalette(new Date(post.date + 'T12:00:00'))
  const showName = card.display_mode === 'with_name' && post.profiles?.show_name_on_shared
  const authorName = showName ? post.profiles?.display_name : null

  return (
    <Link
      to={`/p/${card.post_id}`}
      className="block rounded-2xl p-4 no-underline transition-opacity hover:opacity-90 active:opacity-80"
      style={{ background: palette.bg, textDecoration: 'none' }}
    >
      {post.prompts?.text && (
        <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 leading-snug" style={{ color: palette.textOnBg, opacity: 0.45 }}>
          {post.prompts.text}
        </p>
      )}
      {post.text && (
        <p className="text-xs font-medium leading-snug" style={{ color: palette.textOnBg }}>
          {post.text.length > 120 ? post.text.slice(0, 120) + '…' : post.text}
        </p>
      )}
      {authorName && (
        <p className="text-[11px] mt-2" style={{ color: palette.textOnBg, opacity: 0.5 }}>— {authorName}</p>
      )}
    </Link>
  )
}

export default function Home() {
  const today = new Date()
  const palette = dayPalette(today)
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedCard[]>([])

  useEffect(() => {
    supabase
      .from('featured_posts')
      .select('post_id, display_mode, posts(text, date, prompts(text), profiles(display_name, show_name_on_shared))')
      .is('unfeatured_at', null)
      .order('featured_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as FeaturedCard[]
        setFeaturedPosts(rows.filter(r => r.posts !== null))
      })
  }, [])

  return (
    <div className="min-h-full" style={{ background: '#FAF5EC' }}>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: palette.bg }}>
        <DayBackground palette={palette} />

        <div className="relative z-10 w-full px-6 lg:px-8">
          {/* Nav */}
          <div className="flex items-center justify-between pt-8 pb-6 max-w-6xl mx-auto">
            <span className="text-[10px] font-bold tracking-[0.16em]" style={{ color: palette.textOnBg, opacity: 0.55 }}>
              DAYSPARK
            </span>
            <Link
              to="/sign-in"
              className="text-xs font-semibold px-4 py-2 rounded-full text-center"
              style={{ background: palette.textOnBg, color: palette.bg }}
            >
              Sign in
            </Link>
          </div>

          {/* Hero: 2-column on lg, single column on mobile */}
          <div className="max-w-6xl mx-auto pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
              {/* Left: CTA */}
              <div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${palette.textOnBg}1A` }}
                >
                  <span className="text-xl" style={{ color: palette.textOnBg }}>✦</span>
                </div>
                <h1
                  className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight mb-3"
                  style={{ color: palette.textOnBg }}
                >
                  One prompt a day.
                  <br />
                  Something quiet,
                  <br />
                  just for you.
                </h1>
                <p className="text-sm leading-relaxed mb-6 max-w-sm" style={{ color: palette.textOnBg, opacity: 0.6 }}>
                  A tiny daily ritual. Write, build a streak, share if you want.
                </p>
                <Link
                  to="/sign-in"
                  className="inline-block rounded-full px-6 py-3 text-sm font-semibold transition-transform active:scale-95"
                  style={{ background: palette.textOnBg, color: palette.bg }}
                >
                  Get started →
                </Link>
              </div>

              {/* Right: Featured posts preview (lg+ only) */}
              <div className="hidden lg:flex flex-col gap-3">
                {featuredPosts.length >= 3 ? (
                  featuredPosts.slice(0, 3).map(card => (
                    <PostCard key={card.post_id} card={card} />
                  ))
                ) : (
                  // Placeholder cards when no featured posts exist yet
                  [
                    { color: '#F4C77B', prompt: 'Sunday prompt', post: 'What are you curious about today?' },
                    { color: '#2DBFA8', prompt: 'Monday prompt', post: 'Writing brings clarity.' },
                    { color: '#FF7A59', prompt: 'Tuesday prompt', post: 'Small moments, big meaning.' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="rounded-2xl p-4 bg-white"
                      style={{ borderLeft: `4px solid ${item.color}` }}
                    >
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 leading-snug" style={{ color: item.color, opacity: 0.5 }}>
                        {item.prompt}
                      </p>
                      <p className="text-xs font-medium leading-snug text-gray-600">
                        {item.post}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="px-6 py-10 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-4">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '🌅', title: 'One prompt, every day', text: 'A new question each morning, chosen to make you pause and think.' },
              { icon: '✏️', title: '280 characters or a photo', text: 'No pressure. Write as little or as much as feels right.' },
              { icon: '🔥', title: 'Build a streak', text: 'Show up every day. Miss one? Use your weekly grace day.' },
              { icon: '🔒', title: 'Yours by default', text: 'Everything is private until you choose to share it.' },
            ].map(({ icon, title, text }) => (
              <div key={title} className="flex items-start gap-3 bg-white rounded-lg px-3.5 py-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <span className="text-lg leading-none mt-px flex-shrink-0">{icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 mb-0.5">{title}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured posts ───────────────────────────────────────── */}
      {featuredPosts.length >= 3 && (
        <section className="py-8 border-t border-gray-100 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-4">More from the community</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {featuredPosts.slice(3).map(card => (
                <PostCard key={card.post_id} card={card} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="px-6 py-10 text-center border-t border-gray-100 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
            style={{ background: '#2DBFA8' }}
          >
            <span className="text-lg text-white">✦</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1.5 tracking-tight">Start your first prompt</h2>
          <p className="text-xs text-gray-500 mb-5 max-w-xs mx-auto leading-relaxed">
            Free. No app store. Works on any phone. Just sign in with your email.
          </p>
          <Link
            to="/sign-in"
            className="inline-block rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform active:scale-95"
            style={{ background: '#04342C' }}
          >
            Sign in with email →
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="px-6 py-6 border-t border-gray-100 text-center space-y-2.5 lg:px-8">
        <p className="text-[10px] font-bold tracking-[0.12em] text-gray-400">DAYSPARK BY YUVOICE</p>
        <div className="flex justify-center gap-4 text-[11px] text-gray-400">
          <Link to="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
          <a href="mailto:makehistory@yuvoice.com" className="hover:text-gray-600 transition-colors">Contact</a>
        </div>
        <p className="text-[10px] text-gray-300">© 2026 Yuvoice</p>
      </footer>
    </div>
  )
}
