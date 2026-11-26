(function () {
  'use strict';
  const { suite } = window.__TEST_HARNESS__;

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
})();
