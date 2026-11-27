/**
 * Curated 扭蛋機 class-rule gacha cards for 第 13 節課 (Section 4.3.5 & 4.6).
 * 8 data-driven rules pulled between periods to vary pacing and strategy.
 * Classic script (file:// compatible, assigns to window.App.data.classRules).
 * @namespace App.data.classRules
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.data = App.data || {};

  App.data.classRules = [
    {
      id: 'cr-double',
      titleZh: '雙倍操行，雙倍速度',
      titleEn: 'Double score, faster pace',
      descZh: '本節得分 ×2，但門外身影移動速度提升至 1.6 倍。',
      descEn: 'Earn 2x points this period, while the figure moves at 1.6x speed.',
      effects: { scoreMult: 2, speedMult: 1.6 },
    },
    {
      id: 'cr-extra-slot',
      titleZh: '多一個補給欄位',
      titleEn: 'Extra supply slot',
      descZh: '本節補給上限由 2 格擴充為 3 格，並立即獲得 1 個補給。',
      descEn: 'Supply capacity increases from 2 to 3 slots, plus 1 immediate supply.',
      effects: { supplyCap: 3, grantSupply: true },
    },
    {
      id: 'cr-audio',
      titleZh: '只聽不看',
      titleEn: 'Listening period',
      descZh: '單字題改以發音出題（可重播），答對額外 +50 分。',
      descEn: 'Vocabulary rounds play audio prompts (replayable) with +50 bonus points.',
      effects: { audioOnlyVocab: true, bonusPoints: 50 },
      requiresTts: true,
    },
    {
      id: 'cr-calm',
      titleZh: '安靜自習',
      titleEn: 'Quiet study hall',
      descZh: '本節門外腳步放慢為 0.75 倍，適合穩紮穩打。',
      descEn: 'Approach speed drops to 0.75x this period for steady typing.',
      effects: { speedMult: 0.75 },
    },
    {
      id: 'cr-hard-rain',
      titleZh: '紅筆考卷',
      titleEn: 'Red-ink quiz',
      descZh: '每 4 題就出現一次紅框難題，更容易拿到補給道具。',
      descEn: 'Hard supply-crate words appear every 4 questions instead of 6.',
      effects: { hardEvery: 4 },
    },
    {
      id: 'cr-long-time',
      titleZh: '延長作答',
      titleEn: 'Extended timer',
      descZh: '本節每題作答時間延長至 11 秒。',
      descEn: 'Question timeout extends from 8 seconds to 11 seconds this period.',
      effects: { questionTimeoutMs: 11000 },
    },
    {
      id: 'cr-rot-immune',
      titleZh: '新換鍵盤',
      titleEn: 'Fresh keyboard',
      descZh: '本節打錯字母不會觸發腐蝕鍵鎖定。',
      descEn: 'Wrong keystrokes do not trigger key rot this period.',
      effects: { rotImmune: true },
    },
    {
      id: 'cr-combo-boost',
      titleZh: '模範生加分',
      titleEn: 'Honor roll streak',
      descZh: '連對 2 題起即觸發 1.5 倍連對加分。',
      descEn: 'Combo 1.5x multiplier activates starting from 2 consecutive hits.',
      effects: { comboThreshold: 2 },
    },
  ];
})();
