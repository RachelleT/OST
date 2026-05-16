// Starter pool matching 0009_seed_notes.sql — kept in sync for reference.
// M3 Step 2g deletes this file once admin CRUD is verified.

export interface NoteData {
  text: string
  pool: 'empty_state' | 'completed_state'
  day_of_week: number | null // 0=Mon..6=Sun, null=any
}

export const STARTER_NOTES: NoteData[] = [
  // Empty state
  { text: "There's no wrong answer to this one.",              pool: 'empty_state', day_of_week: null },
  { text: 'Permission granted to keep it short.',               pool: 'empty_state', day_of_week: null },
  { text: 'Whatever you write is going to be the right thing today.', pool: 'empty_state', day_of_week: null },
  { text: "You showed up. That's already the hard part.",      pool: 'empty_state', day_of_week: null },
  { text: 'Sleepy thoughts are honest thoughts.',               pool: 'empty_state', day_of_week: null },
  { text: 'Brain still warming up? Same.',                      pool: 'empty_state', day_of_week: null },
  { text: 'Permission to make this one boring.',                pool: 'empty_state', day_of_week: null },
  { text: 'Wednesdays are secretly the bravest day.',           pool: 'empty_state', day_of_week: 2 },
  { text: 'Sunday is just Monday in soft pajamas.',             pool: 'empty_state', day_of_week: 6 },
  { text: 'Mondays earn their reputation. Be gentle.',          pool: 'empty_state', day_of_week: 0 },

  // Completed state
  { text: 'Look at you, showing up.',        pool: 'completed_state', day_of_week: null },
  { text: "Nice. That's today done.",        pool: 'completed_state', day_of_week: null },
  { text: 'One more honest moment in the bank.', pool: 'completed_state', day_of_week: null },
  { text: 'That counts.',                    pool: 'completed_state', day_of_week: null },
  { text: 'Stick around tomorrow.',          pool: 'completed_state', day_of_week: null },
  { text: 'Quiet wins are still wins.',      pool: 'completed_state', day_of_week: null },
]
