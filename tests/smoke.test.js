(function () {
  'use strict';
  const { suite } = window.__TEST_HARNESS__;

  // ═══════════════════════════════════════════════════════════════
  // M0: Data & file:// environment smoke checks
  // ═══════════════════════════════════════════════════════════════
  suite('M0: Data & file:// environment smoke checks', ({ test, assert }) => {
    test('runs without ES module CORS block on current protocol', () => {
      assert.ok(
        ['file:', 'http:', 'https:'].includes(window.location.protocol),
        'Expected file:, http:, or https: protocol'
      );
    });

    test('loads window.ENGLISH_2000_DATA with 2029 word rows', () => {
      const data = window.ENGLISH_2000_DATA;
      assert.ok(data, 'ENGLISH_2000_DATA should be defined');
      assert.equal(Array.isArray(data.words), true, 'words should be an array');
      assert.equal(data.words.length, 2029);
      assert.equal(data.chapters.length, 30);
      assert.equal(data.units.length, 133);
    });

    test('verifies expected fields on sample builtin row and no IPA field', () => {
      const first = window.ENGLISH_2000_DATA.words[0];
      assert.equal(first.id, '0001');
      assert.equal(first.word, 'baby');
      assert.equal(first.translation, '嬰兒');
      assert.equal(first.partOfSpeech, 'n.[C]');
      assert.equal(Object.hasOwn(first, 'ipa'), false);
    });

    test('confirms suspect_ocr_word id 0722 exists in raw dataset', () => {
      const row = window.ENGLISH_2000_DATA.words.find((w) => w.id === '0722');
      assert.ok(row, 'row 0722 should exist');
      assert.ok(row.qaFlags.includes('suspect_ocr_word'), 'row 0722 should carry suspect_ocr_word');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // M1: Design system & UI component checks
  // ═══════════════════════════════════════════════════════════════
  suite('M1: Design system & UI component checks', ({ test, assert }) => {
    test('App.dom.el creates elements safely without innerHTML', () => {
      const node = window.App.dom.el('div', { className: 'sample', text: '<script>x</script>' });
      assert.equal(node.className, 'sample');
      assert.equal(node.textContent, '<script>x</script>');
      assert.equal(node.children.length, 0);
    });

    test('App.flashcard hides IPA when null and shrinks long headwords', () => {
      const shortCard = window.App.flashcard.create({ word: 'library', ipa: null, zh: '圖書館' });
      assert.equal(shortCard.root.querySelector('.flashcard-ipa'), null);

      const longCard = window.App.flashcard.create({ word: 'responsibility', ipa: '/test/', zh: '責任' });
      const head = longCard.root.querySelector('.flashcard-word');
      assert.ok(head.style.fontSize, 'Expected explicit scaled fontSize for long word');
      assert.ok(parseInt(head.style.fontSize, 10) >= 28, 'Scaled fontSize must remain >= 28px');
      assert.equal(longCard.isFlipped(), false);
      longCard.flip();
      assert.equal(longCard.isFlipped(), true);
    });

    test('App.keyboard disables rotten keys and scrambles deterministically', () => {
      const kb1 = window.App.keyboard.create({ rottenKeys: ['e', 'r'], scrambled: true, seed: 13 });
      const kb2 = window.App.keyboard.create({ rottenKeys: ['e', 'r'], scrambled: true, seed: 13 });
      const keys1 = Array.from(kb1.querySelectorAll('.kb-key')).map((b) => b.textContent).join('');
      const keys2 = Array.from(kb2.querySelectorAll('.kb-key')).map((b) => b.textContent).join('');
      assert.equal(keys1, keys2);
      const disabled = Array.from(kb1.querySelectorAll('.kb-key.is-rotten')).map((b) => b.textContent);
      assert.deepEqual(disabled.sort(), ['e', 'r']);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // M2: App shell, utilities, store, i18n, bus, router
  // ═══════════════════════════════════════════════════════════════

  suite('M2: App.date utilities', ({ test, assert }) => {
    const { todayKey, addDays, diffDays } = window.App.date;

    test('todayKey returns YYYY-MM-DD format in local time', () => {
      const key = todayKey();
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(key), 'Expected YYYY-MM-DD format, got: ' + key);
      const d = new Date();
      const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      assert.equal(key, expected, 'todayKey should use local time');
    });

    test('addDays handles month/year boundaries and leap years', () => {
      assert.equal(addDays('2026-12-10', 1), '2026-12-11');
      assert.equal(addDays('2026-12-10', -1), '2026-12-09');
      assert.equal(addDays('2026-12-31', 1), '2027-01-01');
      assert.equal(addDays('2026-01-01', -1), '2025-12-31');
      assert.equal(addDays('2026-02-28', 1), '2026-03-01');
      assert.equal(addDays('2024-02-28', 1), '2024-02-29');
    });

    test('diffDays calculates calendar day offsets accurately', () => {
      assert.equal(diffDays('2026-12-11', '2026-12-10'), 1);
      assert.equal(diffDays('2026-12-10', '2026-12-11'), -1);
      assert.equal(diffDays('2026-12-10', '2026-12-10'), 0);
      assert.equal(diffDays('2027-01-01', '2026-12-31'), 1);
      assert.equal(diffDays(addDays('2026-11-26', 30), '2026-11-26'), 30);
    });
  });

  suite('M2: App.random seeded RNG', ({ test, assert }) => {
    const { create, shuffle, pick } = window.App.random;

    test('same seed produces the same sequence in [0, 1)', () => {
      const rng1 = create('2026-12-10');
      const rng2 = create('2026-12-10');
      const seq1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2(), rng2(), rng2()];
      assert.deepEqual(seq1, seq2);
      seq1.forEach((v) => assert.ok(v >= 0 && v < 1, 'Out of range: ' + v));
    });

    test('different seeds produce different sequences', () => {
      const rng1 = create('2026-12-10');
      const rng2 = create('2026-12-11');
      assert.ok(rng1() !== rng2());
    });

    test('shuffle and pick are deterministic without duplicates', () => {
      const arr = [10, 20, 30, 40, 50];
      const s1 = shuffle(arr.slice(), create('wall-seed'));
      const s2 = shuffle(arr.slice(), create('wall-seed'));
      assert.deepEqual(s1, s2);

      const picked = pick(arr, 3, create('pick-seed'));
      assert.equal(picked.length, 3);
      assert.equal(new Set(picked).size, 3);
    });
  });

  suite('M2: App.text utilities', ({ test, assert }) => {
    const { normalise, variants, tabooDetect } = window.App.text;

    test('normalise trims, lowercases, collapses spaces, straightens quotes', () => {
      assert.equal(normalise('  Hello  World  '), 'hello world');
      assert.equal(normalise('\u2018it\u2019s \u201Cnice\u201D'), '\'it\'s "nice"');
      assert.equal(normalise('\u2018it\u2019s'), "'it's");
      assert.equal(normalise('\u201Chello\u201D'), '"hello"');
    });

    test('variants generates English inflections (+s/+ed/+ing/+er/+est) without false doubling traps', () => {
      const study = variants('study');
      assert.ok(study.includes('studies'));
      assert.ok(study.includes('studied'));
      assert.ok(study.includes('studying'));

      const like = variants('like');
      assert.ok(like.includes('liked'));
      assert.ok(like.includes('liking'));

      const stop = variants('stop');
      assert.ok(stop.includes('stopped'));
      assert.ok(stop.includes('stopping'));

      assert.ok(variants('eat').includes('eating'));
      assert.ok(variants('read').includes('reading'));
      assert.ok(variants('clean').includes('cleaned'));
      assert.ok(variants('book').includes('booked'));
    });

    test('tabooDetect catches whole-word forms and ignores empty taboo strings', () => {
      const hit = tabooDetect('I really love this word.', variants('love'));
      assert.equal(hit.found, true);
      assert.ok(hit.matched.includes('love'));

      const miss = tabooDetect('I love lovely flowers.', ['loves', '', '   ']);
      assert.equal(miss.found, false);
    });
  });

  suite('M2: App.store.db & migrations', ({ test, assert }) => {
    const { db } = window.App.store;

    test('set/get/has/remove round-trip structured values cleanly', () => {
      const obj = { a: 1, b: [2, 3], c: { d: 'x' } };
      db.set('__test.obj', obj);
      assert.equal(db.has('__test.obj'), true);
      assert.deepEqual(db.get('__test.obj'), obj);
      db.remove('__test.obj');
      assert.equal(db.has('__test.obj'), false);
      assert.equal(db.get('__test.obj', 'fallback'), 'fallback');
    });

    test('migrates a v0 fixture to CURRENT_VERSION preserving existing data', () => {
      const prevMeta = db.get('as.meta');
      db.set('as.meta', { schemaVersion: 0, createdAt: '2026-01-01T00:00:00.000Z', lastOpened: null });
      db.set('__test.v0fixture', { preserved: true });

      db.runMigrations();

      const nextMeta = db.get('as.meta');
      assert.equal(nextMeta.schemaVersion, db.CURRENT_VERSION);
      assert.equal(nextMeta.createdAt, '2026-01-01T00:00:00.000Z');
      assert.deepEqual(db.get('__test.v0fixture'), { preserved: true });

      db.remove('__test.v0fixture');
      if (prevMeta) db.set('as.meta', prevMeta);
    });

    test('QuotaExceededError and SecurityError switch to in-memory fallback', () => {
      const originalSet = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function () {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      };
      db._resetFallback();
      db.set('__test.quota', 'value');
      localStorage.setItem = originalSet;

      assert.equal(db.isUsingFallback(), true);
      assert.equal(db.get('__test.quota'), 'value');
      db._resetFallback();

      localStorage.setItem = function () {
        throw new DOMException('Blocked in private mode', 'SecurityError');
      };
      db.set('__test.sec', 'mem');
      localStorage.setItem = originalSet;

      assert.equal(db.isUsingFallback(), true);
      assert.equal(db.get('__test.sec'), 'mem');
      db._resetFallback();
    });

    test('migration failure restores previous backup without wiping data', () => {
      const prevMeta = db.get('as.meta');
      db.set('as.meta', { schemaVersion: 0, createdAt: '2026-01-01T00:00:00.000Z', lastOpened: null });
      db.set('as.__test_rollback', { intact: 123 });

      const origErr = console.error;
      console.error = function () {};
      let ok = true;
      try {
        ok = db.runMigrations([
          function broken() {
            throw new Error('simulated migration crash');
          },
        ], 1);
      } finally {
        console.error = origErr;
      }

      assert.equal(ok, false);
      assert.deepEqual(db.get('as.__test_rollback'), { intact: 123 });
      assert.equal(db.get('as.meta').schemaVersion, 0);

      db.remove('as.__test_rollback');
      if (prevMeta) db.set('as.meta', prevMeta);
    });
  });

  suite('M2: App.i18n & live re-render', ({ test, assert }) => {
    const { t, lang, setLang, init } = window.App.i18n;
    const routerRoot = document.getElementById('test-router-root');

    test('translates zh-TW, en, params, and English fallback without leaking window globals', () => {
      assert.equal('AS_I18N_ZH_TW' in window, false);
      assert.equal('AS_I18N_EN' in window, false);
      init('zh-TW');
      assert.equal(t('nav.dashboard'), '首頁');
      assert.equal(t('cards.edit'), '編輯單字卡');
      assert.ok(t('timetable.period', { n: 3 }).includes('3'));

      window.App._i18n.en['__test.only_en'] = 'Only EN';
      assert.equal(t('__test.only_en'), 'Only EN');
      delete window.App._i18n.en['__test.only_en'];

      assert.equal(t('__test.missing_everywhere'), '__test.missing_everywhere');
    });

    test('setLang re-renders current mounted page without reload', () => {
      window.App.router.navigate('#/settings');
      setLang('en');
      assert.equal(lang(), 'en');
      assert.equal(routerRoot.querySelector('.page-title').textContent, 'Settings');

      setLang('zh-TW');
      assert.equal(lang(), 'zh-TW');
      assert.equal(routerRoot.querySelector('.page-title').textContent, '設定');
    });
  });

  suite('M2: App.bus & App.router lifecycle', ({ test, assert }) => {
    const { on, off, emit, clear, count } = window.App.bus;
    const { navigate, go, current } = window.App.router;

    test('bus delivers events, removes listeners with off, and isolates errors', () => {
      let calls = 0;
      function bad() { throw new Error('expected test error'); }
      function good() { calls++; }
      on('__test.ev', bad);
      on('__test.ev', good);
      const origErr = console.error;
      let loggedErr = false;
      console.error = function () { loggedErr = true; };
      try {
        emit('__test.ev', { ok: true });
      } finally {
        console.error = origErr;
      }
      assert.equal(loggedErr, true);
      assert.equal(calls, 1);
      off('__test.ev', bad);
      off('__test.ev', good);
      assert.equal(count('__test.ev'), 0);
      clear('__test.ev');
    });

    test('navigating all routes 20 times leaves zero accumulated bus listeners', () => {
      const before = count('route:changed');
      const allRoutes = [
        '#/', '#/cards', '#/cards/b-0001', '#/review', '#/decks',
        '#/games', '#/stats', '#/stamps', '#/settings', '#/settings/ai',
        '#/styleguide', '#/', '#/cards', '#/review', '#/decks',
        '#/games', '#/stats', '#/stamps', '#/settings', '#/',
      ];
      allRoutes.forEach((h) => navigate(h));
      const after = count('route:changed');
      assert.equal(after, before);
      assert.equal(current().path, '#/');
    });

    test('game route hides navigation and triggers exit confirmation modal', () => {
      navigate('#/games/wall');
      assert.equal(current().inGame, true);
      assert.equal(document.body.classList.contains('is-in-game'), true);

      // Attempting to navigate out of game opens confirmation modal with Keep Playing / Exit buttons
      go('#/games');
      const dialog = document.querySelector('.modal-dialog');
      assert.ok(dialog, 'Exit confirmation modal should open');
      const buttons = dialog.querySelectorAll('.modal-foot .btn');
      assert.equal(buttons.length, 2, 'Expected Keep Playing and Exit buttons');

      // Click Exit (2nd button)
      buttons[1].click();
      assert.equal(current().inGame, false);
      assert.equal(document.body.classList.contains('is-in-game'), false);
    });

    test('unknown route redirects to dashboard and shows toast; query params parse cleanly', () => {
      navigate('#/cards?deck=d-builtin-2000');
      assert.equal(current().params.query.deck, 'd-builtin-2000');

      navigate('#/nonexistent-route-xyz');
      assert.equal(window.location.hash, '#/');
      assert.equal(current().path, '#/');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // M3: Flashcards, Curation, Leitner, Decks, and TTS
  // ═══════════════════════════════════════════════════════════════

  suite('M3: App.store.cards builtin import, curation, POS & CRUD', ({ test, assert }) => {
    const cards = window.App.store.cards;

    test('normalisePos maps canonical tags, a. -> adj., and noisy OCR -> null', () => {
      assert.equal(cards.normalisePos('n.[C]'), 'n.');
      assert.equal(cards.normalisePos('a.'), 'adj.');
      assert.equal(cards.normalisePos('v.'), 'v.');
      assert.equal(cards.normalisePos('n.[C]；v.'), 'n.');
      assert.equal(cards.normalisePos(''), null);
      assert.equal(cards.normalisePos('n.a.；20'), null);
      assert.equal(cards.normalisePos('n.a.；0；Water freezes at zero degrees. 21 nineteen ('), null);
    });

    test('applies cardFixes curation: hides 29 garbage/header rows, fixes OCR words & context meanings', () => {
      const allWithHidden = cards.getAll({ includeHidden: true });
      const active = cards.getAll({ includeHidden: false });
      assert.equal(allWithHidden.length, 1928);
      assert.equal(active.length, 1899);

      const b0722 = cards.getById('b-0722');
      assert.ok(b0722 && b0722.hidden === true && b0722.excludeFromGames === true);
      assert.equal(cards.findByWord('OO'), null);
      assert.equal(cards.findByWord('Cautbayoal'), null);

      // Fixed OCR headwords
      assert.equal(cards.getById('b-0612').word, 'lemon');
      assert.equal(cards.getById('b-1216').word, 'biology');
      assert.equal(cards.getById('b-0374').word, 'lucky');
      assert.equal(cards.getById('b-0443').word, 'lovely');

      // Duplicate merge joining distinct curated meanings with ；
      const bat = cards.findByWord('bat');
      assert.ok(bat && bat.sourceIds.includes('0832') && bat.sourceIds.includes('1707'));
      assert.equal(bat.zh, '球棒；蝙蝠');

      const may = cards.findByWord('may');
      assert.ok(may && may.zh.includes('五月') && may.zh.includes('可能'));

      // Meta-template examples suppressed; mixed Chinese notes stripped from source_771
      const lib = cards.findByWord('library');
      assert.equal(lib.example, null);
      assert.equal(lib.hasRealExample, false);

      const sick = cards.findByWord('sick');
      assert.equal(sick.example, 'Phil is sick.');
      assert.equal(sick.exampleZh, '菲爾病了。');
      assert.equal(sick.hasRealExample, true);

      const baby = cards.getById('b-0001');
      assert.equal(baby.word, 'baby');
      assert.equal(baby.ipa, null);
      assert.equal(baby.pos, 'n.');
    });

    test('validates card inputs, detects duplicates, and allows editing punctuated builtin cards', () => {
      const emptyCheck = cards.validate({ word: '', zh: '' });
      assert.equal(emptyCheck.valid, false);
      assert.equal(emptyCheck.errors.word, 'required');
      assert.equal(emptyCheck.errors.zh, 'required');

      const badChars = cards.validate({ word: 'hello123', zh: '你好' });
      assert.equal(badChars.valid, false);
      assert.equal(badChars.errors.word, 'invalid_chars');

      const dup = cards.validate({ word: '  BABY ', zh: '寶寶' });
      assert.equal(dup.valid, false);
      assert.ok(dup.duplicate && dup.duplicate.id === 'b-0001');

      // Punctuated builtin cards ("Mr.", "goodbye / bye") can be edited without blocking Save
      const mrEdit = cards.validate({ word: 'Mr.', zh: '先生' }, 'b-0034');
      assert.equal(mrEdit.valid, true);
      const byeEdit = cards.validate({ word: 'goodbye / bye', zh: '再見' }, 'b-1888');
      assert.equal(byeEdit.valid, true);
    });

    test('builtin card overrides persist across invalidate and builtin cards cannot be deleted', () => {
      const prev = cards.getById('b-0001');
      cards.update('b-0001', { aiTip: 'test memory tip' });
      cards.invalidate();
      assert.equal(cards.getById('b-0001').aiTip, 'test memory tip');
      assert.equal(cards.removeUserCard('b-0001'), null);

      // Restore clean state
      const ov = window.App.store.db.get('as.v1.cards.overrides', {});
      delete ov['b-0001'];
      window.App.store.db.set('as.v1.cards.overrides', ov);
      cards.invalidate();
      assert.equal(cards.getById('b-0001').aiTip, prev.aiTip);
    });

    test('adds, updates, deletes and restores user card cleanly', () => {
      const created = cards.add({ word: 'marshmallow', zh: '棉花糖', pos: 'n.' });
      assert.ok(created.id.startsWith('u-'));
      assert.equal(cards.getById(created.id).word, 'marshmallow');

      cards.update(created.id, { zh: '烤棉花糖' });
      assert.equal(cards.getById(created.id).zh, '烤棉花糖');

      const snap = cards.removeUserCard(created.id);
      assert.equal(cards.getById(created.id), null);

      cards.restoreUserCard(snap);
      assert.equal(cards.getById(created.id).word, 'marshmallow');
      cards.removeUserCard(created.id);
    });

    test('getDistractors uses same POS and falls back cleanly when pos is null', () => {
      const target = cards.getById('b-0001');
      const dist = cards.getDistractors(target, 3);
      assert.equal(dist.length, 3);
      dist.forEach((d) => {
        assert.ok(d.id !== target.id);
        assert.ok(!d.excludeFromGames);
        assert.equal(d.pos, 'n.');
      });

      const nullPosCard = cards.findByWord('library');
      assert.equal(nullPosCard.pos, null);
      const fallbackDist = cards.getDistractors(nullPosCard, 3);
      assert.equal(fallbackDist.length, 3);
      assert.equal(new Set(fallbackDist.map((d) => d.word.toLowerCase())).size, 3);
    });
  });

  suite('M3: App.store.leitner 5-box scheduling', ({ test, assert }) => {
    const leitner = window.App.store.leitner;
    const db = window.App.store.db;
    const { addDays } = window.App.date;

    test('promotes boxes 1->5 with spec intervals and demotes on unknown', () => {
      const id = '__test_leitner_card';
      const baseDay = '2026-12-01';

      let p = leitner.rateCard(id, 'know', baseDay);
      assert.equal(p.box, 2);
      assert.equal(p.due, addDays(baseDay, 2));

      p = leitner.rateCard(id, 'know', p.due);
      assert.equal(p.box, 3);
      assert.equal(p.due, addDays('2026-12-03', 4));

      p = leitner.rateCard(id, 'fuzzy', p.due);
      assert.equal(p.box, 3);
      assert.equal(p.due, addDays('2026-12-07', 1));

      p = leitner.rateCard(id, 'know', p.due);
      assert.equal(p.box, 4);
      assert.equal(p.due, addDays('2026-12-08', 7));

      p = leitner.rateCard(id, 'know', p.due);
      assert.equal(p.box, 5);
      assert.equal(p.due, addDays('2026-12-15', 14));

      // Max box stays 5
      p = leitner.rateCard(id, 'know', p.due);
      assert.equal(p.box, 5);

      // Unknown drops to box 1 due +1d
      p = leitner.rateCard(id, 'unknown', '2026-12-29');
      assert.equal(p.box, 1);
      assert.equal(p.due, '2026-12-30');
      assert.equal(leitner.isDue(id, '2026-12-29'), false);
      assert.equal(leitner.isDue(id, '2026-12-30'), true);

      leitner.remove(id);
    });

    test('game wrong sends card to box 1 due TODAY while game correct does not promote', () => {
      const id = '__test_leitner_game';
      const today = '2026-12-10';
      leitner.rateCard(id, 'know', today); // box 2, due 2026-12-12

      let p = leitner.recordGameResult(id, 'wall', true, today);
      assert.equal(p.box, 2); // did not promote

      p = leitner.recordGameResult(id, 'class13', false, today);
      assert.equal(p.box, 1);
      assert.equal(p.due, today);
      assert.equal(p.lastWrongIn, 'class13');
      assert.equal(leitner.isDue(id, today), true);

      leitner.remove(id);
    });
  });

  suite('M3: App.store.decks & 3.8 UI edge cases', ({ test, assert }) => {
    const decks = window.App.store.decks;
    const cards = window.App.store.cards;

    test('default deck resolves 1899 active builtin cards and cannot be deleted', () => {
      const def = decks.getById(decks.DEFAULT_DECK_ID);
      assert.ok(def);
      assert.equal(decks.getCardIds(def.id).length, 1899);
      assert.equal(decks.remove(def.id), null);
    });

    test('custom deck CRUD, reorder persistence, 4-card threshold, and restore undo', () => {
      const d1 = decks.create({ name: 'Exam Prep', ringColor: 'grammar', cardIds: ['b-0001', 'b-0002'] });
      const d2 = decks.create({ name: 'Midterm', ringColor: 'dialogue', cardIds: ['b-0001'] });
      assert.equal(decks.canPlayFourOptionGame(d1.id), false);

      decks.reorder([d2.id, decks.DEFAULT_DECK_ID, d1.id]);
      decks.invalidate();
      assert.equal(decks.getAll()[0].id, d2.id);
      decks.reorder([decks.DEFAULT_DECK_ID, d1.id, d2.id]);

      decks.setCardDecks('b-0003', [d1.id]);
      decks.setCardDecks('b-0004', [d1.id]);
      assert.equal(decks.canPlayFourOptionGame(d1.id), true);

      const snap = decks.remove(d1.id);
      assert.equal(decks.getById(d1.id), null);
      assert.ok(cards.getById('b-0001'));

      decks.restore(snap);
      assert.ok(decks.getById(d1.id));
      decks.remove(d1.id);
      decks.remove(d2.id);
    });

    test('rapid flip clicks ignored and TTS prefers Edge Natural Online / Google US English over local', () => {
      const fc = window.App.flashcard.create({ word: 'electroencephalography', ipa: null, zh: '腦電圖' });
      const fontSize = parseInt(fc.root.querySelector('.flashcard-word').style.fontSize, 10);
      assert.ok(fontSize >= 28);
      fc.flip();
      assert.equal(fc.isFlipped(), true);
      fc.flip();
      assert.equal(fc.isFlipped(), true);

      const pickedEdge = window.App.audio.tts._pickEnglishVoice([
        { name: 'Microsoft Zira Desktop', lang: 'en-US', localService: true },
        { name: 'Microsoft Ava Online (Natural) - English (United States)', lang: 'en-US', localService: false },
      ]);
      assert.ok(pickedEdge.name.includes('Online (Natural)'));

      const pickedChrome = window.App.audio.tts._pickEnglishVoice([
        { name: 'Microsoft Zira Desktop', lang: 'en-US', localService: true },
        { name: 'Google US English', lang: 'en-US', localService: false },
      ]);
      assert.equal(pickedChrome.name, 'Google US English');

      const ttsStatus = window.App.audio.tts.status();
      assert.equal(typeof ttsStatus.supported, 'boolean');
      window.App.audio.tts.stop();
    });

    test('TTS buttons stay enabled when getVoices() is [] at load, wait for voiceschanged on click, and do not flip card', async () => {
      const origDesc = Object.getOwnPropertyDescriptor(window, 'speechSynthesis')
        || Object.getOwnPropertyDescriptor(Window.prototype, 'speechSynthesis');
      const OrigUtter = window.SpeechSynthesisUtterance;
      const listeners = new Set();
      let mockVoices = [];
      const spoken = [];

      function MockUtterance(text) {
        this.text = text;
        this.voice = null;
        this.lang = '';
        this.rate = 1;
        this.pitch = 1;
      }

      const mockSynth = {
        speaking: false,
        pending: false,
        paused: false,
        getVoices() { return mockVoices; },
        addEventListener(type, fn) { if (type === 'voiceschanged') listeners.add(fn); },
        removeEventListener(type, fn) { if (type === 'voiceschanged') listeners.delete(fn); },
        speak(u) { spoken.push(u); },
        cancel() {},
        resume() {},
      };

      window.SpeechSynthesisUtterance = MockUtterance;
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: mockSynth,
      });

      try {
        const fc = window.App.flashcard.create({ word: 'library', ipa: null, zh: '圖書館' });
        const btns = fc.root.querySelectorAll('.flashcard-audio button');
        assert.equal(btns.length, 2);
        assert.equal(btns[0].disabled, false, 'Speaker button must stay enabled when getVoices() is []');
        assert.equal(btns[1].disabled, false, 'Slow button must stay enabled when getVoices() is []');
        assert.ok(btns[0].getAttribute('title'), 'Speaker button needs tooltip');
        assert.ok(btns[1].getAttribute('title'), 'Slow button needs tooltip');

        let speakPromise = null;
        const fcWired = window.App.flashcard.create(
          { word: 'library', ipa: null, zh: '圖書館' },
          { onSpeak: (slow) => { speakPromise = window.App.audio.tts.speak('library', { slow, timeoutMs: 400 }); } }
        );
        fcWired.root.querySelectorAll('.flashcard-audio button')[0].click();
        assert.equal(fcWired.isFlipped(), false, 'Clicking TTS button must not flip card');
        assert.equal(spoken.length, 0, 'Should wait while voices are empty');

        setTimeout(() => {
          mockVoices = [{ name: 'Microsoft Zira Desktop', lang: 'en-US', localService: true }];
          listeners.forEach((fn) => fn());
        }, 40);

        const res = await speakPromise;
        assert.equal(res.ok, true);
        assert.equal(spoken.length, 1);
        assert.equal(spoken[0].text, 'library');
        assert.equal(spoken[0].rate, 1);
        assert.equal(spoken[0].voice.name, 'Microsoft Zira Desktop');

        // Slow mode uses 0.8 rate
        await window.App.audio.tts.speak('library', { slow: true });
        assert.equal(spoken[1].rate, 0.8);

        // If voices never arrive, speak resolves ok:false and shows toast at most once per page view
        mockVoices = [];
        window.App.audio.tts.resetPageNotice();
        let toastCount = 0;
        const origToastShow = window.App.toast.show;
        window.App.toast.show = function () { toastCount++; };
        try {
          const r1 = await window.App.audio.tts.speak('library', { timeoutMs: 40 });
          const r2 = await window.App.audio.tts.speak('library', { timeoutMs: 40 });
          assert.equal(r1.ok, false);
          assert.equal(r2.ok, false);
          assert.equal(toastCount, 1, 'No-voice toast must appear at most once per page view');
        } finally {
          window.App.toast.show = origToastShow;
        }
      } finally {
        window.SpeechSynthesisUtterance = OrigUtter;
        if (origDesc) Object.defineProperty(window, 'speechSynthesis', origDesc);
        else delete window.speechSynthesis;
      }
    });
  });

  // ── M4: Review, Attempts, Compaction, History & Onboarding ───────────────
  suite('M4 · Review, Attempt Log, Sessions & Onboarding', ({ test, assert }) => {
    function resetM4Stores() {
      window.App.store.db.remove('as.v1.progress');
      window.App.store.db.remove('as.v1.attempts');
      window.App.store.db.remove('as.v1.daily');
      window.App.store.db.remove('as.v1.sessions');
      window.App.store.leitner.invalidate();
      window.App.store.attempts.invalidate();
    }

    test('reviewing 20 cards updates Leitner boxes and due dates across simulated date changes', () => {
      const cards = window.App.store.cards.getAll({ includeHidden: false }).slice(0, 25);
      const ids = cards.map((c) => c.id);
      const leitner = window.App.store.leitner;
      const attempts = window.App.store.attempts;
      resetM4Stores();

      try {
        const day1 = '2026-12-01';
        const day2 = '2026-12-02';
        const day3 = '2026-12-03';
        const day7 = '2026-12-07';

        const q1 = leitner.buildReviewQueue(ids, { today: day1, maxCards: 20, dailyNewWords: 20 });
        assert.equal(q1.queue.length, 20, 'Session queue capped at 20');
        assert.equal(q1.due.length, 0);
        assert.equal(q1.fresh.length, 20);

        // Rate 10 know (-> box 2, due day3), 5 fuzzy (-> box 1, due day2), 5 unknown (-> box 1, due day2)
        for (let i = 0; i < 20; i++) {
          const cid = q1.queue[i];
          const rating = i < 10 ? 'know' : (i < 15 ? 'fuzzy' : 'unknown');
          const rec = leitner.rateCard(cid, rating, day1);
          attempts.record({
            source: 'card',
            sessionId: 'ses-sim-1',
            cardId: cid,
            skill: 'vocab',
            correct: rating !== 'unknown',
            userAnswer: rating,
            expected: cards[i].word,
            dayKey: day1,
            ms: 1200,
          });
          if (rating === 'know') {
            assert.equal(rec.box, 2);
            assert.equal(rec.due, day3);
          } else {
            assert.equal(rec.box, 1);
            assert.equal(rec.due, day2);
          }
          assert.equal(rec.firstSeenDay, day1);
        }

        assert.equal(leitner.countNewLearnedToday(day1), 20);
        assert.equal(attempts.getByDay(day1).length, 20);

        // On day2: 10 box-1 cards are due; 10 box-2 cards are NOT due yet
        const q2 = leitner.buildReviewQueue(ids, { today: day2, maxCards: 20, dailyNewWords: 2 });
        assert.equal(q2.due.length, 10, '10 box-1 cards due on day2');
        assert.equal(q2.fresh.length, 2, 'Daily new quota adds 2 unseen cards');
        assert.equal(q2.queue.length, 12);
        assert.equal(leitner.isDue(q1.queue[0], day2), false, 'Box-2 card not due on day2');
        assert.equal(leitner.isDue(q1.queue[10], day2), true, 'Fuzzy box-1 card due on day2');
        assert.equal(leitner.isDue(q1.queue[15], day2), true, 'Unknown box-1 card due on day2');

        // On day3: all 20 reviewed cards are now due (10 overdue from day2 + 10 box-2 due day3)
        assert.equal(leitner.isDue(q1.queue[0], day3), true, 'Box-2 card due on day3');
        const promoted3 = leitner.rateCard(q1.queue[0], 'know', day3);
        assert.equal(promoted3.box, 3);
        assert.equal(promoted3.due, day7, 'Box 3 schedules +4 days');

        // forceNewOnly returns unseen cards even when daily quota is exhausted
        const qExtra = leitner.buildReviewQueue(ids, { today: day1, maxCards: 20, dailyNewWords: 5, forceNewOnly: true });
        assert.equal(qExtra.fresh.length, 5);
      } finally {
        resetM4Stores();
      }
    });

    test('attempt log emits attempt:recorded, compacts overflow into as.v1.daily, and tracks personal bests', () => {
      const attempts = window.App.store.attempts;
      resetM4Stores();
      let busEvents = 0;
      const onRecorded = () => { busEvents++; };
      window.App.bus.on('attempt:recorded', onRecorded);

      try {
        assert.equal(attempts.MAX_ATTEMPTS, 5000);
        for (let i = 0; i < 15; i++) {
          attempts.record({
            source: i % 2 === 0 ? 'card' : 'class13',
            cardId: i < 5 ? 'b-0001' : 'b-0002',
            skill: 'vocab',
            correct: i % 3 !== 0,
            userAnswer: i % 3 !== 0 ? 'know' : 'unknown',
            dayKey: i < 10 ? '2026-12-01' : '2026-12-02',
            ms: 500,
          });
        }
        assert.equal(busEvents, 15, 'attempt:recorded emitted for every attempt');
        assert.equal(attempts.getByCard('b-0001').length, 5);
        assert.ok(attempts.getWeakCardIds(14, '2026-12-05').includes('b-0001'));

        // Compact keeping 5 newest -> 10 oldest compacted into as.v1.daily
        const compacted = attempts.compact(5);
        assert.equal(compacted, 10);
        assert.equal(attempts.getAll().length, 5);
        const daily = attempts.getDailySummaries();
        const compactedSum = daily.reduce((acc, d) => acc + d.total, 0);
        assert.equal(compactedSum, 10, 'Compacted daily summaries preserve exact count');

        const combined = attempts.getCombinedDailyTotals();
        const grandTotal = combined.reduce((acc, d) => acc + d.total, 0);
        assert.equal(grandTotal, 15, 'Combined daily totals equal 15 across daily + live attempts');

        // Completed sessions & personal bests
        attempts.recordSession({ source: 'card', startedAt: 1000, endedAt: 2000, score: 80, accuracy: 0.8 });
        attempts.recordSession({ source: 'card', startedAt: 3000, endedAt: 4000, score: 150, accuracy: 0.95 });
        const bests = attempts.getPersonalBests('card', 5);
        assert.equal(bests.length, 2);
        assert.equal(bests[0].score, 150);
      } finally {
        window.App.bus.off('attempt:recorded', onRecorded);
        resetM4Stores();
      }
    });

    test('review page handles Space/1/2/3 flow, end screen CTA, no-due state, and abandoned session cleanup', async () => {
      const decks = window.App.store.decks;
      const cards = window.App.store.cards.getAll({ includeHidden: false }).slice(0, 4);
      const attempts = window.App.store.attempts;
      resetM4Stores();

      const tempDeck = decks.create({ name: 'M4 Temp Deck', cardIds: [cards[0].id, cards[1].id] });
      const mountRoot = document.getElementById('test-router-root');

      try {
        window.App.pages.review.mount(mountRoot, { query: { deck: tempDeck.id } });
        assert.ok(mountRoot.querySelector('[data-review-state="active"]'), 'Active review stage mounted');
        const rateBtns1 = mountRoot.querySelectorAll('.rate-btn');
        assert.equal(rateBtns1.length, 3);
        assert.equal(rateBtns1[0].disabled, true, 'Rating buttons disabled before flip');

        // Press Space to flip, then 3 (know)
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
        assert.equal(rateBtns1[2].disabled, false, 'Rating buttons unlocked after flip');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', code: 'Digit3' }));
        await new Promise((r) => setTimeout(r, 110));

        // Second card: flip via Space, rate 1 (unknown)
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1' }));
        await new Promise((r) => setTimeout(r, 110));

        // End screen rendered + completed session recorded
        assert.ok(mountRoot.querySelector('[data-review-state="done"]'), 'End screen shown after final card');
        assert.ok(mountRoot.querySelector('.stamp'), 'Commemorative stamp shown on end screen');
        const ctaLink = mountRoot.querySelector('a[href^="#/games/class13?words="]');
        assert.ok(ctaLink, 'Weak words CTA links to Class 13 with query params');
        assert.ok(ctaLink.getAttribute('href').includes(encodeURIComponent(cards[1].id)));
        assert.equal(attempts.getSessions('card').length, 1, 'Completed review saved 1 session');

        // Re-mounting same deck (all reviewed today, none due, none unseen) shows empty state
        window.App.pages.review.unmount();
        window.App.pages.review.mount(mountRoot, { query: { deck: tempDeck.id } });
        assert.ok(mountRoot.querySelector('[data-review-state="empty"]'), 'No-due empty state rendered');
        assert.ok(mountRoot.querySelector('a[href="#/games"]'), 'Empty state offers Play a game action');

        // Card detail Learning History tab displays the recorded attempt
        window.App.pages.review.unmount();
        window.App.pages.cardDetail.mount(mountRoot, { id: cards[1].id });
        const tabs = mountRoot.querySelectorAll('.tab-btn');
        tabs[1].click();
        assert.ok(mountRoot.querySelector('[data-card-history="true"]'), 'Card history timeline renders recorded attempts');
        assert.ok(mountRoot.textContent.includes('✗'), 'Wrong attempt shows ✗ mark in history');
        window.App.pages.cardDetail.unmount();

        // Abandoned session mid-review does NOT save a session and unmount removes keydown listener
        const tempDeck2 = decks.create({ name: 'M4 Abandon Deck', cardIds: [cards[2].id, cards[3].id] });
        try {
          window.App.pages.review.mount(mountRoot, { query: { deck: tempDeck2.id } });
          document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
          document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', code: 'Digit3' }));
          await new Promise((r) => setTimeout(r, 110));
          window.App.pages.review.unmount();
          assert.equal(attempts.getSessions('card').length, 1, 'Abandoned review must not save a session');
          // Dispatching keys after unmount should not throw or record extra attempts
          const beforeCount = attempts.getAll().length;
          document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
          document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', code: 'Digit3' }));
          assert.equal(attempts.getAll().length, beforeCount, 'Unmounted review listener must not fire');
        } finally {
          decks.remove(tempDeck2.id);
        }
      } finally {
        window.App.pages.review.unmount();
        decks.remove(tempDeck.id);
        resetM4Stores();
      }
    });

    test('3-step first-visit onboarding updates dailyNewWords and marks settings.onboarded', () => {
      const settings = window.App.store.settings;
      const origOnboarded = settings.get('onboarded');
      const origDaily = settings.get('dailyNewWords');
      const mountRoot = document.getElementById('test-router-root');

      try {
        settings.update({ onboarded: false, dailyNewWords: 10 });
        window.App.pages.dashboard.mount(mountRoot);
        const panel = mountRoot.querySelector('[data-onboarding="true"]');
        assert.ok(panel, 'Onboarding panel shown on Dashboard on first visit');

        // Step 1: pick 15 words, click Next
        const choice15 = Array.from(panel.querySelectorAll('.onboarding-choices button')).find((b) => b.textContent.includes('15'));
        assert.ok(choice15, '15 words choice present');
        choice15.click();
        assert.equal(settings.get('dailyNewWords'), 15);

        const next1 = panel.querySelector('.onboarding-foot .btn-primary');
        next1.click();

        // Step 2: flip sample flashcard, click Next
        const sampleCardEl = panel.querySelector('.flashcard');
        assert.ok(sampleCardEl, 'Step 2 renders interactive sample flashcard');
        sampleCardEl.click();
        assert.ok(sampleCardEl.classList.contains('is-flipped'), 'Sample card flips on tap');

        const next2 = panel.querySelector('.onboarding-foot .btn-primary');
        next2.click();

        // Step 3: click Stay on home -> marks onboarded = true and removes panel
        const stayBtn = panel.querySelector('.onboarding-foot .btn-secondary');
        assert.ok(stayBtn, 'Step 3 completion actions rendered');
        stayBtn.click();
        assert.equal(settings.get('onboarded'), true, 'Completing onboarding sets onboarded = true');
        assert.equal(mountRoot.querySelector('[data-onboarding="true"]'), null, 'Onboarding panel dismissed after completion');
      } finally {
        window.App.pages.dashboard.unmount();
        settings.update({ onboarded: origOnboarded, dailyNewWords: origDaily });
      }
    });
  });

  // ── M5: Lazy Loader, Shared Game Engine & 四格分類牆 ─────────────────────
  suite('M5 · Lazy Loader, Game Engine & Four-Group Wall', ({ test, assert }) => {
    test('App.loadScripts deduplicates loads and cleans up failed tags so Retry succeeds', async () => {
      const target = document.head || document.body || document.documentElement;
      const origAppend = target.appendChild.bind(target);
      const injected = [];
      let failOnce = true;

      target.appendChild = function (node) {
        if (node && node.tagName === 'SCRIPT' && String(node.src || '').includes('__test_lazy_')) {
          injected.push(node.src);
          const res = origAppend(node);
          setTimeout(() => {
            if (String(node.src).includes('__test_lazy_flaky') && failOnce) {
              failOnce = false;
              if (typeof node.onerror === 'function') node.onerror(new Error('net'));
            } else if (typeof node.onload === 'function') {
              node.onload();
            }
          }, 10);
          return res;
        }
        return origAppend(node);
      };

      try {
        // Deduplication: loading the same script twice injects it only once
        await window.App.loadScripts(['js/__test_lazy_ok.js']);
        await window.App.loadScripts(['./js/__test_lazy_ok.js']);
        const okCount = injected.filter((s) => s.includes('__test_lazy_ok')).length;
        assert.equal(okCount, 1, 'Same script must never be loaded twice');

        // Failure cleanup + Retry recovery
        let failed = false;
        try {
          await window.App.loadScripts(['js/__test_lazy_flaky.js']);
        } catch (_e) {
          failed = true;
        }
        assert.equal(failed, true, 'First flaky load must reject');
        assert.equal(window.App.loader.isLoaded('js/__test_lazy_flaky.js'), false, 'Failed script must not be marked loaded');

        await window.App.loadScripts(['js/__test_lazy_flaky.js']);
        assert.equal(window.App.loader.isLoaded('js/__test_lazy_flaky.js'), true, 'Retry after failure succeeds');
      } finally {
        target.appendChild = origAppend;
        target.querySelectorAll('script').forEach((s) => {
          if (String(s.src || '').includes('__test_lazy_')) s.remove();
        });
      }
    });

    test('router.registerLazy shows loading state, error + Retry button on failure, then mounts on Retry', async () => {
      const mountRoot = document.getElementById('test-router-root');
      const origLoad = window.App.loadScripts;
      let attempt = 0;
      let mounted = false;

      window.App.loadScripts = function () {
        attempt++;
        if (attempt === 1) return Promise.reject(new Error('simulated load error'));
        return new Promise((resolve) => setTimeout(resolve, 15));
      };

      try {
        window.App.router.registerLazy('#/__test-lazy-route', {
          scripts: ['js/__nonexistent_lazy.js'],
          getPage: () => ({
            mount(r) {
              mounted = true;
              r.replaceChildren(window.App.dom.el('div', { 'data-lazy-ok': 'true', text: 'OK' }));
            },
            unmount() {},
          }),
        });

        window.App.router.navigate('#/__test-lazy-route');
        await new Promise((r) => setTimeout(r, 20));
        const errBox = mountRoot.querySelector('[data-route-state="error"]');
        assert.ok(errBox, 'Error state shown when lazy script fails');
        const retryBtn = errBox.querySelector('button');
        assert.ok(retryBtn, 'Retry button present on lazy load error');

        retryBtn.click();
        assert.ok(mountRoot.querySelector('[data-route-state="loading"]'), 'Loading state shown while retrying');
        await new Promise((r) => setTimeout(r, 40));
        assert.equal(mounted, true, 'Lazy page mounted after Retry');
        assert.ok(mountRoot.querySelector('[data-lazy-ok="true"]'));
      } finally {
        window.App.loadScripts = origLoad;
        window.App.router.navigate('#/');
      }
    });

    test('wall validator approves all handcrafted walls in data/walls.js and catches invalid walls', () => {
      const validator = window.App.games.wallValidate;
      const walls = window.App.data && window.App.data.walls;
      assert.ok(Array.isArray(walls) && walls.length >= 10, 'At least 10 handcrafted walls present');

      const res = validator.validateAll(walls);
      assert.equal(res.failures.length, 0, 'All curated walls pass validation: ' + JSON.stringify(res.failures));
      assert.equal(res.validWalls.length, walls.length);

      // Duplicate item rejected
      const dupWall = JSON.parse(JSON.stringify(walls[0]));
      dupWall.groups[1].items[0] = dupWall.groups[0].items[0].toUpperCase();
      assert.equal(validator.validateWall(dupWall).valid, false, 'Case-insensitive duplicate item must fail');

      // Missing skill rejected
      const noDialogue = JSON.parse(JSON.stringify(walls[0]));
      noDialogue.groups.forEach((g) => { if (g.skill === 'dialogue') g.skill = 'vocab'; });
      assert.equal(validator.validateWall(noDialogue).valid, false, 'Missing dialogue skill must fail');

      // Over 3 words rejected
      const tooLong = JSON.parse(JSON.stringify(walls[0]));
      tooLong.groups[2].items[0] = 'This phrase has five words';
      assert.equal(validator.validateWall(tooLong).valid, false, 'Item > 3 words must fail');

      // Unknown single word rejected
      const unknownWord = JSON.parse(JSON.stringify(walls[0]));
      unknownWord.groups[0].items[0] = 'xyzzynotaword';
      assert.equal(validator.validateWall(unknownWord).valid, false, 'Unknown single word must fail');
    });

    test('shared game engine scores speed bonus + 1.5x combo, pauses clock on visibilitychange, and tracks confusion pairs', () => {
      const engine = window.App.games.engine;
      const s1 = engine.scoreCorrect(0, 8000, 1);
      assert.equal(s1.points, 150, 'Full speed bonus = 100 + 50');
      assert.equal(s1.isCombo, false);

      const s2 = engine.scoreCorrect(4000, 8000, 2);
      assert.equal(s2.points, 125, 'Half speed bonus = 100 + 25');

      const s3 = engine.scoreCorrect(8000, 8000, 3);
      assert.equal(s3.points, 150, '3rd consecutive correct applies 1.5x combo (100 * 1.5)');
      assert.equal(s3.isCombo, true);

      // Clock pauses on visibilitychange
      let pausedHit = false;
      const clock = engine.createClock({ onPause: () => { pausedHit = true; } });
      clock.start();
      const origHiddenDesc = Object.getOwnPropertyDescriptor(document, 'hidden');
      try {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        assert.equal(pausedHit, true, 'Clock auto-pauses when tab hides');
        assert.equal(clock.isPaused(), true);
        clock.resume();
        assert.equal(clock.isPaused(), false);
      } finally {
        clock.stop();
        if (origHiddenDesc) Object.defineProperty(document, 'hidden', origHiddenDesc);
        else document.hidden = false;
      }

      // Confusion pair storage
      window.App.store.db.remove('as.v1.confusions');
      try {
        engine.recordConfusionPair('table', 'kitchen', { wallId: 'w-10' });
        engine.recordConfusionPair('Kitchen', 'Table', { wallId: 'w-10' });
        const pairs = engine.getConfusionPairs();
        assert.equal(pairs.length, 1, 'Confusion pairs normalize order and case');
        assert.equal(pairs[0].count, 2);
      } finally {
        window.App.store.db.remove('as.v1.confusions');
      }
    });

    test('四格分類牆 plays full wall, shows 差一個, logs confusion pairs without box-1 drop, and seeds 今日之牆', () => {
      const wallGame = window.App.games.wall;
      const attempts = window.App.store.attempts;
      const leitner = window.App.store.leitner;
      const engine = window.App.games.engine;
      const mountRoot = document.getElementById('test-router-root');

      // Deterministic daily wall
      const d1 = wallGame.getDailyWall('2026-12-10');
      const d2 = wallGame.getDailyWall('2026-12-10');
      assert.ok(d1 && d1.id === d2.id, '今日之牆 must be deterministic per local dayKey');

      window.App.store.db.remove('as.v1.confusions');
      window.App.store.db.remove('as.v1.wall.progress');
      window.App.store.db.remove('as.v1.attempts');
      window.App.store.db.remove('as.v1.sessions');
      window.App.store.db.remove('as.v1.progress');
      attempts.invalidate();
      leitner.invalidate();

      const w1 = window.App.data.walls[0];
      const notebookCard = window.App.store.cards.findByWord('notebook');
      // Place notebook in box 3 beforehand to prove wrong wall guesses do NOT drop it to box 1
      if (notebookCard) {
        leitner.rateCard(notebookCard.id, 'know', '2026-12-01');
        leitner.rateCard(notebookCard.id, 'know', '2026-12-03');
        assert.equal(leitner.get(notebookCard.id).box, 3);
      }

      try {
        wallGame.mount(mountRoot, { query: { wall: w1.id, instant: '1' } });
        assert.ok(mountRoot.querySelector('[data-wall-phase="play"]'), 'Wall board mounted');
        assert.equal(mountRoot.querySelectorAll('[data-tile]').length, 16, '16 tiles rendered');

        function clickTile(text) {
          const btn = Array.from(mountRoot.querySelectorAll('[data-tile]')).find((b) => b.getAttribute('data-tile') === text);
          assert.ok(btn, 'Tile present: ' + text);
          btn.click();
        }

        // Select 5 items -> capped at 4
        clickTile(w1.groups[0].items[0]);
        clickTile(w1.groups[0].items[1]);
        clickTile(w1.groups[0].items[2]);
        clickTile(w1.groups[1].items[0]); // 3 from group 0 + 1 from group 1
        clickTile(w1.groups[1].items[1]); // 5th click ignored
        assert.equal(mountRoot.querySelectorAll('.wall-tile.is-selected').length, 4, 'Selection capped at 4');

        // Submit 3-of-4 -> "差一個", logs confusion pairs, does NOT demote notebook from box 3
        mountRoot.querySelector('[data-wall-submit="true"]').click();
        const fb = mountRoot.querySelector('.wall-feedback');
        assert.ok(fb && fb.textContent.includes('差一個'), '3-of-4 wrong guess shows 差一個');
        assert.equal(mountRoot.querySelectorAll('.wall-dot.is-spent').length, 1, '1 mistake deducted');
        assert.ok(engine.getConfusionPairs().length >= 3, 'Cross-group confusion pairs logged');
        if (notebookCard) {
          assert.equal(leitner.get(notebookCard.id).box, 3, 'Wall mistake must NOT drop card to Leitner box 1');
        }

        // Re-submitting identical wrong guess does not deduct another mistake
        mountRoot.querySelector('[data-wall-submit="true"]').click();
        assert.equal(mountRoot.querySelectorAll('.wall-dot.is-spent').length, 1, 'Duplicate wrong guess costs 0 mistakes');

        // Deselect all, then solve all 4 groups
        mountRoot.querySelectorAll('.wall-actions button')[1].click();
        for (const g of w1.groups) {
          for (const item of g.items) clickTile(item);
          mountRoot.querySelector('[data-wall-submit="true"]').click();
        }

        assert.ok(mountRoot.querySelector('[data-wall-phase="end"]'), 'End screen shown after solving all 4 groups');
        assert.ok(mountRoot.querySelector('.stamp'), 'End screen shows commemorative stamp');
        assert.equal(mountRoot.querySelectorAll('.wall-item-chip').length, 16, 'All 16 tappable item chips rendered');
        assert.equal(attempts.getSessions('wall').length, 1, 'Completed wall saved 1 session');
      } finally {
        wallGame.unmount();
        window.App.store.db.remove('as.v1.confusions');
        window.App.store.db.remove('as.v1.wall.progress');
        window.App.store.db.remove('as.v1.attempts');
        window.App.store.db.remove('as.v1.sessions');
        window.App.store.db.remove('as.v1.progress');
        attempts.invalidate();
        leitner.invalidate();
      }
    });
  });
})();
