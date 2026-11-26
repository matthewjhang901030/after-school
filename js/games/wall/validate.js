/**
 * Four-Group Wall validator (Section 4.5.3).
 * Used for both handcrafted walls (data/walls.js) and AI-generated walls (M13 Feature E).
 * Rules checked:
 * - Exactly 4 groups, each with 4 non-empty string items (max 3 words per tile)
 * - 16 unique items (case-insensitive, trimmed)
 * - Valid skill ('vocab' | 'grammar' | 'dialogue') on every group, all 3 skills present
 * - Valid difficulty levels 1..4 (each appearing once)
 * - Non-empty label, labelZh, ruleZh on every group
 * - Single-word items exist in active card list, match an inflection of a card,
 *   or belong to the grammar/dialogue whitelist
 * @namespace App.games.wallValidate
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};

  const VALID_SKILLS = ['vocab', 'grammar', 'dialogue'];

  /**
   * Whitelisted single-word grammar forms (irregular verbs, irregular comparatives,
   * past participles, reflexive pronouns, modals, conjunctions, dialogue interjections)
   * not listed as base headwords in data/english-2000-data.js.
   */
  const GRAMMAR_WHITELIST = new Set([
    // Irregular past & past participles
    'went', 'gone', 'ate', 'eaten', 'saw', 'seen', 'took', 'taken',
    'wrote', 'written', 'spoke', 'spoken', 'drove', 'driven', 'gave', 'given',
    'bought', 'brought', 'thought', 'caught', 'taught', 'kept', 'slept', 'felt',
    'left', 'met', 'built', 'sent', 'spent', 'lent', 'knew', 'known', 'fell', 'fallen',
    'chose', 'chosen', 'broke', 'broken', 'began', 'begun', 'ran', 'swam', 'swum',
    'sang', 'sung', 'drank', 'drunk', 'flew', 'flown', 'grew', 'grown', 'threw', 'thrown',
    'wore', 'worn', 'drew', 'drawn', 'won', 'lost', 'found', 'heard', 'told', 'said',
    'made', 'did', 'done', 'had', 'got', 'gotten', 'became', 'came', 'stood', 'understood',
    // Irregular comparatives & superlatives
    'better', 'best', 'worse', 'worst', 'farther', 'further', 'less', 'least', 'more', 'most',
    // Pronouns & reflexives
    'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'themselves',
    'mine', 'yours', 'hers', 'ours', 'theirs',
    // Common single-word dialogue reactions & grammar connectors
    'anytime', 'really', 'seriously', 'definitely', 'certainly', 'absolutely',
    'sure', 'maybe', 'perhaps', 'however', 'therefore', 'unless', 'though', 'whether',
  ]);

  function _cleanToken(str) {
    return String(str || '').trim().replace(/^[("'“‘]+|[?!.,)"'”’]+$/g, '').toLowerCase();
  }

  function _buildCardLexicon(cards) {
    const exact = new Set();
    const variantSet = new Set();
    const list = Array.isArray(cards)
      ? cards
      : (App.store && App.store.cards ? App.store.cards.getAll({ includeHidden: false }) : []);

    for (const c of list) {
      if (!c || !c.word) continue;
      const w = String(c.word).trim().toLowerCase();
      if (!w) continue;
      exact.add(w);
      if (App.text && typeof App.text.variants === 'function' && !/\s/.test(w)) {
        for (const v of App.text.variants(w)) variantSet.add(v);
      }
    }
    return { exact, variantSet };
  }

  /**
   * Validate a single wall object against Section 4.5.3.
   * @param {Object} wall
   * @param {{ cards?: Array<Object>, skipLexicon?: boolean }} [opts]
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validateWall(wall, opts) {
    const o = opts || {};
    const errors = [];

    if (!wall || typeof wall !== 'object') {
      return { valid: false, errors: ['Wall must be an object'] };
    }
    if (!wall.id || typeof wall.id !== 'string') {
      errors.push('Wall must have a string id');
    }
    if (!Array.isArray(wall.groups) || wall.groups.length !== 4) {
      errors.push('Wall must contain exactly 4 groups');
      return { valid: false, errors };
    }

    const lexicon = o.skipLexicon ? null : _buildCardLexicon(o.cards);
    const seenItems = new Set();
    const seenSkills = new Set();
    const seenLevels = new Set();

    wall.groups.forEach((g, idx) => {
      const prefix = `Group ${idx + 1}`;
      if (!g || typeof g !== 'object') {
        errors.push(`${prefix} is not an object`);
        return;
      }
      if (!g.label || !String(g.label).trim()) errors.push(`${prefix} missing label`);
      if (!g.labelZh || !String(g.labelZh).trim()) errors.push(`${prefix} missing labelZh`);
      if (!g.ruleZh || !String(g.ruleZh).trim()) errors.push(`${prefix} missing ruleZh`);

      if (!VALID_SKILLS.includes(g.skill)) {
        errors.push(`${prefix} invalid skill: ${g.skill}`);
      } else {
        seenSkills.add(g.skill);
      }

      const lvl = Number(g.level);
      if (!Number.isInteger(lvl) || lvl < 1 || lvl > 4) {
        errors.push(`${prefix} level must be 1..4`);
      } else if (seenLevels.has(lvl)) {
        errors.push(`${prefix} duplicate level ${lvl}`);
      } else {
        seenLevels.add(lvl);
      }

      if (!Array.isArray(g.items) || g.items.length !== 4) {
        errors.push(`${prefix} must have exactly 4 items`);
        return;
      }

      for (const rawItem of g.items) {
        if (typeof rawItem !== 'string' || !rawItem.trim()) {
          errors.push(`${prefix} has empty item`);
          continue;
        }
        const trimmed = rawItem.trim();
        const words = trimmed.split(/\s+/);
        if (words.length > 4) {
          errors.push(`${prefix} item "${trimmed}" exceeds 4-word tile limit`);
        }

        const key = trimmed.toLowerCase();
        if (seenItems.has(key)) {
          errors.push(`Duplicate item across wall: "${trimmed}"`);
        } else {
          seenItems.add(key);
        }

        // Single-word lexicon check (phrases of 2–3 words are whitelisted phrases)
        if (lexicon && words.length === 1) {
          const tok = _cleanToken(trimmed);
          const known = lexicon.exact.has(tok)
            || lexicon.variantSet.has(tok)
            || GRAMMAR_WHITELIST.has(tok);
          if (!known) {
            errors.push(`${prefix} unknown single-word item: "${trimmed}"`);
          }
        }
      }
    });

    if (seenItems.size !== 16) {
      errors.push(`Wall must have 16 unique items (found ${seenItems.size})`);
    }
    for (const reqSkill of VALID_SKILLS) {
      if (!seenSkills.has(reqSkill)) {
        errors.push(`Wall missing required skill: ${reqSkill}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check across multiple walls that the same dialogue phrase is never reused
   * in two different walls' dialogue groups with conflicting meanings (labels).
   * @param {Array<Object>} walls
   * @returns {Array<{ phrase: string, wallA: string, labelA: string, wallB: string, labelB: string }>}
   */
  function findDialogueConflicts(walls) {
    const list = Array.isArray(walls) ? walls : [];
    const seen = new Map(); // normalized phrase -> { wallId, labelKey, label }
    const conflicts = [];

    for (const w of list) {
      if (!w || !Array.isArray(w.groups)) continue;
      for (const g of w.groups) {
        if (!g || g.skill !== 'dialogue' || !Array.isArray(g.items)) continue;
        const labelKey = String(g.label || g.labelZh || '').trim().toLowerCase();
        for (const raw of g.items) {
          const norm = _cleanToken(raw);
          if (!norm) continue;
          const prev = seen.get(norm);
          if (prev && prev.wallId !== w.id && prev.labelKey !== labelKey) {
            conflicts.push({
              phrase: String(raw).trim(),
              wallA: prev.wallId,
              labelA: prev.label,
              wallB: w.id,
              labelB: g.label || g.labelZh || '',
            });
          } else if (!prev) {
            seen.set(norm, { wallId: w.id, labelKey, label: g.label || g.labelZh || '' });
          }
        }
      }
    }
    return conflicts;
  }

  /**
   * Validate an array of walls and return summary + invalid details + dialogue conflicts.
   * @param {Array<Object>} walls
   * @param {Object} [opts]
   * @returns {{ valid: boolean, validWalls: Array<Object>, failures: Array<{ id: string, errors: string[] }>, dialogueConflicts: Array<Object> }}
   */
  function validateAll(walls, opts) {
    const list = Array.isArray(walls) ? walls : [];
    const validWalls = [];
    const failures = [];
    for (const w of list) {
      const res = validateWall(w, opts);
      if (res.valid) validWalls.push(w);
      else failures.push({ id: (w && w.id) || '(unknown)', errors: res.errors });
    }
    const dialogueConflicts = findDialogueConflicts(validWalls);
    return {
      valid: failures.length === 0 && dialogueConflicts.length === 0 && validWalls.length > 0,
      validWalls,
      failures,
      dialogueConflicts,
    };
  }

  App.games.wallValidate = {
    VALID_SKILLS,
    GRAMMAR_WHITELIST,
    validateWall,
    findDialogueConflicts,
    validateAll,
  };
})();
