import { Link } from 'react-router-dom'

export default function Contact() {
  return (
    <div className="min-h-full px-5 py-12 max-w-2xl mx-auto flex flex-col" style={{ background: '#FAF5EC' }}>
      <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 mb-8 inline-block">← Dayspark</Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2 tracking-tight">Contact</h1>

      <div className="mt-6 space-y-5 text-sm text-gray-700 leading-relaxed">
        <p>
          Dayspark is made by <strong>Yuvoice</strong>. We're a small team and we read every email.
        </p>
        <p>
          For questions, feedback, account issues, or data requests, reach us at:
        </p>
        <a
          href="mailto:makehistory@yuvoice.com"
          className="inline-block text-base font-medium text-teal-700 underline underline-offset-2"
        >
          makehistory@yuvoice.com
        </a>
        <p className="text-gray-400 text-xs">
          We aim to respond within 2 business days.
        </p>
      </div>
    </div>
  )
}
