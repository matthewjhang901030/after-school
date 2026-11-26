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

    test('variants generates English inflections (+s/+ed/+ing/+er/+est)', () => {
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
    });

    test('tabooDetect catches whole-word forms without partial-word false positives', () => {
      const hit = tabooDetect('I really love this word.', variants('love'));
      assert.equal(hit.found, true);
      assert.ok(hit.matched.includes('love'));

      const miss = tabooDetect('I love lovely flowers.', ['loves']);
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

    test('QuotaExceededError switches to in-memory fallback', () => {
      const original = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function () {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      };
      db._resetFallback();
      db.set('__test.quota', 'value');
      localStorage.setItem = original;

      assert.equal(db.isUsingFallback(), true);
      assert.equal(db.get('__test.quota'), 'value');
      db._resetFallback();
    });
  });

  suite('M2: App.i18n & live re-render', ({ test, assert }) => {
    const { t, lang, setLang, init } = window.App.i18n;
    const routerRoot = document.getElementById('test-router-root');

    test('translates zh-TW, en, params, and English fallback cleanly', () => {
      init('zh-TW');
      assert.equal(t('nav.dashboard'), '首頁');
      assert.ok(t('timetable.period', { n: 3 }).includes('3'));

      window.AS_I18N_EN['__test.only_en'] = 'Only EN';
      assert.equal(t('__test.only_en'), 'Only EN');
      delete window.AS_I18N_EN['__test.only_en'];

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

    test('unknown route redirects to dashboard and shows toast', () => {
      navigate('#/nonexistent-route-xyz');
      assert.equal(window.location.hash, '#/');
      assert.equal(current().path, '#/');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // M3: Flashcards, Leitner, Decks, and TTS
  // ═══════════════════════════════════════════════════════════════

  suite('M3: App.store.cards builtin import, POS & CRUD', ({ test, assert }) => {
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

    test('merges 2029 rows into 1924 unique cards and hides suspect_ocr_word 0722', () => {
      const allWithHidden = cards.getAll({ includeHidden: true });
      const active = cards.getAll({ includeHidden: false });
      assert.equal(allWithHidden.length, 1924);
      assert.equal(active.length, 1923);

      const b0722 = cards.getById('b-0722');
      assert.ok(b0722);
      assert.equal(b0722.hidden, true);
      assert.equal(b0722.excludeFromGames, true);

      const baby = cards.getById('b-0001');
      assert.equal(baby.word, 'baby');
      assert.equal(baby.ipa, null);
      assert.equal(baby.pos, 'n.');
    });

    test('validates card inputs and detects case-insensitive duplicates', () => {
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

    test('getDistractors excludes target, duplicates, and suspect_ocr_word', () => {
      const target = cards.getById('b-0001');
      const dist = cards.getDistractors(target, 3);
      assert.equal(dist.length, 3);
      dist.forEach((d) => {
        assert.ok(d.id !== target.id);
        assert.ok(d.id !== 'b-0722');
        assert.ok(d.pos === 'n.');
      });
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

    test('default deck resolves 1923 active builtin cards and cannot be deleted', () => {
      const def = decks.getById(decks.DEFAULT_DECK_ID);
      assert.ok(def);
      assert.equal(decks.getCardIds(def.id).length, 1923);
      assert.equal(decks.remove(def.id), null);
    });

    test('custom deck CRUD, 4-card game threshold, and restore undo', () => {
      const d = decks.create({ name: 'Exam Prep', ringColor: 'grammar', cardIds: ['b-0001', 'b-0002'] });
      assert.equal(decks.canPlayFourOptionGame(d.id), false);

      decks.setCardDecks('b-0003', [d.id]);
      decks.setCardDecks('b-0004', [d.id]);
      assert.equal(decks.canPlayFourOptionGame(d.id), true);

      const snap = decks.remove(d.id);
      assert.equal(decks.getById(d.id), null);
      // Cards remain intact after deck delete
      assert.ok(cards.getById('b-0001'));

      decks.restore(snap);
      assert.ok(decks.getById(d.id));
      decks.remove(d.id);
    });

    test('rapid flip clicks during 400ms lock are ignored and TTS stops safely', () => {
      const fc = window.App.flashcard.create({ word: 'electroencephalography', ipa: null, zh: '腦電圖' });
      const fontSize = parseInt(fc.root.querySelector('.flashcard-word').style.fontSize, 10);
      assert.ok(fontSize >= 28);
      fc.flip();
      assert.equal(fc.isFlipped(), true);
      fc.flip(); // rapid click within 400ms must be ignored
      assert.equal(fc.isFlipped(), true);

      const ttsStatus = window.App.audio.tts.status();
      assert.equal(typeof ttsStatus.supported, 'boolean');
      window.App.audio.tts.stop();
    });
  });
})();
