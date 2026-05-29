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
      className="block rounded-3xl p-6 no-underline transition-opacity hover:opacity-90 active:opacity-80"
      style={{ background: palette.bg, textDecoration: 'none' }}
    >
      {post.prompts?.text && (
        <p className="text-xs font-semibold uppercase tracking-widest mb-3 leading-snug" style={{ color: palette.textOnBg, opacity: 0.5 }}>
          {post.prompts.text}
        </p>
      )}
      {post.text && (
        <p className="text-base font-medium leading-snug" style={{ color: palette.textOnBg }}>
          {post.text.length > 140 ? post.text.slice(0, 140) + '…' : post.text}
        </p>
      )}
      {authorName && (
        <p className="text-xs mt-3" style={{ color: palette.textOnBg, opacity: 0.55 }}>— {authorName}</p>
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

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: palette.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <DayBackground palette={palette} />

        {/* Nav */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-10 pb-2">
          <span className="text-xs font-bold tracking-[0.14em]" style={{ color: palette.textOnBg, opacity: 0.6 }}>
            DAYSPARK
          </span>
          <Link
            to="/sign-in"
            className="text-xs font-semibold px-4 py-2 rounded-full transition-opacity hover:opacity-80"
            style={{ background: palette.textOnBg, color: palette.bg }}
          >
            Sign in
          </Link>
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
          <h1
            className="text-4xl font-semibold leading-tight tracking-tight mb-4 max-w-xs"
            style={{ color: palette.textOnBg }}
          >
            One prompt a day. Something quiet, just for you.
          </h1>
          <p
            className="text-base leading-relaxed mb-10 max-w-xs"
            style={{ color: palette.textOnBg, opacity: 0.65 }}
          >
            A tiny daily ritual. No audience, no pressure — just a moment to think and write.
          </p>
          <Link
            to="/sign-in"
            className="inline-block rounded-full px-8 py-4 text-sm font-semibold transition-transform active:scale-95"
            style={{ background: palette.textOnBg, color: palette.bg }}
          >
            Start →
          </Link>
        </div>

        {/* Scroll hint */}
        <div className="relative z-10 flex justify-center pb-8">
          <span className="text-xs tracking-widest" style={{ color: palette.textOnBg, opacity: 0.3 }}>↓</span>
        </div>
      </div>

      {/* ── Featured posts ──────────────────────────────────────────── */}
      {featuredPosts.length >= 3 && (
        <section className="px-5 py-14">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 tracking-tight">What people are writing</h2>
          <div className="space-y-4">
            {featuredPosts.map(card => (
              <PostCard key={card.post_id} card={card} />
            ))}
          </div>
        </section>
      )}

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className="px-5 py-12 border-t border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-8 tracking-tight">How it works</h2>
        <ol className="space-y-6">
          {[
            { n: '1', icon: '🌅', text: 'One prompt every day — different for everyone.' },
            { n: '2', icon: '✏️', text: 'Answer in 280 characters or a photo.' },
            { n: '3', icon: '🔥', text: 'Build a streak. Miss a day? Use a grace day.' },
          ].map(({ n, icon, text }) => (
            <li key={n} className="flex items-start gap-4">
              <span className="text-2xl leading-none">{icon}</span>
              <p className="text-sm text-gray-600 leading-relaxed pt-0.5">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <Link
            to="/sign-in"
            className="inline-block rounded-full px-7 py-3.5 text-sm font-semibold text-white transition-transform active:scale-95"
            style={{ background: '#04342C' }}
          >
            Get started — it's free
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="px-5 py-10 border-t border-gray-100 text-center space-y-3">
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
