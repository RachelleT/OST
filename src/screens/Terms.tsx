import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="min-h-full px-5 py-12 max-w-2xl mx-auto" style={{ background: '#FAF5EC' }}>
      <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 mb-8 inline-block">← Dayspark</Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2 tracking-tight">Terms of Service</h1>
      <p className="text-xs text-gray-400 mb-8">Last updated: May 2026</p>

      <div className="text-sm leading-relaxed text-gray-700 space-y-6">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Using Dayspark</h2>
          <p>Dayspark is a personal journaling tool. By creating an account, you agree to use it for personal, non-commercial journaling only. You must be at least 13 years old to use Dayspark.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Your content</h2>
          <p>You own everything you write. By making a post public, you grant Yuvoice a non-exclusive licence to display that post within the app and on Dayspark's public surfaces (the Feed, featured post pages, and the homepage). You can revoke this at any time by making the post private again.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Acceptable use</h2>
          <p>Don't use Dayspark to post content that is:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Illegal or promotes illegal activity</li>
            <li>Harassing, threatening, or abusive toward any person</li>
            <li>Spam, advertising, or commercial solicitation</li>
            <li>Content that infringes someone else's intellectual property</li>
          </ul>
          <p>Violating these rules may result in your posts being hidden or your account being deactivated.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Moderation</h2>
          <p>Admins may hide posts that violate these terms or are otherwise inappropriate for the community. If your post is hidden, you'll still be able to see it in your own History.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">No warranty</h2>
          <p>Dayspark is provided as-is. We don't guarantee uptime, data retention beyond what's described in our Privacy Policy, or that the service will remain available indefinitely. Use it because it's useful, not because it's guaranteed.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Contact</h2>
          <p>Questions about these terms? Email <a href="mailto:makehistory@yuvoice.com" className="text-teal-600 underline">makehistory@yuvoice.com</a>.</p>
        </section>
      </div>
    </div>
  )
}
