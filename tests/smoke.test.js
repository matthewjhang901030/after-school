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

      // Over 4 words rejected
      const tooLong = JSON.parse(JSON.stringify(walls[0]));
      tooLong.groups[2].items[0] = 'This phrase has five words';
      assert.equal(validator.validateWall(tooLong).valid, false, 'Item > 4 words must fail');

      // Cross-wall dialogue phrase conflict rejected
      assert.equal(res.dialogueConflicts.length, 0, 'No conflicting dialogue phrases across curated walls');
      const conflictPair = [
        JSON.parse(JSON.stringify(walls[0])),
        JSON.parse(JSON.stringify(walls[1])),
      ];
      conflictPair[1].groups.find((g) => g.skill === 'dialogue').items[0] =
        conflictPair[0].groups.find((g) => g.skill === 'dialogue').items[0];
      const conflicts = validator.findDialogueConflicts(conflictPair);
      assert.ok(conflicts.length >= 1, 'Conflicting dialogue phrase across two walls must be caught');
      assert.equal(validator.validateAll(conflictPair).valid, false, 'validateAll must fail on dialogue conflict');

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
        assert.ok(mountRoot.querySelector('[data-wall-why="true"]'), 'Wrong guess shows 「為什麼錯？」 AI button');
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

  // ── M6: 3-Tier AI Layer & Feature A (錯題解說) ──────────────────────────
  suite('M6 · AI Layer (3 Tiers), Validation & Feature A', ({ test, assert }) => {
    const sampleFacts = {
      game: 'class13',
      cardId: 'b-0001',
      word: 'receive',
      meaningZh: '收到',
      pos: 'v.',
      expected: 'receive',
      userAnswer: 'recieve',
      errorType: 'spelling',
      wrongLetters: ['i', 'e'],
      cardExample: 'Did you receive my letter?',
    };

    test('validateFeatureAOutput checks JSON schema, strips hallucinated examples, and preserves valid examples', () => {
      const ai = window.App.ai;
      // Valid JSON wrapped in markdown fences with exact word in example
      const ok = ai.validateFeatureAOutput(
        '```json\n{"why":"你把 i 和 e 寫反了。","tip":"記住 c 後面接 ei。","example":"I will receive the package today."}\n```',
        sampleFacts
      );
      assert.equal(ok.valid, true);
      assert.ok(ok.data.example && ok.data.example.includes('receive'));

      // Example missing target word is dropped (Section 5.5)
      const dropped = ai.validateFeatureAOutput(
        '{"why":"拼字順序有誤。","tip":"檢查 c 後面的 ei。","example":"The cat sat on the mat."}',
        sampleFacts
      );
      assert.equal(dropped.valid, true);
      assert.equal(dropped.data.example, null, 'Example without target word must be dropped');

      // Multi-object rambling output from small 0.5B models still extracts first balanced JSON object
      const multi = ai.validateFeatureAOutput(
        '{"why":"檢查 c 後面接 ei。","tip":"拆成 re-ceive 記。","example":"I will receive it."}, {"why":"extra"}',
        sampleFacts
      );
      assert.equal(multi.valid, true, 'Balanced-brace extraction handles trailing second object');
      assert.equal(multi.data.why, '檢查 c 後面接 ei。');

      // Invalid JSON or missing required fields rejected when requireJson is true
      assert.equal(ai.validateFeatureAOutput('not json at all', sampleFacts).valid, false);
      assert.equal(ai.validateFeatureAOutput('{"why":"只有原因沒有提示"}', sampleFacts).valid, false);
    });

    test('lenient plain-text parser handles messy 0.5B outputs, S2T conversion, missing labels, and safety rejections', () => {
      const ai = window.App.ai;
      const wallFacts = {
        game: 'wall',
        spoilerSafe: true,
        selectedItems: ['notebook', 'pencil', 'eraser', 'went'],
        isOneAway: true,
        distinctGroupCount: 2,
        skillsPresent: ['vocab', 'grammar'],
      };

      // 1. Simplified Chinese + full-width colons -> converted to Traditional Chinese & accepted
      const p1 = ai.parseFeatureAOutput(
        '原因：这四个单词里三个是文具，但 went 是过去式动词。\n记忆提示：先把动词和名词分开判断。',
        wallFacts
      );
      assert.equal(p1.valid, true, 'Simplified 2-line output must pass after S2T');
      assert.ok(p1.data.why.includes('這四個單詞') && p1.data.why.includes('動詞'), 'Simplified converted to Traditional');
      assert.ok(p1.data.tip.includes('動詞') && p1.data.tip.includes('分開'));

      // 2. Half-width colons + markdown bold + bullets + quotes -> cleaned & accepted
      const p2 = ai.parseFeatureAOutput(
        '- **原因**: 「notebook 與 pencil 都是文具名詞，went 不同類。」\n- **提示**: "注意詞性差異再選一次。"',
        wallFacts
      );
      assert.equal(p2.valid, true, 'Half-width colons + markdown + bullets must pass');
      assert.ok(!p2.data.why.includes('**') && !p2.data.why.startsWith('「'));
      assert.ok(p2.data.tip.includes('詞性差異'));

      // 3. Missing labels (two plain sentences) -> first sentence = why, second = tip
      const p3 = ai.parseFeatureAOutput(
        'notebook、pencil、eraser 都是文具用品，只有 went 是動詞。建議先找出不同詞性的誘答字。',
        wallFacts
      );
      assert.equal(p3.valid, true, 'Missing labels must split first sentence as why and rest as tip');
      assert.ok(p3.data.why.includes('went'));
      assert.ok(p3.data.tip.includes('誘答字'));

      // 4. Single plain sentence without labels -> accepted as why + grounded fallback tip
      const p4 = ai.parseFeatureAOutput(
        '這四個項目混合了單字與動詞文法。',
        wallFacts
      );
      assert.equal(p4.valid, true, 'Single good Chinese sentence should pass with grounded tip');
      assert.ok(p4.data.tip.length > 0);

      // 5. Pure English gibberish in zh-TW mode -> rejected with not_chinese
      const p5 = ai.parseFeatureAOutput('This is purely English with no Chinese characters.', wallFacts);
      assert.equal(p5.valid, false);
      assert.equal(p5.reason, 'not_chinese');

      // 6. Contradicting code-supplied facts -> rejected with contradicts_facts
      const p6 = ai.parseFeatureAOutput('原因：這四個都是同一組，這題答對了。\n記憶提示：繼續加油。', wallFacts);
      assert.equal(p6.valid, false);
      assert.equal(p6.reason, 'contradicts_facts');

      const p7 = ai.parseFeatureAOutput('原因：正確拼法是 recieve。\n記憶提示：多念幾次。', sampleFacts);
      assert.equal(p7.valid, false);
      assert.equal(p7.reason, 'contradicts_facts');
    });

    test('Feature A works in all 3 tiers when forced from Settings and falls back to template on invalid JSON', async () => {
      const ai = window.App.ai;
      const settings = window.App.store.settings;
      const origEngine = settings.get('aiEngine');
      const origNanoGen = ai.nano.generate;
      const origNanoDetect = ai.nano.detect;
      const origNanoTrans = ai.nano.translateEnToZh;
      const origQwenInit = ai.qwen.init;
      const origQwenGen = ai.qwen.generate;
      const origQwenSup = ai.qwen.isSupported;

      try {
        // Tier 3: Forced offline template
        settings.update({ aiEngine: 'templates' });
        ai.invalidateDetection();
        const rTpl = await ai.explainMistake(sampleFacts);
        assert.equal(rTpl.source, 'template');
        assert.equal(rTpl.fellBack, false);
        assert.ok(rTpl.why.includes('receive') && rTpl.tip.length > 0);

        // Tier 1: Forced Nano (why + tip stay code/template; Nano writes AI English example)
        ai.nano.detect = async () => ({ available: true, ready: true, availability: 'available', translatorAvailability: 'available' });
        ai.nano.generate = async () => ({
          text: 'Did you receive my message yesterday?',
          elapsedMs: 120,
        });
        ai.nano.translateEnToZh = async (s) => '[ZH] ' + s;
        settings.update({ aiEngine: 'nano' });
        ai.invalidateDetection();
        const rNano = await ai.explainMistake(sampleFacts);
        assert.equal(rNano.source, 'nano');
        assert.equal(rNano.exampleSource, 'nano');
        assert.equal(rNano.fellBack, false);
        assert.ok(rNano.why.includes('receive'), 'Why is deterministic code');
        assert.ok(rNano.tip.length > 0, 'Tip is deterministic code/template');
        assert.equal(rNano.example, 'Did you receive my message yesterday?');

        // Tier 2: Forced Qwen (code builds 錯誤原因 + 記憶提示; Qwen writes ONLY 1 short English AI 例句)
        ai.qwen.isSupported = () => true;
        ai.qwen.init = async () => ({ loadMs: 50, device: 'webgpu', dtype: 'q4f16' });
        ai.qwen.generate = async (opts) => {
          assert.ok(Array.isArray(opts.messages) && opts.messages.length >= 6, 'Qwen uses English multi-turn few-shot chat template');
          assert.ok(opts.temperature > 0 && opts.temperature <= 0.4, 'Qwen uses low temperature (~0.3)');
          assert.equal(opts.noRepeatNgramSize, 3, 'Qwen uses no_repeat_ngram_size: 3');
          assert.equal(opts.maxNewTokens, 30, 'Qwen caps AI example at 30 new tokens');
          assert.equal(opts.stopOnNewline, true, 'Qwen stops at first newline');
          return {
            text: 'I will receive your email tomorrow.\nExtra second line ignored.',
            elapsedMs: 1800,
            firstTokenMs: 420,
            tokenCount: 11,
            loadMs: 50,
            tokensPerSec: 18.5,
            device: 'webgpu',
            modelKey: '0.5b',
            modelLabel: 'Qwen 2.5 0.5B',
          };
        };
        settings.update({ aiEngine: 'qwen' });
        ai.invalidateDetection();
        const rQwen = await ai.explainMistake(sampleFacts);
        assert.equal(rQwen.source, 'qwen');
        assert.equal(rQwen.exampleSource, 'qwen');
        assert.equal(rQwen.fellBack, false);
        assert.ok(rQwen.why.includes('receive') && rQwen.why.includes('recieve'), '錯誤原因 is generated deterministically by code');
        assert.equal(rQwen.tip, ai.buildDeterministicTip(sampleFacts), '記憶提示 is always the code/template tip');
        assert.equal(rQwen.example, 'I will receive your email tomorrow.', 'AI example stops at first newline');
        assert.equal(rQwen.matchedText, 'receive');
        assert.equal(rQwen.targetMeaningZh, '收到');

        // Rejected output (missing target word) retries up to 2 more times (0.3 -> 0.6 -> 0.8), logs every attempt, and falls back to card example
        const seenTemps = [];
        ai.clearAttemptsLog();
        ai.qwen.generate = async (opts) => {
          seenTemps.push(opts.temperature);
          return {
            text: 'The cat slept quietly on the warm sofa.',
            elapsedMs: 120,
            firstTokenMs: 40,
            tokenCount: 9,
            loadMs: 0,
            tokensPerSec: 10.0,
            device: 'webgpu',
            modelKey: '0.5b',
            modelLabel: 'Qwen 2.5 0.5B',
          };
        };
        const rFallback = await ai.explainMistake(sampleFacts);
        assert.equal(seenTemps.length, 3, 'Must retry up to 2 more times (3 total attempts) within budget');
        assert.deepEqual(seenTemps, [0.3, 0.6, 0.8], 'Retry temperatures must progress 0.3 -> 0.6 -> 0.8');
        assert.equal(rFallback.source, 'template');
        assert.equal(rFallback.exampleSource, 'card', 'Falls back to card real example when available');
        assert.equal(rFallback.example, sampleFacts.cardExample);
        assert.equal(rFallback.fellBack, true);
        assert.equal(rFallback.note, 'missing_target');
        assert.ok(rFallback.why.includes('receive'), 'Code-generated reason still explains the mistake');

        const loggedRetries = ai.getLastAttempts(5);
        assert.equal(loggedRetries.length, 3, 'Every retry attempt must be logged in AI Diagnostics');
        const lastAttempt = ai.getLastAttempt();
        assert.ok(lastAttempt && lastAttempt.rawOutput === 'The cat slept quietly on the warm sofa.', 'Raw model output recorded for diagnostics');
        assert.equal(lastAttempt.rejectionReason, 'missing_target', 'Exact rejection reason recorded');
        assert.equal(lastAttempt.temperature, 0.8, 'Final attempt temperature recorded');
        assert.equal(lastAttempt.tokenCount, 9);

        // AI Diagnostics page displays Last 5 AI attempts (raw output + rejection reason + telemetry)
        const mountRoot = document.getElementById('test-router-root');
        window.App.pages.aiDiagnostics.mount(mountRoot);
        await new Promise((r) => setTimeout(r, 20));
        const diagAttempt = mountRoot.querySelector('[data-ai-last-attempt="true"]');
        assert.ok(diagAttempt, 'AI Diagnostics renders attempt card');
        assert.ok(diagAttempt.textContent.includes('missing_target'), 'Rejection reason displayed in Diagnostics');
        assert.ok(mountRoot.querySelector('[data-ai-raw-output="true"]').textContent.includes('The cat slept'));
        window.App.pages.aiDiagnostics.unmount();
      } finally {
        ai.nano.generate = origNanoGen;
        ai.nano.detect = origNanoDetect;
        ai.nano.translateEnToZh = origNanoTrans;
        ai.qwen.init = origQwenInit;
        ai.qwen.generate = origQwenGen;
        ai.qwen.isSupported = origQwenSup;
        settings.update({ aiEngine: origEngine });
        ai.invalidateDetection();
      }
    });

    test('AI panel renders textContent safely (no HTML injection), supports Stop, and saves tip to card', async () => {
      const ai = window.App.ai;
      const origExplain = ai.explainMistake;
      const cards = window.App.store.cards;
      const tempCard = cards.add({ word: 'quilltest', zh: '羽毛筆' });

      try {
        ai.explainMistake = async () => ({
          why: '<img src=x onerror=alert(1)> spelling check',
          tip: 'Remember quill starts with qu.',
          example: 'She wrote with a quilltest pen.',
          source: 'qwen',
          device: 'webgpu',
          fellBack: false,
          note: null,
          elapsedMs: 6815,
        });

        const panel = window.App.aiPanel.create({
          game: 'class13',
          cardId: tempCard.id,
          word: tempCard.word,
          meaningZh: tempCard.zh,
        }, { autoStart: false });

        await panel.start('qwen');
        const whyEl = panel.root.querySelector('[data-ai-why="true"]');
        assert.ok(whyEl, 'Why text rendered');
        assert.equal(whyEl.querySelectorAll('img').length, 0, 'Model output must never be parsed as HTML');
        assert.ok(whyEl.textContent.includes('<img src=x'), 'Raw text rendered safely via textContent');

        // Active device shown in AI badge and elapsedMs (6815 ms) formatted as 6.8 seconds
        const badge = panel.root.querySelector('.ai-source-badge');
        assert.ok(badge && badge.textContent.includes('WebGPU'), 'Active device (WebGPU) displayed in AI badge');
        assert.ok(panel.root.textContent.includes('6.8'), 'Elapsed time 6815 ms must render as 6.8 seconds');
        assert.ok(!panel.root.textContent.includes('6815'), 'Raw milliseconds must never render as seconds');

        // Disclaimer always shown (Section 5.6)
        assert.ok(panel.root.textContent.includes(window.App.i18n.t('ai.disclaimer')));

        // Clicking "存到卡片" saves aiTip to card
        const saveBtn = Array.from(panel.root.querySelectorAll('button')).find((b) =>
          b.textContent.includes(window.App.i18n.t('ai.save_to_card'))
        );
        assert.ok(saveBtn, 'Save to card button present');
        saveBtn.click();
        assert.equal(cards.getById(tempCard.id).aiTip, 'Remember quill starts with qu.');
      } finally {
        ai.explainMistake = origExplain;
        cards.removeUserCard(tempCard.id);
      }
    });

    test('TTFT timeout clears on first token, times out if silent, warmUpIfCached never auto-downloads, and 80-token JSON salvages', async () => {
      const ai = window.App.ai;
      const origInit = ai.qwen.init;
      const origGen = ai.qwen.generate;
      const origInspect = ai.qwen.inspectCache;
      const origSup = ai.qwen.isSupported;

      try {
        ai.qwen.isSupported = () => true;

        // 1. Truncated 80-token JSON salvage when both "why" and "tip" are present
        const salvaged = ai.validateFeatureAOutput('{"why":"詞性不同。","tip":"把動詞和名詞分開', sampleFacts);
        assert.equal(salvaged.valid, true, 'Cleanly truncated 80-token JSON should be salvaged');
        assert.equal(salvaged.data.why, '詞性不同。');

        // 2. TTFT timeout: first token arrives at 20ms, full answer at 90ms with timeoutMs=50ms -> MUST SUCCEED
        ai.qwen.init = async () => ({ loadMs: 5, device: 'webgpu', dtype: 'q4f16' });
        ai.qwen.generate = async (opts) => {
          await new Promise((r) => setTimeout(r, 20));
          if (opts.onToken) opts.onToken('Did ', 'Did ');
          await new Promise((r) => setTimeout(r, 70));
          assert.equal(opts.maxNewTokens, 30, 'Feature A must cap Qwen AI example at 30 new tokens');
          return {
            text: 'Did you receive the letter today?',
            elapsedMs: 90,
            firstTokenMs: 20,
            tokenCount: 7,
            device: 'webgpu',
            modelKey: '0.5b',
            modelLabel: 'Qwen 2.5 0.5B',
          };
        };
        const streamedRes = await ai.explainMistake(sampleFacts, { forceTier: 'qwen', timeoutMs: 50 });
        assert.equal(streamedRes.source, 'qwen', 'Streaming after first token must not time out');
        assert.equal(streamedRes.device, 'webgpu');

        // 3. TTFT timeout: NO token arrives before 40ms -> aborts & falls back to template with note 'timeout'
        ai.qwen.generate = (opts) => new Promise((resolve, reject) => {
          const onAbort = () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          };
          if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true });
        });
        const timedOutRes = await ai.explainMistake(sampleFacts, { forceTier: 'qwen', timeoutMs: 40 });
        assert.equal(timedOutRes.source, 'template', 'Silent generation past TTFT timeout falls back to template');
        assert.equal(timedOutRes.note, 'timeout');

        // 4. warmUpIfCached MUST NOT call init() when model is not cached
        let initCalled = false;
        ai.qwen.inspectCache = async () => ({ cached: false, files: 0, bytes: 0 });
        ai.qwen.init = async () => { initCalled = true; return {}; };
        const warmRes = await ai.warmUpIfCached();
        assert.equal(warmRes.warmed, false);
        assert.equal(initCalled, false, 'warmUpIfCached must never auto-download when uncached');
      } finally {
        ai.qwen.init = origInit;
        ai.qwen.generate = origGen;
        ai.qwen.inspectCache = origInspect;
        ai.qwen.isSupported = origSup;
      }
    });

    test('deterministic reason builder covers all 12 walls, repetition quality gate rejects degenerate loops, and model selector switches 0.5B/1.5B', async () => {
      const ai = window.App.ai;
      const walls = window.App.data.walls;
      const settings = window.App.store.settings;
      const origModel = settings.get('qwenModel');
      const origInit = ai.qwen.init;
      const origGen = ai.qwen.generate;
      const origSup = ai.qwen.isSupported;

      try {
        // 1. Deterministic 錯誤原因 for ALL 12 walls
        assert.ok(walls.length >= 12);
        for (const w of walls) {
          const picked = [
            w.groups[0].items[0],
            w.groups[0].items[1],
            w.groups[1].items[0],
            w.groups[2].items[0],
          ];
          const breakdown = ai.templates.buildWallBreakdown(w, picked);
          assert.equal(breakdown.length, 3, `${w.id} mixed pick spans 3 groups`);
          const reason = ai.buildDeterministicReason({
            game: 'wall',
            selectedItems: picked,
            selectedBreakdown: breakdown,
          });
          for (const item of picked) {
            assert.ok(reason.includes(item), `${w.id} reason must mention "${item}"`);
          }
          assert.ok(reason.includes(w.groups[0].labelZh), `${w.id} reason must name group 0`);
          assert.ok(reason.includes(w.groups[1].labelZh), `${w.id} reason must name group 1`);
          assert.ok(reason.includes(w.groups[2].labelZh), `${w.id} reason must name group 2`);
          assert.ok(reason.includes('這四個不在同一組'), `${w.id} reason ends clearly`);
        }

        // 2. Repetition detector & quality gate MUST reject the real Edge degenerate loop
        const edgeLoop = '自己、自己、自己、他人。他、自己=教授、學習、他人。自、他人。自我=自他人。他, 自他人。他、自他人。他…';
        const loopCheck = ai.validateTipOutput(edgeLoop, { game: 'wall' });
        assert.equal(loopCheck.valid, false, 'Degenerate repetition loop from Edge MUST be rejected');
        assert.equal(loopCheck.reason, 'repetition_loop');

        // > 40% duplicate chars without a 3x chunk
        const dupText = '我們們我你你你他他他這這這';
        const dupCheck = ai.validateTipOutput(dupText, { game: 'wall' });
        assert.equal(dupCheck.valid, false, 'High duplicate character ratio must be rejected');
        assert.ok(dupCheck.reason === 'high_duplicate_ratio' || dupCheck.reason === 'repetition_loop');

        // Longer than 40 characters in one sentence -> too_long
        const tooLongTip = 'saw 是動詞的過去式變化，而 chalk 是教室黑板常用的書寫文具，兩者在日常英文課堂上的用法與分類規則完全不同。';
        const longCheck = ai.validateTipOutput(tooLongTip, { game: 'wall' });
        assert.equal(longCheck.valid, false, 'Tip longer than 40 chars must be rejected');
        assert.equal(longCheck.reason, 'too_long');

        // No Chinese in zh-TW
        const noZhCheck = ai.validateTipOutput('Remember to separate verbs from nouns.', { game: 'wall' });
        assert.equal(noZhCheck.valid, false);
        assert.equal(noZhCheck.reason, 'no_chinese');

        // Valid concise tip passes cleanly (stops at first 。 and converts S2T)
        const w0 = walls[0];
        const wallFacts = {
          game: 'wall',
          selectedItems: ['ate', 'took', "You're welcome", 'eraser'],
          selectedBreakdown: ai.templates.buildWallBreakdown(w0, ['ate', 'took', "You're welcome", 'eraser']),
        };
        const goodTip = ai.validateTipOutput('先把动词过去式和日常对话短句分开。\n不要理会第二行。', wallFacts);
        assert.equal(goodTip.valid, true, 'Good concise tip passes quality gate');
        assert.equal(goodTip.tip, '先把動詞過去式和日常對話短句分開。');

        // 3. Fallback path when Qwen emits a non-Latin/degenerate loop: keeps code reason & template tip, records rawOutput + non_latin
        ai.qwen.isSupported = () => true;
        ai.qwen.init = async () => ({ loadMs: 10, device: 'webgpu', dtype: 'q4f16' });
        ai.qwen.generate = async () => ({
          text: edgeLoop,
          elapsedMs: 1200,
          firstTokenMs: 250,
          tokenCount: 40,
          device: 'webgpu',
          modelKey: '0.5b',
          modelLabel: 'Qwen 2.5 0.5B',
        });
        const fbRes = await ai.explainMistake(wallFacts, { forceTier: 'qwen' });
        assert.equal(fbRes.source, 'template', 'Non-Latin degenerate loop falls back cleanly');
        assert.equal(fbRes.fellBack, true);
        assert.equal(fbRes.note, 'non_latin');
        assert.ok(fbRes.why.includes('ate、took') && fbRes.why.includes('這四個不在同一組'), 'Code-generated reason remains intact on fallback');
        assert.equal(fbRes.tip, ai.buildDeterministicTip(wallFacts), 'Code/template tip remains intact');
        const logged = ai.getLastAttempt();
        assert.equal(logged.rawOutput, edgeLoop, 'Raw degenerate loop stored in AI attempts log');
        assert.equal(logged.rejectionReason, 'non_latin');

        // 4. Opt-in Qwen model switch (0.5B ~467 MB vs 1.5B ~1172 MB)
        settings.update({ qwenModel: '1.5b' });
        assert.equal(ai.qwen.getSelectedModel().id, 'onnx-community/Qwen2.5-1.5B-Instruct');
        assert.equal(ai.qwen.approxSizeMB(), 1172);
        settings.update({ qwenModel: '0.5b' });
        assert.equal(ai.qwen.getSelectedModel().id, 'onnx-community/Qwen2.5-0.5B-Instruct');
        assert.equal(ai.qwen.approxSizeMB(), 467);
      } finally {
        ai.qwen.init = origInit;
        ai.qwen.generate = origGen;
        ai.qwen.isSupported = origSup;
        settings.update({ qwenModel: origModel });
        ai.invalidateDetection();
      }
    });

    test('echo detector rejects prompt_echo, relevance check rejects off_topic, and WASM Aborted() maps to load_error + 1.5B auto-switch', async () => {
      const ai = window.App.ai;
      const walls = window.App.data.walls;
      const settings = window.App.store.settings;
      const origModel = settings.get('qwenModel');
      const origInit = ai.qwen.init;
      const origInspect = ai.qwen.inspectCache;
      const origSup = ai.qwen.isSupported;

      const sawChalkFacts = {
        game: 'wall',
        selectedItems: ['saw', 'ate', 'chalk', 'eraser'],
        selectedBreakdown: ai.templates.buildWallBreakdown(walls[0], ['saw', 'ate', 'chalk', 'eraser']),
      };

      try {
        // 1. Prompt asks about ONE specific word pair (saw and chalk) with no length-limit instruction words
        const reason = ai.buildDeterministicReason(sawChalkFacts);
        const msgs = ai.buildTipMessages(reason, sawChalkFacts, { language: 'zh-TW' });
        const lastUserMsg = msgs[msgs.length - 1].content;
        assert.ok(lastUserMsg.includes('saw') && lastUserMsg.includes('chalk'), 'Prompt focuses on one concrete word pair');
        assert.ok(!/30字|40字|字內|簡潔/.test(msgs.map((m) => m.content).join(' ')), 'Length limits stay in code, not prompt text');

        // 2. Echo detector MUST reject the real Chrome echo string as prompt_echo
        const echo1 = ai.validateTipOutput('30字內的簡潔體中的素除外。', sawChalkFacts);
        assert.equal(echo1.valid, false, 'Chrome echoed instruction text must be rejected');
        assert.equal(echo1.reason, 'prompt_echo');

        // 4+ consecutive char overlap with few-shot prompt text -> prompt_echo
        const echo2 = ai.validateTipOutput('看詞性就能分開 saw 和 chalk。', sawChalkFacts);
        assert.equal(echo2.valid, false, '4+ char overlap with few-shot prompt must be rejected as prompt_echo');
        assert.equal(echo2.reason, 'prompt_echo');

        // 3. Relevance check: tip without any selected word or group keyword -> off_topic
        const off1 = ai.validateTipOutput('每天早睡早起對身體很有幫助。', sawChalkFacts);
        assert.equal(off1.valid, false, 'Unrelated tip must be rejected as off_topic');
        assert.equal(off1.reason, 'off_topic');

        // Relevant tip mentioning selected word or group keyword -> passes
        const rel1 = ai.validateTipOutput('saw 是動詞過去式，chalk 是教室粉筆。', sawChalkFacts);
        assert.equal(rel1.valid, true, 'Relevant tip naming saw/chalk passes');
        const rel2 = ai.validateTipOutput('先把過去式和文具分開就好記。', sawChalkFacts);
        assert.equal(rel2.valid, true, 'Relevant tip naming group keywords passes');

        // 4. Error classification: WASM Aborted() -> load_error; network fetch -> download_error
        const abortErr = new Error('Aborted(). Build with -sASSERTIONS for more info.');
        assert.equal(ai.classifyInitError(abortErr, { cachedBefore: true }), 'load_error');
        assert.equal(ai.classifyInitError(abortErr, { cachedBefore: false }), 'load_error');
        assert.equal(ai.classifyInitError(new Error('Failed to fetch'), { cachedBefore: false }), 'download_error');

        // 5. End-to-end 1.5B Aborted() -> load_error, user message says 模型載入失敗, auto-switches back to 0.5b
        ai.qwen.isSupported = () => true;
        ai.qwen.inspectCache = async () => ({ cached: true, files: 5, bytes: 1172 * 1024 * 1024, modelKey: '1.5b' });
        ai.qwen.init = async () => { throw abortErr; };
        settings.update({ qwenModel: '1.5b' });
        ai.invalidateDetection();

        const res15b = await ai.explainMistake(sawChalkFacts, { forceTier: 'qwen' });
        assert.equal(res15b.source, 'template');
        assert.equal(res15b.fellBack, true);
        assert.equal(res15b.note, 'load_error_15b');
        assert.equal(settings.get('qwenModel'), '0.5b', 'Failed 1.5B load must auto-switch back to 0.5b');
        assert.equal(ai.getLastAttempt().rejectionReason, 'load_error', 'Last AI Attempt records load_error, not download_error');

        // Panel message says 模型載入失敗 (not 模型下載中斷)
        const panel = window.App.aiPanel.create(sawChalkFacts, { autoStart: false });
        const origExplain = ai.explainMistake;
        ai.explainMistake = async () => res15b;
        try {
          await panel.start('qwen');
          assert.ok(panel.root.textContent.includes('模型載入失敗'), 'User message must say 模型載入失敗');
          assert.ok(!panel.root.textContent.includes('模型下載中斷'), 'User message must not say 模型下載中斷');
        } finally {
          ai.explainMistake = origExplain;
        }
      } finally {
        ai.qwen.init = origInit;
        ai.qwen.inspectCache = origInspect;
        ai.qwen.isSupported = origSup;
        settings.update({ qwenModel: origModel });
        ai.invalidateDetection();
      }
    });

    test('AI 例句 sentence gate, meaningless Chinese tip immunity, safe highlighting, fallback hiding, and last 5 attempts log', async () => {
      const ai = window.App.ai;
      const walls = window.App.data.walls;
      const origInit = ai.qwen.init;
      const origGen = ai.qwen.generate;
      const origSup = ai.qwen.isSupported;

      try {
        // 1. Sentence quality gate checks
        // Missing target word -> missing_target
        const gMissing = ai.validateSentenceOutput('He walked quickly to the bus stop.', 'eraser');
        assert.equal(gMissing.valid, false);
        assert.equal(gMissing.reason, 'missing_target');

        // Too long (> 14 words) -> too_long
        const gLong = ai.validateSentenceOutput(
          'She carefully borrowed a clean white eraser from her best friend in the quiet school library this morning.',
          'eraser'
        );
        assert.equal(gLong.valid, false);
        assert.equal(gLong.reason, 'too_long');

        // Too short (< 4 words) -> too_short
        const gShort = ai.validateSentenceOutput('Use an eraser.', 'eraser');
        assert.equal(gShort.valid, false);
        assert.equal(gShort.reason, 'too_short');

        // Non-Latin (the real meaningless Chinese output from Chrome) -> non_latin
        const chromeGarbage = 'note 起做任何事，anytime 作「謝謝」，一個就算兩倒，成這。';
        const gNonLatin = ai.validateSentenceOutput(chromeGarbage, 'a note');
        assert.equal(gNonLatin.valid, false);
        assert.equal(gNonLatin.reason, 'non_latin');

        // Word repeated 3+ times -> word_repetition
        const gRep = ai.validateSentenceOutput('He took a note note note in class.', 'a note');
        assert.equal(gRep.valid, false);
        assert.equal(gRep.reason, 'word_repetition');

        // Cut-off sentence (no ending ., !, or ?) -> incomplete_sentence
        const gCut = ai.validateSentenceOutput('He used an eraser to clean the', 'eraser');
        assert.equal(gCut.valid, false);
        assert.equal(gCut.reason, 'incomplete_sentence');

        // Copied few-shot example -> copied_fewshot
        const gCopy = ai.validateSentenceOutput('I took a note in class.', 'took a note');
        assert.equal(gCopy.valid, false);
        assert.equal(gCopy.reason, 'copied_fewshot');

        // Exact Chrome bad sentence: "It's a eraser that I'm using as the eraser." -> MUST be rejected
        const gChromeBad = ai.validateSentenceOutput("It's a eraser that I'm using as the eraser.", 'eraser');
        assert.equal(gChromeBad.valid, false, 'Chrome bad sentence with wrong article & repeated target must be rejected');
        assert.ok(gChromeBad.reason === 'article_error' || gChromeBad.reason === 'target_repeated');

        // Article error checks ("a" before vowel sound, "an" before consonant sound)
        const gArt1 = ai.validateSentenceOutput("It's a eraser on my desk.", 'eraser');
        assert.equal(gArt1.valid, false);
        assert.equal(gArt1.reason, 'article_error');

        const gArt2 = ai.validateSentenceOutput('She carried a umbrella to school.', 'umbrella');
        assert.equal(gArt2.valid, false);
        assert.equal(gArt2.reason, 'article_error');

        const gArt3 = ai.validateSentenceOutput('He bought an book yesterday.', 'book');
        assert.equal(gArt3.valid, false);
        assert.equal(gArt3.reason, 'article_error');

        // Sound exceptions & take/phrasal targets must NOT trigger false positives on article_error / target_repeated
        assert.equal(ai.validateSentenceOutput('She studies at a university downtown.', 'university').valid, true);
        assert.equal(ai.validateSentenceOutput('We waited for an hour near the station.', 'hour').valid, true);
        assert.equal(ai.validateSentenceOutput('She got an A on the math test.', 'test').valid, true);
        assert.equal(ai.validateSentenceOutput('I wrote a note for my friend.', 'a note').valid, true);
        assert.equal(ai.validateSentenceOutput('Please take a seat near the window.', 'a seat').valid, true);
        assert.equal(ai.validateSentenceOutput('I took a shower after basketball practice.', 'a shower').valid, true);
        assert.equal(ai.validateSentenceOutput('Can you help me out with this box?', 'Can you help me out?').valid, true);
        assert.equal(ai.validateSentenceOutput('Could you help me out after class?', 'Can you help me out?').valid, true);

        // Target choice: prefer single words / take-phrases, NEVER pick dialogue phrases when non-dialogue tiles exist
        const dlgHeavyW1 = {
          game: 'wall',
          selectedItems: ["You're welcome", 'No problem', 'My pleasure', 'eraser'],
          selectedBreakdown: ai.templates.buildWallBreakdown(walls[0], ["You're welcome", 'No problem', 'My pleasure', 'eraser']),
        };
        assert.equal(ai.pickTargetForExample(dlgHeavyW1).targetWord, 'eraser', 'Must skip dialogue group and pick eraser');

        const dlgHeavyW2 = {
          game: 'wall',
          selectedItems: ['Could you help?', 'Help me out', 'Got a second?', 'spring'],
          selectedBreakdown: ai.templates.buildWallBreakdown(walls[1], ['Could you help?', 'Help me out', 'Got a second?', 'spring']),
        };
        assert.equal(ai.pickTargetForExample(dlgHeavyW2).targetWord, 'spring', 'Must skip dialogue phrases and pick spring');

        const takePhraseW1 = {
          game: 'wall',
          selectedItems: ['a note', 'a seat', 'Anytime', 'No problem'],
          selectedBreakdown: ai.templates.buildWallBreakdown(walls[0], ['a note', 'a seat', 'Anytime', 'No problem']),
        };
        const takePick = ai.pickTargetForExample(takePhraseW1);
        assert.ok(takePick.targetWord === 'a note' || takePick.targetWord === 'a seat', 'Picks take-phrase over dialogue');

        // Retry schedule: fails at t=0.3, succeeds on retry 2 at t=0.6, logs BOTH attempts, badge shows Qwen 2.5 + WebGPU (not 離線範本)
        ai.clearAttemptsLog();
        let retrySeq = 0;
        const retryTempsSeen = [];
        ai.qwen.isSupported = () => true;
        ai.qwen.init = async () => ({ loadMs: 5, device: 'webgpu', dtype: 'q4f16' });
        ai.qwen.generate = async (opts) => {
          retrySeq++;
          retryTempsSeen.push(opts.temperature);
          return {
            text: retrySeq === 1 ? 'The Seat:' : 'I borrowed an eraser from my classmate.',
            elapsedMs: 120,
            firstTokenMs: 40,
            tokenCount: 8,
            device: 'webgpu',
            modelKey: '0.5b',
            modelLabel: 'Qwen 2.5 0.5B',
          };
        };
        const retryPanel = window.App.aiPanel.create(dlgHeavyW1, { autoStart: false });
        const retryRes = await retryPanel.start('qwen');
        assert.deepEqual(retryTempsSeen, [0.3, 0.6], 'Stops retrying on first sentence that passes');
        assert.equal(retryRes.exampleSource, 'qwen');
        assert.equal(ai.getLastAttempts(5).length, 2, 'Logs both failed and succeeded attempts');
        assert.ok(retryPanel.root.querySelector('.ai-source-badge').textContent.includes('WebGPU'), 'Top badge shows Qwen WebGPU when example succeeds');
        assert.ok(!retryPanel.root.querySelector('.ai-source-badge').textContent.includes('離線範本'), 'Must NOT show 離線範本 when Qwen example passed');
        assert.ok(retryPanel.root.querySelector('[data-ai-example-badge="true"]').textContent.includes('WebGPU'), 'AI 例句 badge shows Qwen WebGPU');

        // Target repeated more than once -> target_repeated
        const gTargetRep = ai.validateSentenceOutput('She used an eraser to clean the eraser.', 'eraser');
        assert.equal(gTargetRep.valid, false);
        assert.equal(gTargetRep.reason, 'target_repeated');

        // Valid natural sentence for eraser -> MUST pass
        const gValidEraser = ai.validateSentenceOutput('I borrowed an eraser from my classmate.', 'eraser');
        assert.equal(gValidEraser.valid, true, 'Natural valid sentence must pass');
        assert.equal(gValidEraser.matchedText, 'eraser');

        // Prompt includes POS and Chinese meaning from card data
        const eraserMsgs = ai.buildExampleMessages('eraser', { pos: 'n.', meaningZh: '橡皮擦' });
        assert.equal(eraserMsgs[eraserMsgs.length - 1].content, 'Word: eraser (noun, 橡皮擦)', 'Prompt includes POS + Chinese meaning');

        // Accepts simple inflections (take/took/takes/taking/taken) and stops at first newline
        const gInflect1 = ai.validateSentenceOutput('She is taking a note right now.\nAnother line here.', 'took a note');
        assert.equal(gInflect1.valid, true, 'Inflection "taking a note" accepted for target "took a note"');
        assert.equal(gInflect1.sentence, 'She is taking a note right now.');
        assert.equal(gInflect1.matchedText, 'taking a note');

        const gInflect2 = ai.validateSentenceOutput('They ate dinner together at six.', 'eat');
        assert.equal(gInflect2.valid, true, 'Irregular inflection "ate" accepted for target "eat"');
        assert.equal(gInflect2.matchedText, 'ate');

        // 2. Meaningless Chinese tip can NEVER be displayed as a tip anymore
        const noteWallFacts = {
          game: 'wall',
          selectedItems: ['a note', 'a break', 'Anytime', 'eraser'],
          selectedBreakdown: ai.templates.buildWallBreakdown(walls[0], ['a note', 'a break', 'Anytime', 'eraser']),
        };
        ai.qwen.isSupported = () => true;
        ai.qwen.init = async () => ({ loadMs: 10, device: 'webgpu', dtype: 'q4f16' });
        ai.qwen.generate = async () => ({
          text: chromeGarbage,
          elapsedMs: 800,
          firstTokenMs: 200,
          tokenCount: 22,
          device: 'webgpu',
          modelKey: '0.5b',
          modelLabel: 'Qwen 2.5 0.5B',
        });

        const resGarbage = await ai.explainMistake(noteWallFacts, { forceTier: 'qwen' });
        assert.equal(resGarbage.tip, ai.buildDeterministicTip(noteWallFacts), 'Tip is ALWAYS the deterministic code/template tip');
        assert.ok(!resGarbage.tip.includes('成這'), 'Meaningless Chinese AI output can NEVER appear in tip');
        assert.equal(resGarbage.note, 'non_latin');

        // 3. Panel highlights target word safely with <mark> & shows card Chinese meaning under sentence
        ai.qwen.generate = async () => ({
          text: 'She wrote a quick note on the paper.',
          elapsedMs: 750,
          firstTokenMs: 180,
          tokenCount: 9,
          device: 'webgpu',
          modelKey: '0.5b',
          modelLabel: 'Qwen 2.5 0.5B',
        });
        const panelOk = window.App.aiPanel.create(noteWallFacts, { autoStart: false });
        const resOk = await panelOk.start('qwen');
        assert.equal(resOk.exampleSource, 'qwen');
        const exRow = panelOk.root.querySelector('[data-ai-example-row="true"]');
        assert.ok(exRow, 'AI 例句 row rendered');
        const markEl = panelOk.root.querySelector('[data-ai-highlight="true"]');
        assert.ok(markEl && markEl.tagName === 'MARK' && /note/i.test(markEl.textContent), 'Target word highlighted in <mark>');
        const meaningEl = panelOk.root.querySelector('[data-ai-example-meaning="true"]');
        assert.ok(meaningEl && meaningEl.textContent.trim().length > 0, 'Card Chinese meaning shown under AI example');

        // 4. When Qwen is rejected and card has NO real example -> hide AI 例句 block completely & show 離線範本 badge
        const noExFacts = {
          game: 'wall',
          selectedItems: ['Could you help?', 'Help me out', 'rain', 'wind'],
          selectedBreakdown: ai.templates.buildWallBreakdown(walls[1], ['Could you help?', 'Help me out', 'rain', 'wind']),
        };
        ai.qwen.generate = async () => ({
          text: 'Cut off without period',
          elapsedMs: 100,
          firstTokenMs: 50,
          tokenCount: 5,
          device: 'webgpu',
          modelKey: '0.5b',
          modelLabel: 'Qwen 2.5 0.5B',
        });
        const panelHidden = window.App.aiPanel.create(noExFacts, { autoStart: false });
        const resHidden = await panelHidden.start('qwen');
        assert.equal(resHidden.example, null, 'No broken sentence returned when card has no real example');
        assert.equal(panelHidden.root.querySelector('[data-ai-example-row="true"]'), null, 'AI 例句 block hidden completely when rejected and no card example');
        assert.ok(panelHidden.root.querySelector('.ai-source-badge').textContent.includes('離線範本'), '離線範本 badge shown when all attempts fail and no card example exists');
        assert.ok(!panelHidden.root.textContent.includes('改顯示卡片例句'), 'Fallback note must not claim card example is shown when hidden');

        // 4b. When Qwen fails on a wall pick where a selected non-dialogue tile HAS a real card example -> show 卡片例句 (not AI)
        const hasCardExFacts = {
          game: 'wall',
          selectedItems: ['rain', 'wind', 'spring', 'Could you help?'],
          selectedBreakdown: ai.templates.buildWallBreakdown(walls[1], ['rain', 'wind', 'spring', 'Could you help?']),
        };
        const panelCardEx = window.App.aiPanel.create(hasCardExFacts, { autoStart: false });
        const resCardEx = await panelCardEx.start('qwen');
        assert.equal(resCardEx.exampleSource, 'card', 'Falls back to real card example from selected non-dialogue tile');
        assert.ok(resCardEx.example && resCardEx.example.length > 0);
        const cardExBadge = panelCardEx.root.querySelector('[data-ai-example-badge="true"]');
        assert.ok(cardExBadge && cardExBadge.textContent.includes('卡片例句'), 'Card fallback labeled 卡片例句, not AI');

        // 5. Diagnostics keeps the last 5 AI attempts (newest first) and renders all 5 in #/settings/ai
        ai.clearAttemptsLog();
        for (let i = 1; i <= 6; i++) {
          ai.qwen.generate = async () => ({
            text: `She used an eraser number ${i} today.`,
            elapsedMs: 100 + i * 10,
            firstTokenMs: 40,
            tokenCount: 7,
            device: 'webgpu',
            modelKey: '0.5b',
            modelLabel: 'Qwen 2.5 0.5B',
          });
          await ai.explainMistake({ game: 'class13', word: 'eraser', meaningZh: '橡皮擦', errorType: 'spelling' }, { forceTier: 'qwen' });
        }
        const last5 = ai.getLastAttempts(5);
        assert.equal(last5.length, 5, 'Attempts log caps at last 5 attempts');
        assert.ok(last5[0].rawOutput.includes('6'), 'Newest attempt (#6) is first');
        assert.ok(last5[4].rawOutput.includes('2'), 'Oldest retained attempt is #2 (#1 evicted)');

        const mountRoot = document.getElementById('test-router-root');
        window.App.pages.aiDiagnostics.mount(mountRoot);
        await new Promise((r) => setTimeout(r, 20));
        const renderedCards = mountRoot.querySelectorAll('[data-ai-attempt-item="true"]');
        assert.equal(renderedCards.length, 5, '#/settings/ai renders all 5 recent AI attempts');
        assert.ok(mountRoot.querySelector('[data-ai-attempt-time="true"]').textContent.includes(':'), 'Each attempt shows a formatted timestamp');
        window.App.pages.aiDiagnostics.unmount();
      } finally {
        ai.qwen.init = origInit;
        ai.qwen.generate = origGen;
        ai.qwen.isSupported = origSup;
      }
    });
  });

  // ── M7: 你說我猜 (Taboo-style semantic guessing game) ────────────────────
  suite('M7 · 你說我猜 (Rule Checker, Candidates, Fallback Ranker & Attempts)', ({ test, assert }) => {
    test('rule checker blocks target/taboo words and simple forms, non-English, short/long, and duplicates', () => {
      const checks = window.App.games.guessChecks;

      // Non-English rejected
      const rZh = checks.validateDescription('這是一個安靜的地方可以學習', 'library', ['book', 'read', 'borrow'], []);
      assert.equal(rZh.ok, false);
      assert.equal(rZh.reason, 'non_english');

      // Too short (< 4 words) and too long (> 30 words)
      const rShort = checks.validateDescription('Quiet study place', 'library', ['book', 'read', 'borrow'], []);
      assert.equal(rShort.ok, false);
      assert.equal(rShort.reason, 'too_short');

      const longText = new Array(32).fill('quiet').join(' ');
      const rLong = checks.validateDescription(longText, 'library', ['book', 'read', 'borrow'], []);
      assert.equal(rLong.ok, false);
      assert.equal(rLong.reason, 'too_long');

      // Duplicate clue rejected
      const prev = ['A quiet public building for students.'];
      const rDup = checks.validateDescription('  a quiet public building for students. ', 'library', ['book', 'read', 'borrow'], prev);
      assert.equal(rDup.ok, false);
      assert.equal(rDup.reason, 'duplicate_clue');

      // Target word & inflections blocked (plural, -ed, -ing, irregular)
      const rTargetExact = checks.validateDescription('Students visit the library after school.', 'library', ['book', 'read', 'borrow'], []);
      assert.equal(rTargetExact.ok, false);
      assert.equal(rTargetExact.reason, 'contains_target');
      assert.deepEqual(rTargetExact.offendingWords, ['library']);

      const rTargetPlural = checks.validateDescription('Many city libraries stay open late.', 'library', ['book', 'read', 'borrow'], []);
      assert.equal(rTargetPlural.ok, false);
      assert.equal(rTargetPlural.reason, 'contains_target');

      const rTargetIng = checks.validateDescription('People are walking quickly along the road.', 'walk', ['step', 'foot', 'move'], []);
      assert.equal(rTargetIng.ok, false);
      assert.equal(rTargetIng.reason, 'contains_target');

      const rTargetIrreg = checks.validateDescription('She ate dinner with her family yesterday.', 'eat', ['food', 'meal', 'bite'], []);
      assert.equal(rTargetIrreg.ok, false);
      assert.equal(rTargetIrreg.reason, 'contains_target');

      // Forbidden (taboo) words & simple forms blocked
      const rTabooPlural = checks.validateDescription('A quiet room full of books and desks.', 'library', ['book', 'read', 'borrow'], []);
      assert.equal(rTabooPlural.ok, false);
      assert.equal(rTabooPlural.reason, 'contains_taboo');
      assert.deepEqual(rTabooPlural.matchedTaboos, ['book']);

      const rTabooIng = checks.validateDescription('Students sit quietly while reading every afternoon.', 'library', ['book', 'read', 'borrow'], []);
      assert.equal(rTabooIng.ok, false);
      assert.equal(rTabooIng.reason, 'contains_taboo');
      assert.deepEqual(rTabooIng.matchedTaboos, ['read']);

      const rTabooEd = checks.validateDescription('She borrowed a magazine from the front desk.', 'library', ['book', 'read', 'borrow'], []);
      assert.equal(rTabooEd.ok, false);
      assert.equal(rTabooEd.reason, 'contains_taboo');

      // Clean English clue passes
      const rOk = checks.validateDescription('A quiet public building where students study with free shelves.', 'library', ['book', 'read', 'borrow'], []);
      assert.equal(rOk.ok, true);
      assert.equal(rOk.wordCount, 10);
    });

    test('candidate builder creates bounded same-topic set (15-20 distractors) and taboo picker chooses 3+ valid words', () => {
      const checks = window.App.games.guessChecks;
      const cards = window.App.store.cards.getAll({ includeHidden: false });
      const rng = window.App.random.create('m7-cand-seed');

      const targets = checks.selectSessionTargets(cards, 5, { rng });
      assert.equal(targets.length, 5, 'Session selects 5 target cards');
      for (const t of targets) {
        assert.equal(checks.isEligibleTarget(t), true, 'Every selected target is eligible');
      }

      const target = cards.find((c) => c.word.toLowerCase() === 'library') || targets[0];
      const candidates = checks.buildCandidates(target, cards, { distractorCount: 18, rng });
      assert.equal(candidates.length, 19, 'Candidate list has target + 18 distractors');
      assert.ok(candidates.some((c) => c.id === target.id), 'Target is included in candidates');

      const uniqueWords = new Set(candidates.map((c) => c.word.toLowerCase()));
      assert.equal(uniqueWords.size, candidates.length, 'All candidate headwords are unique');

      // Same-topic preference: at least some distractors share chapter or unit with target when available
      if (target.chapterNo != null) {
        const sameChap = candidates.filter((c) => c.id !== target.id && c.chapterNo === target.chapterNo);
        assert.ok(sameChap.length > 0, 'Candidates prioritize distractors from same chapter/topic');
      }

      // Offline taboo picker returns 3 valid words excluding target variants
      const taboos = checks.pickTabooWords(target, candidates, { count: 3 });
      assert.equal(taboos.length, 3, 'Picks 3 forbidden words');
      const targetForms = new Set(checks.expandForms(target.word));
      for (const tw of taboos) {
        assert.ok(!targetForms.has(tw.toLowerCase()), 'Taboo word must not be target or variant');
      }

      // Embedding nearest-neighbor taboo picker selects closest vectors
      const vecMap = new Map();
      vecMap.set(target.id, [1, 0, 0]);
      const others = candidates.filter((c) => c.id !== target.id);
      others.forEach((c, idx) => {
        vecMap.set(c.id, idx === 0 ? [0.99, 0.1, 0] : (idx === 1 ? [0.95, 0.3, 0] : (idx === 2 ? [0.9, 0.4, 0] : [0, 1, 0])));
      });
      const embTaboos = checks.pickTabooWords(target, candidates, { count: 3, embeddingsMap: vecMap });
      assert.equal(embTaboos.length, 3);
      assert.ok(embTaboos.includes(others[0].word.toLowerCase()), 'Nearest cosine neighbor chosen as taboo word');

      // Scoring matches Section 4.4.1 (300/200/100 for #1; half for top-3)
      assert.equal(checks.scoreRound(1, 1), 300);
      assert.equal(checks.scoreRound(2, 1), 200);
      assert.equal(checks.scoreRound(3, 1), 100);
      assert.equal(checks.scoreRound(1, 2), 150);
      assert.equal(checks.scoreRound(2, 3), 100);
      assert.equal(checks.scoreRound(3, 4), 0);
    });

    test('offline keyword-overlap ranker works cleanly and rankCandidates falls back when MiniLM fails', async () => {
      const embed = window.App.ai.embed;
      const sampleCards = [
        { id: 'c-lib', word: 'library', pos: 'n.', zh: '圖書館', hasRealExample: true, example: 'Students study quietly in the silent hall with free shelves.', tags: ['School'] },
        { id: 'c-spo', word: 'spoon', pos: 'n.', zh: '湯匙', hasRealExample: true, example: 'She used a silver spoon to eat hot soup.', tags: ['Food'] },
        { id: 'c-rai', word: 'rain', pos: 'n.', zh: '雨', hasRealExample: true, example: 'Heavy drops fall from dark clouds in the sky.', tags: ['Weather'] },
        { id: 'c-dog', word: 'dog', pos: 'n.', zh: '狗', hasRealExample: true, example: 'The loyal pet wags its tail and barks loudly.', tags: ['Animals'] },
      ];

      // 1. Offline ranker places target #1 on matching clues
      const rFood = embed.rankOffline('A silver kitchen tool you hold to eat hot soup.', sampleCards);
      assert.equal(rFood.engine, 'offline');
      assert.equal(rFood.ranked[0].word, 'spoon', 'Offline ranker ranks spoon #1 for soup/silver clue');
      assert.ok(rFood.ranked[0].pct >= rFood.ranked[1].pct, 'Softmax percentages decrease with rank');

      const rWeather = embed.rankOffline('Wet drops falling from dark sky clouds outside.', sampleCards);
      assert.equal(rWeather.ranked[0].word, 'rain', 'Offline ranker ranks rain #1 for clouds/sky/drops clue');

      // 2. Cosine similarity & softmax sanity
      assert.ok(Math.abs(embed.cosine([1, 0], [1, 0]) - 1) < 1e-6);
      assert.ok(Math.abs(embed.cosine([1, 0], [0, 1])) < 1e-6);
      const pcts = embed.softmaxScores([{ score: 0.9 }, { score: 0.7 }, { score: 0.5 }], 0.1);
      assert.ok(pcts[0] > pcts[1] && pcts[1] > pcts[2], 'Softmax preserves strict ordering');

      // 3. rankCandidates falls back to offline ranker automatically when Worker/MiniLM fails
      const origSupported = embed.isSupported;
      try {
        embed.isSupported = () => false;
        const fb = await embed.rankCandidates('Wet drops falling from dark clouds.', sampleCards, {});
        assert.equal(fb.engine, 'offline');
        assert.equal(fb.ranked[0].word, 'rain');
      } finally {
        embed.isSupported = origSupported;
      }
    });

    test('你說我猜 game UI enforces rules, displays engine badges, logs attempts to as.v1.attempts, and feeds Review on miss', async () => {
      const guessGame = window.App.games.guess;
      const embed = window.App.ai.embed;
      const attempts = window.App.store.attempts;
      const leitner = window.App.store.leitner;
      const mountRoot = document.getElementById('test-router-root');
      const origRank = embed.rankCandidates;
      const origInspect = embed.inspectCache;

      try {
        embed.inspectCache = async () => ({ cached: false, files: 0, bytes: 0 });
        const ctrl = guessGame.mount(mountRoot, { query: { words: 'spoon,apple,winter,coffee,sweet' } });

        // Start in offline mode -> badge shows 離線版本
        await ctrl.startSession('offline');
        const st1 = ctrl.getState();
        assert.equal(st1.phase, 'play');
        assert.ok(st1.target, 'First round target loaded');
        assert.equal(st1.taboos.length, 3, 'Round shows 3 forbidden words');
        assert.ok(mountRoot.querySelector('[data-guess-engine-badge="true"]').textContent.includes('離線版本'));

        // Rule block: saying target word -> rejected with <del data-guess-strike="true">
        await ctrl.submitClue(`I really like using this ${st1.target.word} every day.`);
        assert.ok(mountRoot.querySelector('[data-guess-error="contains_target"]'), 'Target word violation shown');
        assert.ok(mountRoot.querySelector('[data-guess-strike="true"]'), 'Offending target word struck in red');

        // Rule block: saying taboo word -> rejected with <mark data-guess-taboo-hit="true">
        await ctrl.submitClue(`A common item related to ${st1.taboos[0]} every morning.`);
        assert.ok(mountRoot.querySelector('[data-guess-error="contains_taboo"]'), 'Taboo word violation shown');
        assert.ok(mountRoot.querySelector('[data-guess-taboo-hit="true"]'), 'Offending taboo word highlighted');

        // Valid clue where AI ranks target #1 -> wins 300 pts & logs correct attempt to as.v1.attempts
        const target1 = st1.target;
        const other1 = st1.candidates.filter((c) => c.id !== target1.id);
        embed.rankCandidates = async () => ({
          engine: 'minilm',
          device: 'webgpu',
          fellBack: false,
          elapsedMs: 42,
          ranked: [
            { card: target1, word: target1.word, score: 0.88, pct: 68, rank: 1 },
            { card: other1[0], word: other1[0].word, score: 0.55, pct: 21, rank: 2 },
            { card: other1[1], word: other1[1].word, score: 0.42, pct: 11, rank: 3 },
          ],
        });
        const beforeCount = attempts.getAll().length;
        await ctrl.submitClue('A shiny metal utensil held in your hand for soup.');
        const afterWin = ctrl.getState();
        assert.equal(afterWin.phase, 'round_done');
        assert.equal(afterWin.totalScore, 300, '1st clue #1 guess awards 300 points');
        assert.ok(mountRoot.querySelector('[data-guess-ai-bubble="true"]').textContent.includes('MiniLM · WebGPU'), 'AI bubble displays MiniLM · WebGPU badge');

        const winAttempts = attempts.getAll();
        assert.equal(winAttempts.length, beforeCount + 1, 'Won round logged to as.v1.attempts');
        assert.equal(winAttempts[winAttempts.length - 1].source, 'guess');
        assert.equal(winAttempts[winAttempts.length - 1].correct, true);
        assert.equal(winAttempts[winAttempts.length - 1].cardId, target1.id);

        // Advance to round 2 and skip -> logs wrong attempt AND sends card to Leitner box 1 due today (feeds Review)
        const nextBtn = mountRoot.querySelector('[data-guess-next="true"]');
        assert.ok(nextBtn, 'Next card button present');
        nextBtn.click();
        await new Promise((r) => setTimeout(r, 15));

        const st2 = ctrl.getState();
        assert.equal(st2.phase, 'play');
        const target2 = st2.target;
        const skipBtn = mountRoot.querySelector('[data-guess-skip="true"]');
        assert.ok(skipBtn, 'Skip button present');
        skipBtn.click();

        const afterMiss = attempts.getAll();
        const lastLog = afterMiss[afterMiss.length - 1];
        assert.equal(lastLog.source, 'guess');
        assert.equal(lastLog.correct, false, 'Skipped/missed round logged as wrong');
        assert.equal(lastLog.cardId, target2.id);

        const prog2 = leitner.get(target2.id);
        assert.ok(prog2, 'Missed card recorded in Leitner progress');
        assert.equal(prog2.box, 1, 'Missed card placed in Box 1');
        assert.equal(prog2.due, window.App.date.todayKey(), 'Missed card due today so it feeds Review');
        assert.equal(prog2.lastWrongIn, 'guess');
      } finally {
        embed.rankCandidates = origRank;
        embed.inspectCache = origInspect;
        guessGame.unmount();
        window.App.store.db.remove('as.v1.attempts');
        window.App.store.db.remove('as.v1.sessions');
        window.App.store.db.remove('as.v1.progress');
        attempts.invalidate();
        leitner.invalidate();
      }
    });

    test('30-item guess-eval.js benchmark set validates cleanly against cards and rule checker', () => {
      const evalSet = window.App.data && window.App.data.guessEval;
      const cards = window.App.store.cards;
      const allCards = cards.getAll({ includeHidden: false });
      const checks = window.App.games.guessChecks;
      const embed = window.App.ai.embed;

      assert.ok(Array.isArray(evalSet) && evalSet.length === 30, 'guess-eval.js contains 30 items');
      let top3Hits = 0;
      const rng = window.App.random.create('guess-eval-v1');
      for (const item of evalSet) {
        const card = cards.findByWord(item.word);
        assert.ok(card && !card.hidden, `Eval word "${item.word}" exists in active cards`);
        const valid = checks.validateDescription(item.description, item.word, [], []);
        assert.equal(valid.ok, true, `Eval description for "${item.word}" passes rule checks (${valid.reason})`);
        const cands = checks.buildCandidates(card, allCards, { distractorCount: 18, rng });
        const ranked = embed.rankOffline(item.description, cands).ranked;
        const pos = ranked.findIndex((r) => r.card.id === card.id);
        if (pos >= 0 && pos < 3) top3Hits++;
      }
      assert.ok(top3Hits >= 5, `Offline fallback ranker beats baseline on same-topic 19-candidate eval set (got ${top3Hits}/30)`);
    });
  });

  // ── M8: 第 13 節課 (Core Horror Typing Game) ─────────────────────────────
  suite('M8 · 第 13 節課 (Formulas, Data Banks, Per-Letter Typing, Creature & Flow)', ({ test, assert }) => {
    test('formulas, tense (80 items) & broadcast (40 items) banks, and word-priority ordering match spec 4.3', () => {
      const Q = window.App.games.class13Questions;

      // Exact Section 4.3.1 formulas
      assert.equal(Q.periodTargetScore(1), 600);
      assert.equal(Q.periodTargetScore(2), 800);
      assert.equal(Q.periodTargetScore(3), 1000);
      assert.equal(Q.periodTargetScore(5), 1400);
      assert.equal(Q.creatureSpeed(1), 0.20);
      assert.equal(Q.creatureSpeed(2), 0.25);
      assert.equal(Q.creatureSpeed(3), 0.30);
      assert.equal(Q.clampDistance(13.5), 12.0);
      assert.equal(Q.clampDistance(-1.2), 0);

      // Content bank minimums (Section 4.6): >= 80 tense, >= 40 broadcast
      const tense = window.App.data.tense;
      const broadcast = window.App.data.broadcast;
      assert.ok(Array.isArray(tense) && tense.length >= 80, 'data/tense.js has at least 80 items');
      assert.ok(Array.isArray(broadcast) && broadcast.length >= 40, 'data/broadcast.js has at least 40 items');
      for (const item of tense) {
        assert.ok(item.base && Array.isArray(item.accepted) && item.accepted.length >= 1 && item.ruleZh, `Valid tense item ${item.id}`);
      }
      for (const item of broadcast) {
        assert.ok(item.lineA && item.lineB && Array.isArray(item.accepted) && item.accepted.length >= 1 && item.ruleZh, `Valid broadcast item ${item.id}`);
        assert.equal((item.lineA.match(/___/g) || []).length, 0, `Broadcast ${item.id} lineA has no blank`);
        assert.equal((item.lineB.match(/___/g) || []).length, 1, `Broadcast ${item.id} lineB has exactly 1 blank`);
      }

      // Word pool priority: recent wrong -> box 1 -> due -> confusion -> rest
      const sampleCards = [
        { id: 'c1', word: 'apple', zh: '蘋果' },
        { id: 'c2', word: 'banana', zh: '香蕉' },
        { id: 'c3', word: 'cherry', zh: '櫻桃' },
        { id: 'c4', word: 'date', zh: '棗子' },
        { id: 'c5', word: 'elder', zh: '長輩' },
      ];
      const pool = Q.buildWordPool(sampleCards, {
        recentWrongIds: ['c4'],
        progressMap: { c2: { box: 1, due: '2099-01-01' }, c3: { box: 2, due: '2026-01-01' } },
        today: '2026-11-28',
        confusionWords: ['elder'],
        rng: window.App.random.create('c13-prio'),
      });
      assert.equal(pool[0].id, 'c4', 'Recent 7-day wrong word comes first');
      assert.equal(pool[1].id, 'c2', 'Box 1 card comes second');
      assert.equal(pool[2].id, 'c3', 'Due card comes third');
      assert.equal(pool[3].id, 'c5', 'Confusion-pair word comes fourth');
    });

    test('per-letter validation supports multi-answer alternatives (didn\'t / did not), spaces, Backspace, and wrong-key detection', () => {
      const Q = window.App.games.class13Questions;
      const accepted = ["didn't", 'did not'];

      // Path A: typing "did not" with space
      let typed = '';
      for (const ch of 'did not') {
        const r = Q.evaluateKeystroke(typed, ch, accepted);
        assert.equal(r.accepted, true, `Key "${ch}" accepted along "did not"`);
        typed = r.nextTyped;
        if (typed === 'did not') assert.equal(r.completed, true);
      }

      // Path B: typing "didn't" with apostrophe
      typed = '';
      for (const ch of "didn't") {
        const r = Q.evaluateKeystroke(typed, ch, accepted);
        assert.equal(r.accepted, true, `Key "${ch}" accepted along "didn't"`);
        typed = r.nextTyped;
        if (typed === "didn't") assert.equal(r.completed, true);
      }

      // Wrong keystroke rejected with expectedNext
      const bad = Q.evaluateKeystroke('di', 'z', accepted);
      assert.equal(bad.accepted, false);
      assert.equal(bad.ignored, false);
      assert.equal(bad.nextTyped, 'di');
      assert.equal(bad.expectedNext, 'd');

      // Backspace works cleanly
      const bs = Q.evaluateKeystroke('di', 'Backspace', accepted);
      assert.equal(bs.accepted, true);
      assert.equal(bs.nextTyped, 'd');

      // Mask reflects typed + cursor + blanks
      const mask = Q.buildAnswerMask('di', accepted);
      assert.equal(mask[0].state, 'typed');
      assert.equal(mask[1].state, 'typed');
      assert.equal(mask[2].state, 'cursor');
      assert.equal(mask[3].state, 'blank');
    });

    test('creature SVG scales with distance and inscribes missed words in red ink safely via textContent', () => {
      const Creature = window.App.games.class13Creature;
      const ctrl = Creature.create({ maxDistance: 12 });
      ctrl.update(12.0, []);
      const g = ctrl.root.querySelector('[data-c13-creature="true"]');
      const tFar = g.getAttribute('transform');

      ctrl.update(2.0, ['receive', '<script>alert(1)</script>']);
      const tNear = g.getAttribute('transform');
      assert.ok(tFar !== tNear, 'Creature SVG transform scales closer as distance decreases');
      assert.ok(ctrl.root.querySelector('[data-c13-distance="true"]').textContent.includes('2.0'));

      const bodyWords = ctrl.root.querySelector('[data-c13-body-words="true"]');
      assert.ok(bodyWords.textContent.includes('receive'), 'Missed word written on creature body');
      assert.equal(ctrl.root.querySelectorAll('script').length, 0, 'Zero HTML/script injection inside SVG');
    });

    test('第 13 節課 playable loop: distance updates, period clear, timeout -> 補考名單 + Box 1, lose -> end screen, and unmount cleanup', async () => {
      const game = window.App.games.class13;
      const attempts = window.App.store.attempts;
      const leitner = window.App.store.leitner;
      const settings = window.App.store.settings;
      const mountRoot = document.getElementById('test-router-root');
      const origSafe = settings.get('safeMode');

      try {
        // Enable safeMode so lose transitions straight to end screen without 600ms delay
        settings.update({ safeMode: true });
        const ctrl = game.mount(mountRoot);
        assert.ok(mountRoot.querySelector('[data-c13-enter="true"]'), 'Start screen renders 進教室 button');

        // Start session (skip countdown for deterministic test)
        ctrl.startSession({ skipCountdown: true });
        let st = ctrl.getState();
        assert.equal(st.phase, 'play');
        assert.equal(st.period, 1);
        assert.equal(st.distanceM, 12.0);
        assert.ok(st.currentQ, 'Question loaded');

        // Wrong keystroke pulls creature closer by 0.3m and records mistyped letter
        const badChar = st.currentQ.accepted[0][0] === 'z' ? 'q' : 'z';
        ctrl.handleKey(badChar);
        st = ctrl.getState();
        assert.ok(st.distanceM < 12.0, 'Wrong keystroke reduces distance');
        assert.ok(Object.keys(st.wrongLetterCounts).length >= 1, 'Wrong letter count recorded');

        // Complete the active word -> awards score, pushes creature back (+1.5m capped at 12m), logs correct attempt
        const firstQ = st.currentQ;
        const firstAns = firstQ.accepted[0];
        for (const ch of firstAns) ctrl.handleKey(ch);
        st = ctrl.getState();
        assert.ok(st.totalScore >= 100, 'Correct answer awards >= 100 points');
        assert.equal(st.distanceM, 12.0, 'Correct answer pushes distance back up to 12.0m cap');
        const logged = attempts.getAll();
        assert.ok(logged.some((a) => a.source === 'class13' && a.correct === true && a.expected === firstQ.displayAnswer), 'Correct answer logged in as.v1.attempts');

        // Wait briefly for next question, then trigger question timeout -> -2.0m, logged as miss + 補考名單
        await new Promise((r) => setTimeout(r, 260));
        st = ctrl.getState();
        const timedQ = st.currentQ;
        ctrl.triggerTimeout();
        st = ctrl.getState();
        assert.ok(st.distanceM <= 10.0, 'Timeout pulls creature 2.0m closer');
        assert.equal(st.missedItems.length, 1, 'Missed item added to 補考名單');
        if (timedQ && timedQ.cardId) {
          const prog = leitner.get(timedQ.cardId);
          assert.equal(prog.box, 1, 'Missed card sent to Leitner Box 1');
          assert.equal(prog.due, window.App.date.todayKey(), 'Missed card due today');
        }

        // Wait for next question and force distance -> 0 via repeated timeouts -> transitions to End Screen
        for (let step = 0; step < 6; step++) {
          await new Promise((r) => setTimeout(r, 450));
          if (ctrl.getState().phase === 'end') break;
          ctrl.triggerTimeout();
        }
        st = ctrl.getState();
        assert.equal(st.phase, 'end', 'Reaching 0m ends the game cleanly');
        assert.ok(mountRoot.querySelector('[data-c13-end="true"]'), 'End screen rendered');
        assert.ok(mountRoot.querySelector('[data-class13-mistakes="true"]'), '補考名單 rendered on end screen');
        assert.ok(mountRoot.querySelector('[data-class13-wrong-letters="true"]'), 'Most-mistyped letters rendered');
        assert.ok(mountRoot.querySelector('[data-class13-ai-explain="true"]'), '請 AI 解釋錯題 button rendered');

        // Unmount cleans up all listeners & timers cleanly
        game.unmount();
        assert.equal(window.App.router.hasGuard ? window.App.router.hasGuard() : false, false);
      } finally {
        game.unmount();
        settings.update({ safeMode: origSafe });
        window.App.store.db.remove('as.v1.attempts');
        window.App.store.db.remove('as.v1.sessions');
        window.App.store.db.remove('as.v1.progress');
        attempts.invalidate();
        leitner.invalidate();
      }
    });
  });
})();
