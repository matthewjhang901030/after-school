/**
 * English (en) UI strings — translation of zh-TW.js.
 * Exposed as window.AS_I18N_EN.
 */
(function () {
  window.AS_I18N_EN = {
    // ── Navigation ──────────────────────────────────────────────────────────
    'nav.dashboard':   'Home',
    'nav.cards':       'Cards',
    'nav.review':      'Review',
    'nav.decks':       'Decks',
    'nav.games':       'Games',
    'nav.stats':       'Stats',
    'nav.stamps':      'Stamp Book',
    'nav.settings':    'Settings',

    // ── App shell ───────────────────────────────────────────────────────────
    'app.name':           'After School',
    'app.tagline':        'Real English practice, after the bell.',
    'app.offline':        'Offline',
    'app.exit_game':      'Exit Game',
    'app.exit_confirm':   'Exit the game? This session will not be saved.',
    'app.exit_yes':       'Exit',
    'app.exit_no':        'Keep Playing',

    // ── Buttons ─────────────────────────────────────────────────────────────
    'btn.start':          'Start',
    'btn.close':          'Close',
    'btn.cancel':         'Cancel',
    'btn.confirm':        'Confirm',
    'btn.retry':          'Retry',
    'btn.save':           'Save',
    'btn.undo':           'Undo',
    'btn.delete':         'Delete',
    'btn.edit':           'Edit',
    'btn.add':            'Add',
    'btn.back':           'Back',
    'btn.next':           'Next',
    'btn.finish':         'Done',
    'btn.skip':           'Skip',
    'btn.stop':           'Stop',
    'btn.play':           'Play',

    // ── Error states ────────────────────────────────────────────────────────
    'error.generic':      'Something went wrong. Please try again.',
    'error.load':         'Failed to load.',
    'error.save':         'Failed to save. Please try again.',
    'error.quota':        'Storage full. Data is kept in memory and will be lost on refresh.',
    'error.unknown_route':'Page not found. Returning to home.',

    // ── Empty states ────────────────────────────────────────────────────────
    'empty.cards':        'No cards yet. Add your first one.',
    'empty.decks':        'No decks yet. Create your first one.',
    'empty.attempts':     'Your progress will appear here after your first session.',
    'empty.stamps':       'No stamps yet. Complete a session to earn your first!',
    'empty.stats':        'Start reviewing to see your statistics here.',

    // ── Dashboard ───────────────────────────────────────────────────────────
    'dashboard.title':          "Today's Schedule",
    'dashboard.streak':         '{n}-day streak',
    'dashboard.streak_one':     '1-day streak',
    'dashboard.hardest':        "This Week's Hard Words",
    'dashboard.loop_step':      'Learning Loop',
    'dashboard.ai_advice':      'AI Advice',
    'dashboard.demo_banner':    'Demo data is active',
    'dashboard.demo_clear':     'Clear demo data',

    // ── Today's timetable ───────────────────────────────────────────────────
    'timetable.period':         'Period {n}',
    'timetable.card_review':    'Card Review',
    'timetable.class13':        'Class 13',
    'timetable.wall':           "Today's Wall",
    'timetable.guess':          'Describe & Guess',
    'timetable.after_school':   'After School',
    'timetable.done':           'Done',
    'timetable.skip':           'Skip',

    // ── Cards ───────────────────────────────────────────────────────────────
    'cards.title':              'Cards',
    'cards.search':             'Search words…',
    'cards.filter_all':         'All',
    'cards.filter_due':         'Due',
    'cards.add':                'Add Card',
    'cards.detail':             'Card Detail',
    'cards.history':            'Learning History',
    'cards.flip_hint':          'Tap to flip · Swipe to rate',
    'cards.know':               'Got it',
    'cards.unknown':            'Not yet',
    'cards.hide':               'Hide this card',
    'cards.unhide':             'Show this card',
    'cards.delete_confirm':     'Delete "{word}"? This cannot be undone.',
    'cards.undo_hide':          'Hidden "{word}".',
    'cards.undo_delete':        'Deleted "{word}".',

    // ── Leitner / Review ────────────────────────────────────────────────────
    'review.title':             "Today's Review",
    'review.due':               '{n} cards due',
    'review.done':              "Today's review complete!",
    'review.box':               'Box {n}',
    'review.promoted':          'Moved to box {n}',
    'review.demoted':           'Back to box 1',

    // ── Decks ───────────────────────────────────────────────────────────────
    'decks.title':              'Decks',
    'decks.create':             'Create Deck',
    'decks.name_placeholder':   'Deck name',
    'decks.card_count':         '{n} cards',

    // ── Games hub ───────────────────────────────────────────────────────────
    'games.title':              'Games',
    'games.personal_best':      'Personal Best',
    'games.class13.name':       'Class 13',
    'games.class13.desc':       'Typing survival: type the correct word before the monster reaches you.',
    'games.guess.name':         'Describe & Guess',
    'games.guess.desc':         'Describe a word in Chinese and let the AI guess it.',
    'games.wall.name':          'Word Wall',
    'games.wall.desc':          'Find four groups of four connected words.',

    // ── Skill tabs ─────────────────────────────────────────────────────────
    'skill.vocab':              'Vocab',
    'skill.grammar':            'Grammar',
    'skill.dialogue':           'Dialogue',

    // ── AI panel ───────────────────────────────────────────────────────────
    'ai.disclaimer':            'AI may make mistakes. Always check the card content.',
    'ai.source.nano':           'Gemini Nano',
    'ai.source.qwen':           'Qwen 2.5',
    'ai.source.template':       'Offline Template',
    'ai.downloading':           'Downloading AI model ({mb} MB)…',
    'ai.download_done':         'AI model ready.',
    'ai.download_error':        'Model download interrupted. Using offline templates.',

    // ── Settings ───────────────────────────────────────────────────────────
    'settings.title':           'Settings',
    'settings.language':        'Language',
    'settings.theme':           'Theme',
    'settings.theme.auto':      'Follow system',
    'settings.theme.light':     'Afternoon (light)',
    'settings.theme.dark':      'Night (dark)',
    'settings.daily_new':       'New words per day',
    'settings.periods':         'Periods per day',
    'settings.auto_play':       'Auto-play pronunciation',
    'settings.speech_rate':     'Speech rate',
    'settings.safe_mode':       'Safe mode',
    'settings.safe_mode.desc':  'Removes horror atmosphere effects in Class 13.',
    'settings.ai_engine':       'AI engine',
    'settings.ai_engine.auto':  'Auto',
    'settings.ai_engine.nano':  'Gemini Nano',
    'settings.ai_engine.qwen':  'Qwen 2.5',
    'settings.ai_engine.tpl':   'Offline templates',
    'settings.storage':         'Storage',
    'settings.export':          'Export data',
    'settings.import':          'Import data',
    'settings.reset':           'Reset all data',
    'settings.reset.confirm':   'Type "delete" to confirm resetting all data.',
    'settings.reset.keyword':   'delete',
    'settings.demo_load':       'Load demo data',
    'settings.ai_diag':         'AI diagnostics',

    // ── Statistics ─────────────────────────────────────────────────────────
    'stats.title':              'Statistics',
    'stats.filter.7d':          '7 days',
    'stats.filter.30d':         '30 days',
    'stats.filter.all':         'All time',
    'stats.show_table':         'Show as table',
    'stats.leitner':            'Leitner distribution',
    'stats.accuracy':           '14-day accuracy',
    'stats.calendar':           'Study calendar',
    'stats.by_skill':           'Accuracy by skill',
    'stats.keymap':             'Keyboard heatmap',
    'stats.confusion':          'Confusion pairs',
    'stats.bests':              'Personal bests',

    // ── Stamps ─────────────────────────────────────────────────────────────
    'stamps.title':             'Stamp Book',
    'stamps.locked_hint':       'Complete the condition to unlock.',

    // ── Misc ────────────────────────────────────────────────────────────────
    'misc.loading':             'Loading…',
    'misc.period_unit':         'period',
    'misc.day_unit':            'day',
    'misc.word_unit':           'words',
    'misc.accuracy_unit':       'accuracy',
  };
})();
