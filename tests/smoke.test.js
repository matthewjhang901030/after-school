const { suite } = window.__TEST_HARNESS__;

suite('M0: Data & environment smoke checks', ({ test, assert }) => {
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
