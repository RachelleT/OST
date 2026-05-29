import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="min-h-full px-5 py-12 max-w-2xl mx-auto" style={{ background: '#FAF5EC' }}>
      <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 mb-8 inline-block">← Dayspark</Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2 tracking-tight">Privacy Policy</h1>
      <p className="text-xs text-gray-400 mb-8">Last updated: May 2026</p>

      <div className="prose prose-sm text-gray-700 space-y-6 text-sm leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Who we are</h2>
          <p>Dayspark is a daily journaling app operated by Yuvoice. We help you build a quiet daily writing habit. You can reach us at <a href="mailto:makehistory@yuvoice.com" className="text-teal-600 underline">makehistory@yuvoice.com</a>.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">What we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Email address</strong> — used to sign you in via magic link. We never send marketing without your explicit consent.</li>
            <li><strong>Posts and photos</strong> — the text and images you write each day. Stored securely in our database.</li>
            <li><strong>Reactions</strong> — ✨ reactions you leave on other users' public posts.</li>
            <li><strong>Push notification tokens</strong> — if you opt in to daily reminders, we store a device token to deliver them.</li>
            <li><strong>Timezone and reminder preference</strong> — so reminders arrive at the right time for you.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">How we use it</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To show you your own posts, streak, and history.</li>
            <li>To deliver daily reminder notifications if you've opted in.</li>
            <li>To show public posts on the Feed and on featured post pages, when you've chosen to share them.</li>
            <li>To let admins curate featured posts on the homepage, if a post has been made public.</li>
          </ul>
          <p>We do not sell your data. We do not share it with third parties beyond our infrastructure providers (Supabase for the database and Vercel for hosting).</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Your posts are private by default</h2>
          <p>Everything you write is visible only to you unless you explicitly toggle "Share publicly" on a post. Even then, admins can only feature a post externally if you've made it public and they choose to. You can revoke public sharing at any time from your History.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">How long we keep it</h2>
          <p>We keep your data for as long as your account is active. If you deactivate your account, your data remains in our database for 30 days before being purged, in case you change your mind.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Your rights</h2>
          <p>You can request a copy of your data, or ask us to delete your account and all associated data, at any time by emailing <a href="mailto:makehistory@yuvoice.com" className="text-teal-600 underline">makehistory@yuvoice.com</a>. We'll respond within 30 days.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Changes</h2>
          <p>If we make material changes to this policy, we'll notify you by email before they take effect.</p>
        </section>
      </div>
    </div>
  )
}
