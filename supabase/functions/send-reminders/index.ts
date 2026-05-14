import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const TITLES = [
  "Today's prompt is waiting ✦",
  "A moment for you ✦",
  "Your daily reflection ✦",
  "One small thing, just for you ✦",
]

function pickTitle(userId: string, date: string): string {
  // Deterministic but varied: hash userId+date to an index
  let h = 0
  for (const c of userId + date) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return TITLES[Math.abs(h) % TITLES.length]
}

/** Returns YYYY-MM-DD for the given timezone right now. */
function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/** Returns the current HH:MM in the given timezone. */
function currentHHMM(timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).replace(/^24/, '00')
}

/** True if reminderHHMM falls within the last 15-minute window from now. */
function isInCurrentWindow(reminderHHMM: string, currentHHMM: string): boolean {
  const [rh, rm] = reminderHHMM.split(':').map(Number)
  const [ch, cm] = currentHHMM.split(':').map(Number)
  const rTotal = rh * 60 + rm
  const cTotal = ch * 60 + cm
  // Window: [cTotal-14, cTotal] inclusive
  return rTotal >= cTotal - 14 && rTotal <= cTotal
}

/**
 * Back-off check: if the user's last 3 reminders all went un-posted,
 * send on alternate days only (even/odd date number).
 */
async function isBackedOff(userId: string, todayDate: string): Promise<boolean> {
  // Get last 3 reminder dates (not including today)
  const { data: logs } = await supabase
    .from('reminder_log')
    .select('date')
    .eq('user_id', userId)
    .lt('date', todayDate)
    .order('date', { ascending: false })
    .limit(3)

  if (!logs || logs.length < 3) return false

  // Check if each of those dates had a post
  const dates = logs.map((r: { date: string }) => r.date)
  const { data: posts } = await supabase
    .from('posts')
    .select('date')
    .eq('user_id', userId)
    .in('date', dates)

  const postedDates = new Set((posts ?? []).map((p: { date: string }) => p.date))
  const allMissed = dates.every(d => !postedDates.has(d))
  if (!allMissed) return false

  // Every-other-day: send on even day-of-month only
  const dayNum = parseInt(todayDate.slice(-2), 10)
  return dayNum % 2 !== 0
}

Deno.serve(async () => {
  try {
    // Fetch all users who have a reminder_time and at least one push subscription
    const { data: users, error: usersErr } = await supabase
      .from('profiles')
      .select(`
        id,
        timezone,
        reminder_time,
        push_subscriptions ( endpoint, p256dh, auth )
      `)
      .not('reminder_time', 'is', null)

    if (usersErr) throw usersErr

    let sent = 0
    let skipped = 0

    for (const user of users ?? []) {
      const subs = user.push_subscriptions as { endpoint: string; p256dh: string; auth: string }[]
      if (!subs || subs.length === 0) { skipped++; continue }

      const tz = user.timezone || 'UTC'
      const today = todayIn(tz)
      const nowHHMM = currentHHMM(tz)
      // DB stores reminder_time as HH:MM:SS — normalise
      const reminderHHMM = (user.reminder_time as string).slice(0, 5)

      if (!isInCurrentWindow(reminderHHMM, nowHHMM)) { skipped++; continue }

      // Already posted today?
      const { count: postCount } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date', today)

      if ((postCount ?? 0) > 0) { skipped++; continue }

      // Already sent a reminder today?
      const { count: logCount } = await supabase
        .from('reminder_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date', today)

      if ((logCount ?? 0) > 0) { skipped++; continue }

      // Back-off check
      if (await isBackedOff(user.id, today)) { skipped++; continue }

      // Fetch today's prompt for this user
      const { data: assignment } = await supabase
        .from('daily_assignments')
        .select('prompts ( text )')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle()

      const promptText = (assignment?.prompts as { text: string } | null)?.text
        ?? 'Come back and reflect on today.'

      const title = pickTitle(user.id, today)
      const payload = JSON.stringify({ title, body: promptText, url: '/' })

      // Send to all subscriptions for this user (multi-device)
      const results = await Promise.allSettled(
        subs.map(sub =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
        )
      )

      // Remove stale subscriptions (410 Gone)
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status === 'rejected') {
          const err = r.reason as { statusCode?: number }
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', subs[i].endpoint)
          }
        }
      }

      const anySent = results.some(r => r.status === 'fulfilled')
      if (anySent) {
        // Log the reminder
        await supabase.from('reminder_log').insert({ user_id: user.id, date: today })
        sent++
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent, skipped }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('send-reminders error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
