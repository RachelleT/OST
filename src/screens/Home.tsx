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
      className="block rounded-3xl p-5 no-underline transition-opacity hover:opacity-90 active:opacity-80 flex-shrink-0"
      style={{ background: palette.bg, textDecoration: 'none', minWidth: 260 }}
    >
      {post.prompts?.text && (
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5 leading-snug" style={{ color: palette.textOnBg, opacity: 0.45 }}>
          {post.prompts.text}
        </p>
      )}
      {post.text && (
        <p className="text-sm font-medium leading-snug" style={{ color: palette.textOnBg }}>
          {post.text.length > 120 ? post.text.slice(0, 120) + '…' : post.text}
        </p>
      )}
      {authorName && (
        <p className="text-xs mt-3" style={{ color: palette.textOnBg, opacity: 0.5 }}>— {authorName}</p>
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
      .limit(3)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as FeaturedCard[]
        setFeaturedPosts(rows.filter(r => r.posts !== null))
      })
  }, [])

  return (
    <div className="min-h-full" style={{ background: '#FAF5EC' }}>

      {/* ── Hero — shorter so content is visible below ───────────── */}
      <div
        className="relative overflow-hidden flex flex-col"
        style={{ background: palette.bg, minHeight: '72vh' }}
      >
        <DayBackground palette={palette} />

        {/* Nav */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-10">
          <span className="text-xs font-bold tracking-[0.16em]" style={{ color: palette.textOnBg, opacity: 0.55 }}>
            DAYSPARK
          </span>
          <Link
            to="/sign-in"
            className="text-xs font-semibold px-4 py-2 rounded-full"
            style={{ background: palette.textOnBg, color: palette.bg }}
          >
            Sign in
          </Link>
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-5 pt-10 pb-14">
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: `${palette.textOnBg}22` }}
          >
            <span className="text-2xl" style={{ color: palette.textOnBg }}>✦</span>
          </div>

          <h1
            className="text-3xl font-semibold leading-tight tracking-tight mb-3"
            style={{ color: palette.textOnBg, maxWidth: 280 }}
          >
            One prompt a day.
            <br />
            Something quiet,
            <br />
            just for you.
          </h1>

          <p
            className="text-sm leading-relaxed mb-8"
            style={{ color: palette.textOnBg, opacity: 0.6, maxWidth: 260 }}
          >
            A tiny daily ritual. Write, build a streak, share if you want.
          </p>

          <Link
            to="/sign-in"
            className="inline-flex items-center gap-2 self-start rounded-full px-6 py-3.5 text-sm font-semibold transition-transform active:scale-95"
            style={{ background: palette.textOnBg, color: palette.bg }}
          >
            Get started →
          </Link>
        </div>

        {/* Scroll hint — peeks into next section */}
        <div className="relative z-10 flex items-center gap-2 px-5 pb-4" style={{ color: palette.textOnBg, opacity: 0.4 }}>
          <div className="flex-1 h-px" style={{ background: palette.textOnBg, opacity: 0.15 }} />
          <span className="text-xs tracking-widest">scroll</span>
          <div className="flex-1 h-px" style={{ background: palette.textOnBg, opacity: 0.15 }} />
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="px-5 py-12">
        <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-7">How it works</h2>
        <div className="space-y-5">
          {[
            { icon: '🌅', title: 'One prompt, every day', text: 'A new question each morning, chosen to make you pause and think.' },
            { icon: '✏️', title: '280 characters or a photo', text: 'No pressure. Write as little or as much as feels right.' },
            { icon: '🔥', title: 'Build a streak', text: 'Show up every day. Miss one? Use your weekly grace day.' },
            { icon: '🔒', title: 'Yours by default', text: 'Everything is private until you choose to share it.' },
          ].map(({ icon, title, text }) => (
            <div key={title} className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-sm">
              <span className="text-2xl leading-none mt-0.5">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-0.5">{title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured posts ───────────────────────────────────────── */}
      {featuredPosts.length >= 3 && (
        <section className="py-10 border-t border-gray-100">
          <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-6 px-5">What people are writing</h2>
          {/* Horizontal scroll on mobile */}
          <div className="flex gap-4 overflow-x-auto px-5 pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
            {featuredPosts.map(card => (
              <div key={card.post_id} className="snap-start flex-shrink-0 w-[72vw] max-w-xs">
                <PostCard card={card} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="px-5 py-14 text-center border-t border-gray-100">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: '#2DBFA8' }}
        >
          <span className="text-xl text-white">✦</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2 tracking-tight">Start your first prompt</h2>
        <p className="text-sm text-gray-500 mb-7 max-w-xs mx-auto leading-relaxed">
          Free. No app store. Works on any phone. Just sign in with your email.
        </p>
        <Link
          to="/sign-in"
          className="inline-block rounded-full px-8 py-4 text-sm font-semibold text-white transition-transform active:scale-95"
          style={{ background: '#04342C' }}
        >
          Sign in with email →
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="px-5 py-8 border-t border-gray-100 text-center space-y-3">
        <p className="text-xs font-bold tracking-[0.12em] text-gray-400">DAYSPARK BY YUVOICE</p>
        <div className="flex justify-center gap-5 text-xs text-gray-400">
          <Link to="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
          <a href="mailto:makehistory@yuvoice.com" className="hover:text-gray-600 transition-colors">Contact</a>
        </div>
        <p className="text-xs text-gray-300">© 2026 Yuvoice</p>
      </footer>
    </div>
  )
}
