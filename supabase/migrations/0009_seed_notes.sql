-- M2.1: seed the 16 starter warm notes
-- day_of_week: 0=Monday .. 6=Sunday, null = any day

insert into notes (text, pool, day_of_week) values
  -- Empty state notes (shown before the user has posted today)
  ('There''s no wrong answer to this one.',              'empty_state', null),
  ('Permission granted to keep it short.',               'empty_state', null),
  ('Whatever you write is going to be the right thing today.', 'empty_state', null),
  ('You showed up. That''s already the hard part.',      'empty_state', null),
  ('Sleepy thoughts are honest thoughts.',               'empty_state', null),
  ('Brain still warming up? Same.',                      'empty_state', null),
  ('Permission to make this one boring.',                'empty_state', null),
  ('Wednesdays are secretly the bravest day.',           'empty_state', 2),
  ('Sunday is just Monday in soft pajamas.',             'empty_state', 6),
  ('Mondays earn their reputation. Be gentle.',          'empty_state', 0),

  -- Completed state notes (shown after the user has posted today)
  ('Look at you, showing up.',       'completed_state', null),
  ('Nice. That''s today done.',      'completed_state', null),
  ('One more honest moment in the bank.', 'completed_state', null),
  ('That counts.',                   'completed_state', null),
  ('Stick around tomorrow.',         'completed_state', null),
  ('Quiet wins are still wins.',     'completed_state', null);
