/**
 * Curated verb-form grammar bank for 第 13 節課 (M8, Section 4.3.2 & 4.6).
 * 80 items covering irregular past, past participle, third-person -s, and -ing forms.
 * Classic script (file:// compatible, assigns to window.App.data.tense).
 * Documented in docs/CONTENT.md for owner review.
 * @namespace App.data.tense
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.data = App.data || {};

  App.data.tense = [
    // ── Irregular past tense (30 items) ────────────────────────────────────
    { id: 't-01', base: 'go', form: 'past', formZh: '過去式', accepted: ['went'], meaningZh: '去', ruleZh: 'go 的過去式是不規則的 went。' },
    { id: 't-02', base: 'eat', form: 'past', formZh: '過去式', accepted: ['ate'], meaningZh: '吃', ruleZh: 'eat 的過去式是不規則的 ate。' },
    { id: 't-03', base: 'see', form: 'past', formZh: '過去式', accepted: ['saw'], meaningZh: '看見', ruleZh: 'see 的過去式是不規則的 saw。' },
    { id: 't-04', base: 'take', form: 'past', formZh: '過去式', accepted: ['took'], meaningZh: '拿；搭乘', ruleZh: 'take 的過去式是不規則的 took。' },
    { id: 't-05', base: 'write', form: 'past', formZh: '過去式', accepted: ['wrote'], meaningZh: '寫', ruleZh: 'write 的過去式是不規則的 wrote。' },
    { id: 't-06', base: 'give', form: 'past', formZh: '過去式', accepted: ['gave'], meaningZh: '給', ruleZh: 'give 的過去式是不規則的 gave。' },
    { id: 't-07', base: 'come', form: 'past', formZh: '過去式', accepted: ['came'], meaningZh: '來', ruleZh: 'come 的過去式是不規則的 came。' },
    { id: 't-08', base: 'make', form: 'past', formZh: '過去式', accepted: ['made'], meaningZh: '製作', ruleZh: 'make 的過去式是不規則的 made。' },
    { id: 't-09', base: 'buy', form: 'past', formZh: '過去式', accepted: ['bought'], meaningZh: '買', ruleZh: 'buy 的過去式是 bought。' },
    { id: 't-10', base: 'bring', form: 'past', formZh: '過去式', accepted: ['brought'], meaningZh: '帶來', ruleZh: 'bring 的過去式是 brought。' },
    { id: 't-11', base: 'think', form: 'past', formZh: '過去式', accepted: ['thought'], meaningZh: '想；認為', ruleZh: 'think 的過去式是 thought。' },
    { id: 't-12', base: 'teach', form: 'past', formZh: '過去式', accepted: ['taught'], meaningZh: '教導', ruleZh: 'teach 的過去式是 taught。' },
    { id: 't-13', base: 'catch', form: 'past', formZh: '過去式', accepted: ['caught'], meaningZh: '抓住；趕上', ruleZh: 'catch 的過去式是 caught。' },
    { id: 't-14', base: 'find', form: 'past', formZh: '過去式', accepted: ['found'], meaningZh: '找到', ruleZh: 'find 的過去式是 found。' },
    { id: 't-15', base: 'know', form: 'past', formZh: '過去式', accepted: ['knew'], meaningZh: '知道', ruleZh: 'know 的過去式是 knew。' },
    { id: 't-16', base: 'tell', form: 'past', formZh: '過去式', accepted: ['told'], meaningZh: '告訴', ruleZh: 'tell 的過去式是 told。' },
    { id: 't-17', base: 'say', form: 'past', formZh: '過去式', accepted: ['said'], meaningZh: '說', ruleZh: 'say 的過去式是 said。' },
    { id: 't-18', base: 'keep', form: 'past', formZh: '過去式', accepted: ['kept'], meaningZh: '保持', ruleZh: 'keep 的過去式是 kept。' },
    { id: 't-19', base: 'leave', form: 'past', formZh: '過去式', accepted: ['left'], meaningZh: '離開', ruleZh: 'leave 的過去式是 left。' },
    { id: 't-20', base: 'feel', form: 'past', formZh: '過去式', accepted: ['felt'], meaningZh: '感覺', ruleZh: 'feel 的過去式是 felt。' },
    { id: 't-21', base: 'meet', form: 'past', formZh: '過去式', accepted: ['met'], meaningZh: '遇見', ruleZh: 'meet 的過去式是 met。' },
    { id: 't-22', base: 'run', form: 'past', formZh: '過去式', accepted: ['ran'], meaningZh: '跑', ruleZh: 'run 的過去式是 ran。' },
    { id: 't-23', base: 'begin', form: 'past', formZh: '過去式', accepted: ['began'], meaningZh: '開始', ruleZh: 'begin 的過去式是 began。' },
    { id: 't-24', base: 'drink', form: 'past', formZh: '過去式', accepted: ['drank'], meaningZh: '喝', ruleZh: 'drink 的過去式是 drank。' },
    { id: 't-25', base: 'sing', form: 'past', formZh: '過去式', accepted: ['sang'], meaningZh: '唱歌', ruleZh: 'sing 的過去式是 sang。' },
    { id: 't-26', base: 'swim', form: 'past', formZh: '過去式', accepted: ['swam'], meaningZh: '游泳', ruleZh: 'swim 的過去式是 swam。' },
    { id: 't-27', base: 'break', form: 'past', formZh: '過去式', accepted: ['broke'], meaningZh: '打破', ruleZh: 'break 的過去式是 broke。' },
    { id: 't-28', base: 'speak', form: 'past', formZh: '過去式', accepted: ['spoke'], meaningZh: '說（語言）', ruleZh: 'speak 的過去式是 spoke。' },
    { id: 't-29', base: 'drive', form: 'past', formZh: '過去式', accepted: ['drove'], meaningZh: '開車', ruleZh: 'drive 的過去式是 drove。' },
    { id: 't-30', base: 'ride', form: 'past', formZh: '過去式', accepted: ['rode'], meaningZh: '騎', ruleZh: 'ride 的過去式是 rode。' },

    // ── Past participle (20 items) ─────────────────────────────────────────
    { id: 't-31', base: 'go', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['gone'], meaningZh: '去', ruleZh: 'go 的過去分詞是 gone（go / went / gone）。' },
    { id: 't-32', base: 'eat', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['eaten'], meaningZh: '吃', ruleZh: 'eat 的過去分詞是 eaten（eat / ate / eaten）。' },
    { id: 't-33', base: 'see', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['seen'], meaningZh: '看見', ruleZh: 'see 的過去分詞是 seen（see / saw / seen）。' },
    { id: 't-34', base: 'take', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['taken'], meaningZh: '拿', ruleZh: 'take 的過去分詞是 taken（take / took / taken）。' },
    { id: 't-35', base: 'write', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['written'], meaningZh: '寫', ruleZh: 'write 的過去分詞是 written（雙寫 t）。' },
    { id: 't-36', base: 'give', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['given'], meaningZh: '給', ruleZh: 'give 的過去分詞是 given。' },
    { id: 't-37', base: 'know', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['known'], meaningZh: '知道', ruleZh: 'know 的過去分詞是 known。' },
    { id: 't-38', base: 'break', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['broken'], meaningZh: '打破', ruleZh: 'break 的過去分詞是 broken。' },
    { id: 't-39', base: 'choose', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['chosen'], meaningZh: '選擇', ruleZh: 'choose 的過去分詞是 chosen。' },
    { id: 't-40', base: 'speak', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['spoken'], meaningZh: '說', ruleZh: 'speak 的過去分詞是 spoken。' },
    { id: 't-41', base: 'drive', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['driven'], meaningZh: '開車', ruleZh: 'drive 的過去分詞是 driven。' },
    { id: 't-42', base: 'ride', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['ridden'], meaningZh: '騎', ruleZh: 'ride 的過去分詞是 ridden（雙寫 d）。' },
    { id: 't-43', base: 'drink', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['drunk'], meaningZh: '喝', ruleZh: 'drink 的過去分詞是 drunk（drink / drank / drunk）。' },
    { id: 't-44', base: 'sing', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['sung'], meaningZh: '唱歌', ruleZh: 'sing 的過去分詞是 sung（sing / sang / sung）。' },
    { id: 't-45', base: 'swim', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['swum'], meaningZh: '游泳', ruleZh: 'swim 的過去分詞是 swum（swim / swam / swum）。' },
    { id: 't-46', base: 'begin', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['begun'], meaningZh: '開始', ruleZh: 'begin 的過去分詞是 begun（begin / began / begun）。' },
    { id: 't-47', base: 'fly', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['flown'], meaningZh: '飛', ruleZh: 'fly 的過去分詞是 flown（fly / flew / flown）。' },
    { id: 't-48', base: 'grow', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['grown'], meaningZh: '成長', ruleZh: 'grow 的過去分詞是 grown（grow / grew / grown）。' },
    { id: 't-49', base: 'show', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['shown'], meaningZh: '展示', ruleZh: 'show 的過去分詞是 shown。' },
    { id: 't-50', base: 'do', form: 'pp', formZh: '過去分詞 (p.p.)', accepted: ['done'], meaningZh: '做', ruleZh: 'do 的過去分詞是 done（do / did / done）。' },

    // ── Third-person singular -s / -es / -ies (15 items) ───────────────────
    { id: 't-51', base: 'study', form: '3sg', formZh: '第三人稱單數', accepted: ['studies'], meaningZh: '讀書；研究', ruleZh: '子音 + y 結尾去 y 加 ies：studies。' },
    { id: 't-52', base: 'carry', form: '3sg', formZh: '第三人稱單數', accepted: ['carries'], meaningZh: '搬運', ruleZh: '子音 + y 結尾去 y 加 ies：carries。' },
    { id: 't-53', base: 'try', form: '3sg', formZh: '第三人稱單數', accepted: ['tries'], meaningZh: '嘗試', ruleZh: '子音 + y 結尾去 y 加 ies：tries。' },
    { id: 't-54', base: 'fly', form: '3sg', formZh: '第三人稱單數', accepted: ['flies'], meaningZh: '飛', ruleZh: '子音 + y 結尾去 y 加 ies：flies。' },
    { id: 't-55', base: 'worry', form: '3sg', formZh: '第三人稱單數', accepted: ['worries'], meaningZh: '擔心', ruleZh: '子音 + y 結尾去 y 加 ies：worries。' },
    { id: 't-56', base: 'watch', form: '3sg', formZh: '第三人稱單數', accepted: ['watches'], meaningZh: '觀看', ruleZh: 'ch 結尾加 es：watches。' },
    { id: 't-57', base: 'wash', form: '3sg', formZh: '第三人稱單數', accepted: ['washes'], meaningZh: '洗', ruleZh: 'sh 結尾加 es：washes。' },
    { id: 't-58', base: 'teach', form: '3sg', formZh: '第三人稱單數', accepted: ['teaches'], meaningZh: '教', ruleZh: 'ch 結尾加 es：teaches。' },
    { id: 't-59', base: 'finish', form: '3sg', formZh: '第三人稱單數', accepted: ['finishes'], meaningZh: '完成', ruleZh: 'sh 結尾加 es：finishes。' },
    { id: 't-60', base: 'miss', form: '3sg', formZh: '第三人稱單數', accepted: ['misses'], meaningZh: '想念；錯過', ruleZh: 's 結尾加 es：misses。' },
    { id: 't-61', base: 'fix', form: '3sg', formZh: '第三人稱單數', accepted: ['fixes'], meaningZh: '修理', ruleZh: 'x 結尾加 es：fixes。' },
    { id: 't-62', base: 'go', form: '3sg', formZh: '第三人稱單數', accepted: ['goes'], meaningZh: '去', ruleZh: 'go 加 es：goes。' },
    { id: 't-63', base: 'do', form: '3sg', formZh: '第三人稱單數', accepted: ['does'], meaningZh: '做', ruleZh: 'do 加 es：does。' },
    { id: 't-64', base: 'have', form: '3sg', formZh: '第三人稱單數', accepted: ['has'], meaningZh: '有', ruleZh: 'have 的第三人稱單數是不規則的 has。' },
    { id: 't-65', base: 'play', form: '3sg', formZh: '第三人稱單數', accepted: ['plays'], meaningZh: '玩', ruleZh: '母音 + y 結尾直接加 s：plays。' },

    // ── Present participle / -ing forms (15 items) ─────────────────────────
    { id: 't-66', base: 'make', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['making'], meaningZh: '製作', ruleZh: '不發音 e 結尾去 e 加 ing：making。' },
    { id: 't-67', base: 'write', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['writing'], meaningZh: '寫', ruleZh: '去 e 加 ing：writing（單寫 t）。' },
    { id: 't-68', base: 'come', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['coming'], meaningZh: '來', ruleZh: '去 e 加 ing：coming。' },
    { id: 't-69', base: 'take', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['taking'], meaningZh: '拿', ruleZh: '去 e 加 ing：taking。' },
    { id: 't-70', base: 'have', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['having'], meaningZh: '有', ruleZh: '去 e 加 ing：having。' },
    { id: 't-71', base: 'run', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['running'], meaningZh: '跑', ruleZh: '短母音 + 單子音，重複字尾加 ing：running。' },
    { id: 't-72', base: 'swim', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['swimming'], meaningZh: '游泳', ruleZh: '短母音 + 單子音，重複字尾加 ing：swimming。' },
    { id: 't-73', base: 'sit', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['sitting'], meaningZh: '坐', ruleZh: '重複字尾 t 加 ing：sitting。' },
    { id: 't-74', base: 'stop', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['stopping'], meaningZh: '停止', ruleZh: '重複字尾 p 加 ing：stopping。' },
    { id: 't-75', base: 'plan', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['planning'], meaningZh: '計畫', ruleZh: '重複字尾 n 加 ing：planning。' },
    { id: 't-76', base: 'begin', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['beginning'], meaningZh: '開始', ruleZh: '重音在最後音節，重複 n 加 ing：beginning。' },
    { id: 't-77', base: 'lie', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['lying'], meaningZh: '躺；說謊', ruleZh: 'ie 結尾改 y 加 ing：lying。' },
    { id: 't-78', base: 'die', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['dying'], meaningZh: '死亡', ruleZh: 'ie 結尾改 y 加 ing：dying。' },
    { id: 't-79', base: 'study', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['studying'], meaningZh: '讀書', ruleZh: 'y 結尾直接加 ing（不去 y）：studying。' },
    { id: 't-80', base: 'shop', form: 'ing', formZh: '現在分詞 (-ing)', accepted: ['shopping'], meaningZh: '購物', ruleZh: '重複字尾 p 加 ing：shopping。' },
  ];
})();
