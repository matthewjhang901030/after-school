/**
 * Curated broadcast dialogue cloze bank for 第 13 節課 (M8/M10, Section 4.3.2 & 4.6).
 * 40 natural everyday dialogue items at Taiwanese university 2000-word level.
 * Classic script (file:// compatible, assigns to window.App.data.broadcast).
 * Documented in docs/CONTENT.md for owner review.
 * @namespace App.data.broadcast
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.data = App.data || {};

  App.data.broadcast = [
    { id: 'b-01', lineA: 'Where were you last night?', lineB: 'I ___ at home studying.', accepted: ['was'], grammarTag: 'past_be', ruleZh: '過去時間 last night 搭配主詞 I 用 was。' },
    { id: 'b-02', lineA: 'Did you finish the report?', lineB: 'No, I ___ finish it yet.', accepted: ["didn't", 'did not'], grammarTag: 'past_neg', ruleZh: '過去式否定用 didn\'t / did not + 原形動詞。' },
    { id: 'b-03', lineA: 'What is Mia doing now?', lineB: 'She is ___ a letter to her aunt.', accepted: ['writing'], grammarTag: 'pres_prog', ruleZh: '現在進行式 be + V-ing：writing（去 e 加 ing）。' },
    { id: 'b-04', lineA: 'How do you go to campus?', lineB: 'I usually ___ the bus.', accepted: ['take'], grammarTag: 'collocation', ruleZh: '搭乘公車固定用 take the bus。' },
    { id: 'b-05', lineA: 'Have you ever been to Tainan?', lineB: 'Yes, I ___ there twice.', accepted: ['have been', 'went'], grammarTag: 'pres_perf', ruleZh: '表達經驗用 have been 或過去式 went。' },
    { id: 'b-06', lineA: 'Why is the floor wet?', lineB: 'Someone ___ a cup of water.', accepted: ['dropped', 'spilled'], grammarTag: 'past_simple', ruleZh: '描述剛發生的過去動作使用過去式 dropped / spilled。' },
    { id: 'b-07', lineA: 'Are you free this Friday?', lineB: 'Sorry, I ___ to work late.', accepted: ['have'], grammarTag: 'modal_have_to', ruleZh: '必須做某事用 have to + 原形動詞。' },
    { id: 'b-08', lineA: 'Whose umbrella is this?', lineB: 'It belongs ___ Ken.', accepted: ['to'], grammarTag: 'preposition', ruleZh: '屬於某人固定搭配 belong to。' },
    { id: 'b-09', lineA: 'Can you speak Japanese?', lineB: 'Yes, I ___ speak a little.', accepted: ['can'], grammarTag: 'modal', ruleZh: '回應 Can you...? 用肯定助動詞 can。' },
    { id: 'b-10', lineA: 'Where did Leo go?', lineB: 'He ___ to the library.', accepted: ['went'], grammarTag: 'past_irreg', ruleZh: '問句用 did，答句用 go 的過去式 went。' },
    { id: 'b-11', lineA: 'Thank you for helping me.', lineB: 'You are ___.', accepted: ['welcome'], grammarTag: 'dialogue', ruleZh: '回應道謝常用 You are welcome。' },
    { id: 'b-12', lineA: 'What time does class start?', lineB: 'It ___ at nine sharp.', accepted: ['starts', 'begins'], grammarTag: 'pres_3sg', ruleZh: '主詞 It 為第三人稱單數，動詞加 s（starts）。' },
    { id: 'b-13', lineA: 'Is there any milk left?', lineB: 'No, there ___ any left.', accepted: ["isn't", 'is not'], grammarTag: 'there_be', ruleZh: '不可數名詞 milk 否定用 isn\'t / is not。' },
    { id: 'b-14', lineA: 'How many books did you borrow?', lineB: 'I ___ three books today.', accepted: ['borrowed'], grammarTag: 'past_reg', ruleZh: '問句用 did，答句使用過去式 borrowed。' },
    { id: 'b-15', lineA: 'Do you want tea or coffee?', lineB: 'I ___ like hot tea, please.', accepted: ['would'], grammarTag: 'polite_req', ruleZh: '禮貌點餐用 I would like...。' },
    { id: 'b-16', lineA: 'Why did you bring a coat?', lineB: 'Because it is ___ outside.', accepted: ['cold', 'freezing'], grammarTag: 'adj_weather', ruleZh: '穿外套的原因通常是天氣冷（cold）。' },
    { id: 'b-17', lineA: 'Where were they at noon?', lineB: 'They ___ eating lunch together.', accepted: ['were'], grammarTag: 'past_prog', ruleZh: '主詞 They 的過去進行式用 were。' },
    { id: 'b-18', lineA: 'Did Emma call you back?', lineB: 'Yes, she ___ me an hour ago.', accepted: ['called'], grammarTag: 'past_reg', ruleZh: 'an hour ago 表示過去時間，用過去式 called。' },
    { id: 'b-19', lineA: 'What will you do tomorrow?', lineB: 'I ___ visit my grandparents.', accepted: ['will'], grammarTag: 'future_will', ruleZh: '未來時間 tomorrow 搭配助動詞 will。' },
    { id: 'b-20', lineA: 'Excuse me, how much is this pen?', lineB: 'It ___ fifty dollars.', accepted: ['costs', 'is'], grammarTag: 'pres_3sg', ruleZh: '物品花費多少錢用 It costs... 或 It is...。' },
    { id: 'b-21', lineA: 'Why is Sam smiling so much?', lineB: 'He ___ the math exam.', accepted: ['passed'], grammarTag: 'past_reg', ruleZh: '通過考試用 pass 的過去式 passed。' },
    { id: 'b-22', lineA: 'Could you open the window?', lineB: 'Sure, no ___.', accepted: ['problem'], grammarTag: 'dialogue', ruleZh: '答應請求的口語回應：no problem。' },
    { id: 'b-23', lineA: 'How long have you lived here?', lineB: 'I have lived here ___ five years.', accepted: ['for'], grammarTag: 'prep_time', ruleZh: '一段時間（five years）前面用介系詞 for。' },
    { id: 'b-24', lineA: 'When is your birthday?', lineB: 'It is ___ October.', accepted: ['in'], grammarTag: 'prep_month', ruleZh: '月份前面用介系詞 in。' },
    { id: 'b-25', lineA: 'When does the store open?', lineB: 'It opens ___ Monday morning.', accepted: ['on'], grammarTag: 'prep_day', ruleZh: '特定某天（Monday morning）用介系詞 on。' },
    { id: 'b-26', lineA: 'Is your sister taller than you?', lineB: 'Yes, she is taller ___ me.', accepted: ['than'], grammarTag: 'comparative', ruleZh: '比較級後面搭配連接詞 than。' },
    { id: 'b-27', lineA: 'What is the ___ river in Taiwan?', lineB: 'The Zhuoshui River is the longest.', accepted: ['longest'], grammarTag: 'superlative', ruleZh: 'the 後面接最高級 longest。' },
    { id: 'b-28', lineA: 'Did you remember to lock the door?', lineB: 'Oh no, I ___ to lock it.', accepted: ['forgot'], grammarTag: 'past_irreg', ruleZh: 'forget 的過去式是 forgot。' },
    { id: 'b-29', lineA: 'Who broke this glass?', lineB: 'The cat ___ it off the table.', accepted: ['knocked', 'pushed'], grammarTag: 'past_reg', ruleZh: '描述已發生的意外用過去式 knocked / pushed。' },
    { id: 'b-30', lineA: 'Would you mind turning down the music?', lineB: 'Not at ___.', accepted: ['all'], grammarTag: 'dialogue', ruleZh: '回應 Would you mind...? 表示不介意用 Not at all。' },
    { id: 'b-31', lineA: 'What did you have for breakfast?', lineB: 'I ___ a sandwich and milk.', accepted: ['had', 'ate'], grammarTag: 'past_irreg', ruleZh: 'eat/have 的過去式是 ate / had。' },
    { id: 'b-32', lineA: 'Where is my notebook?', lineB: 'Look, it is ___ the desk.', accepted: ['on'], grammarTag: 'prep_place', ruleZh: '在書桌表面上用介系詞 on。' },
    { id: 'b-33', lineA: 'Are you ready to order?', lineB: 'Yes, I will ___ the beef noodles.', accepted: ['have', 'take', 'order'], grammarTag: 'dialogue', ruleZh: '點餐常用 I will have / order...。' },
    { id: 'b-34', lineA: 'Why are you late today?', lineB: 'I ___ the early train.', accepted: ['missed'], grammarTag: 'past_reg', ruleZh: '錯過火車用 miss 的過去式 missed。' },
    { id: 'b-35', lineA: 'Do you know where Ben lives?', lineB: 'He ___ near the night market.', accepted: ['lives'], grammarTag: 'pres_3sg', ruleZh: '主詞 He 搭配第三人稱單數 lives。' },
    { id: 'b-36', lineA: 'Can I borrow your eraser?', lineB: 'Here you ___.', accepted: ['are'], grammarTag: 'dialogue', ruleZh: '遞給別人東西時說 Here you are。' },
    { id: 'b-37', lineA: 'How was the movie last weekend?', lineB: 'It ___ really exciting.', accepted: ['was'], grammarTag: 'past_be', ruleZh: '主詞 It 搭配過去時間用 was。' },
    { id: 'b-38', lineA: 'You look tired today.', lineB: 'I did not ___ well last night.', accepted: ['sleep'], grammarTag: 'aux_base', ruleZh: '助動詞 did not 後面接原形動詞 sleep。' },
    { id: 'b-39', lineA: 'Where can I buy fresh fruit?', lineB: 'You can buy some ___ the market.', accepted: ['at', 'in'], grammarTag: 'prep_place', ruleZh: '在市場用介系詞 at / in the market。' },
    { id: 'b-40', lineA: 'See you tomorrow morning.', lineB: 'Take ___, see you then.', accepted: ['care'], grammarTag: 'dialogue', ruleZh: '道別常用短語 Take care。' },
  ];
})();
