import type { Palette } from '../lib/palette'

interface ShareCardProps {
  palette: Palette
  promptText: string
  postText: string
  authorName?: string | null
  showName: boolean
}

// Square SVG shapes per day — adapted from DayBackground for 360×360 viewBox
const CARD_SHAPES: Record<string, (p: Palette) => React.ReactElement> = {
  Monday: (p) => (
    <svg viewBox="0 0 360 360" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <path d="M 250 -30 Q 390 0 390 100 Q 390 200 300 185 Q 230 165 245 80 Q 248 10 250 -30 Z" fill={p.dark} />
      <path d="M -30 270 Q 90 235 160 285 Q 220 335 155 370 Q 60 400 -30 365 Z" fill={p.light} />
      <circle cx="68" cy="110" r="12" fill={p.accent} />
      <circle cx="300" cy="260" r="6" fill={p.accent} />
    </svg>
  ),
  Tuesday: (p) => (
    <svg viewBox="0 0 360 360" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <path d="M 310 -20 Q 400 70 378 180 Q 358 270 270 225 Q 200 180 248 90 Q 280 20 310 -20 Z" fill={p.dark} />
      <path d="M -40 270 Q 68 230 138 285 Q 194 335 128 372 Q 45 400 -40 365 Z" fill={p.light} />
      <circle cx="55" cy="85" r="10" fill={p.accent} />
      <circle cx="290" cy="290" r="7" fill={p.accent} />
    </svg>
  ),
  Wednesday: (p) => (
    <svg viewBox="0 0 360 360" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <path d="M 225 -40 Q 385 -10 395 115 Q 400 215 305 202 Q 228 185 232 90 Q 232 15 225 -40 Z" fill={p.dark} />
      <path d="M -30 260 Q 103 220 170 278 Q 226 330 158 365 Q 68 390 -30 355 Z" fill={p.light} />
      <circle cx="80" cy="100" r="11" fill={p.accent} />
      <circle cx="288" cy="268" r="6" fill={p.accent} />
    </svg>
  ),
  Thursday: (p) => (
    <svg viewBox="0 0 360 360" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <path d="M 272 -30 Q 395 22 388 135 Q 381 237 287 213 Q 214 191 238 96 Q 254 17 272 -30 Z" fill={p.dark} />
      <path d="M -40 262 Q 80 222 148 277 Q 208 332 138 368 Q 50 394 -40 360 Z" fill={p.light} />
      <circle cx="62" cy="95" r="11" fill={p.accent} />
      <circle cx="298" cy="272" r="6" fill={p.accent} />
    </svg>
  ),
  Friday: (p) => (
    <svg viewBox="0 0 360 360" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <path d="M 238 -35 Q 390 5 392 118 Q 394 220 298 200 Q 223 178 235 84 Q 240 11 238 -35 Z" fill={p.dark} />
      <path d="M -35 254 Q 86 212 156 268 Q 218 322 148 358 Q 62 382 -35 348 Z" fill={p.light} />
      <circle cx="74" cy="106" r="12" fill={p.accent} />
      <circle cx="290" cy="262" r="6" fill={p.accent} />
    </svg>
  ),
  Saturday: (p) => (
    <svg viewBox="0 0 360 360" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <path d="M 255 -28 Q 392 8 390 122 Q 384 224 292 204 Q 219 184 234 88 Q 244 14 255 -28 Z" fill={p.dark} />
      <path d="M -38 258 Q 84 218 154 274 Q 214 328 143 364 Q 56 390 -38 356 Z" fill={p.light} />
      <circle cx="70" cy="98" r="11" fill={p.accent} />
      <circle cx="295" cy="266" r="7" fill={p.accent} />
    </svg>
  ),
  Sunday: (p) => (
    <svg viewBox="0 0 360 360" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <path d="M 244 -32 Q 390 4 387 118 Q 385 220 292 202 Q 220 182 234 86 Q 241 12 244 -32 Z" fill={p.dark} />
      <path d="M -36 256 Q 86 216 156 272 Q 216 326 145 362 Q 58 386 -36 352 Z" fill={p.light} />
      <circle cx="72" cy="102" r="11" fill={p.accent} />
      <circle cx="292" cy="264" r="6" fill={p.accent} />
    </svg>
  ),
}

// Rendered at 360×360; use pixelRatio:3 with html-to-image to get 1080×1080
export default function ShareCard({ palette, promptText, postText, authorName, showName }: ShareCardProps) {
  const shapes = CARD_SHAPES[palette.dayName]

  return (
    <div
      id="ost-share-card"
      style={{
        position: 'relative',
        width: 360,
        height: 360,
        background: palette.bg,
        borderRadius: 24,
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 32,
        boxSizing: 'border-box',
      }}
    >
      {shapes?.(palette)}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>

        {/* Prompt */}
        <p style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: palette.textOnBg,
          opacity: 0.55,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
          lineHeight: 1.4,
        }}>
          {promptText}
        </p>

        {/* Post text */}
        <p style={{
          fontSize: postText.length > 120 ? 18 : postText.length > 60 ? 22 : 26,
          fontWeight: 500,
          lineHeight: 1.3,
          color: palette.textOnBg,
          fontFamily: 'Georgia, "Times New Roman", serif',
          margin: '16px 0',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
        }}>
          {postText}
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {showName && authorName ? (
            <p style={{
              fontSize: 13,
              fontWeight: 500,
              color: palette.textOnBg,
              opacity: 0.7,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              margin: 0,
            }}>
              — {authorName}
            </p>
          ) : <span />}
          <p style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: palette.textOnBg,
            opacity: 0.4,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            margin: 0,
          }}>
            one small thing
          </p>
        </div>
      </div>
    </div>
  )
}
