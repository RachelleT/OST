import type { Palette } from '../lib/palette'

interface Props {
  palette: Palette
}

const SHAPES: Record<string, (p: Palette) => React.ReactElement> = {
  Monday: (p) => (
    <svg viewBox="0 0 320 580" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <path d="M 220 -30 Q 340 0 340 90 Q 340 180 260 170 Q 200 150 210 70 Q 215 10 220 -30 Z" fill={p.dark} />
      <path d="M -30 420 Q 80 380 140 430 Q 200 490 140 530 Q 60 560 -30 530 Q -50 470 -30 420 Z" fill={p.light} />
      <circle cx="60" cy="100" r="11" fill={p.accent} />
      <circle cx="270" cy="380" r="5" fill={p.accent} />
      <circle cx="180" cy="240" r="4" fill={p.light} />
    </svg>
  ),
  Tuesday: (p) => (
    <svg viewBox="0 0 320 580" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <path d="M 280 -20 Q 360 60 340 160 Q 320 240 240 200 Q 180 160 220 80 Q 250 20 280 -20 Z" fill={p.dark} />
      <path d="M -40 460 Q 60 420 120 470 Q 170 520 110 560 Q 40 590 -40 555 Z" fill={p.light} />
      <circle cx="50" cy="80" r="9" fill={p.accent} />
      <circle cx="260" cy="420" r="6" fill={p.accent} />
      <circle cx="160" cy="260" r="4" fill={p.light} />
    </svg>
  ),
  Wednesday: (p) => (
    <svg viewBox="0 0 320 580" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <path d="M 200 -40 Q 340 -10 350 100 Q 355 190 270 180 Q 200 165 205 80 Q 205 15 200 -40 Z" fill={p.dark} />
      <path d="M -30 440 Q 90 400 150 455 Q 200 510 140 545 Q 60 570 -30 540 Z" fill={p.light} />
      <circle cx="70" cy="90" r="10" fill={p.accent} />
      <circle cx="255" cy="390" r="5" fill={p.accent} />
      <circle cx="170" cy="250" r="4" fill={p.light} />
    </svg>
  ),
  Thursday: (p) => (
    <svg viewBox="0 0 320 580" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <path d="M 240 -30 Q 350 20 345 120 Q 338 210 255 190 Q 190 170 210 85 Q 225 15 240 -30 Z" fill={p.dark} />
      <path d="M -40 450 Q 70 410 130 465 Q 185 520 120 555 Q 45 580 -40 548 Z" fill={p.light} />
      <circle cx="55" cy="85" r="10" fill={p.accent} />
      <circle cx="265" cy="400" r="5" fill={p.accent} />
      <circle cx="175" cy="245" r="4" fill={p.light} />
    </svg>
  ),
  Friday: (p) => (
    <svg viewBox="0 0 320 580" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <path d="M 210 -35 Q 345 5 348 105 Q 350 195 265 178 Q 198 158 208 75 Q 213 10 210 -35 Z" fill={p.dark} />
      <path d="M -35 430 Q 75 392 138 445 Q 195 500 133 538 Q 55 563 -35 533 Z" fill={p.light} />
      <circle cx="65" cy="95" r="11" fill={p.accent} />
      <circle cx="258" cy="388" r="5" fill={p.accent} />
      <circle cx="172" cy="242" r="4" fill={p.light} />
    </svg>
  ),
  Saturday: (p) => (
    <svg viewBox="0 0 320 580" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <path d="M 225 -28 Q 348 8 345 108 Q 341 198 258 182 Q 194 162 207 78 Q 216 12 225 -28 Z" fill={p.dark} />
      <path d="M -38 442 Q 74 402 136 458 Q 190 515 128 550 Q 50 575 -38 544 Z" fill={p.light} />
      <circle cx="62" cy="88" r="10" fill={p.accent} />
      <circle cx="262" cy="395" r="6" fill={p.accent} />
      <circle cx="174" cy="248" r="4" fill={p.light} />
    </svg>
  ),
  Sunday: (p) => (
    <svg viewBox="0 0 320 580" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <path d="M 215 -32 Q 346 4 344 106 Q 342 196 260 180 Q 196 160 208 76 Q 214 11 215 -32 Z" fill={p.dark} />
      <path d="M -36 438 Q 76 398 138 452 Q 192 508 130 544 Q 52 568 -36 538 Z" fill={p.light} />
      <circle cx="63" cy="92" r="10" fill={p.accent} />
      <circle cx="260" cy="392" r="5" fill={p.accent} />
      <circle cx="173" cy="244" r="4" fill={p.light} />
    </svg>
  ),
}

export default function DayBackground({ palette }: Props) {
  const renderShapes = SHAPES[palette.dayName]
  if (!renderShapes) return null
  return renderShapes(palette)
}
