/**
 * Traditional Chinese (zh-TW) UI strings.
 * Loaded as a classic script; exposed as window.AS_I18N_ZH_TW.
 * Keys use dot-notation namespaces.  Params use {placeholder} syntax.
 */
(function () {
  window.AS_I18N_ZH_TW = {
    // ── Navigation ──────────────────────────────────────────────────────────
    'nav.dashboard':   '首頁',
    'nav.cards':       '單字卡',
    'nav.review':      '複習',
    'nav.decks':       '卡組',
    'nav.games':       '遊戲',
    'nav.stats':       '統計',
    'nav.stamps':      '集章冊',
    'nav.settings':    '設定',

    // ── App shell ───────────────────────────────────────────────────────────
    'app.name':           '放學後',
    'app.tagline':        '放學後，才是真正的英文課。',
    'app.offline':        '目前離線',
    'app.exit_game':      '離開遊戲',
    'app.exit_confirm':   '確定要離開遊戲？本局紀錄不會儲存。',
    'app.exit_yes':       '離開',
    'app.exit_no':        '繼續',

    // ── Buttons (outcome-named) ─────────────────────────────────────────────
    'btn.start':          '開始',
    'btn.close':          '關閉',
    'btn.cancel':         '取消',
    'btn.confirm':        '確認',
    'btn.retry':          '重試',
    'btn.save':           '儲存',
    'btn.undo':           '復原',
    'btn.delete':         '刪除',
    'btn.edit':           '編輯',
    'btn.add':            '新增',
    'btn.back':           '返回',
    'btn.next':           '下一步',
    'btn.finish':         '完成',
    'btn.skip':           '跳過',
    'btn.stop':           '停止',
    'btn.play':           '播放',

    // ── Error states ────────────────────────────────────────────────────────
    'error.generic':      '發生錯誤，請重試。',
    'error.load':         '載入失敗。',
    'error.save':         '儲存失敗，請重試。',
    'error.quota':        '儲存空間已滿，本次資料儲存在記憶體中（重新整理後將消失）。',
    'error.unknown_route':'找不到此頁面，已返回首頁。',

    // ── Empty states ────────────────────────────────────────────────────────
    'empty.cards':        '還沒有單字卡，新增第一張吧。',
    'empty.decks':        '還沒有卡組，建立第一個吧。',
    'empty.attempts':     '完成第一節課後，這裡會出現你的進度。',
    'empty.stamps':       '還沒有集章，完成一節課後會獲得第一枚！',
    'empty.stats':        '還沒有學習紀錄，開始複習後統計圖表會出現在這裡。',

    // ── Dashboard ───────────────────────────────────────────────────────────
    'dashboard.title':          '今日課表',
    'dashboard.streak':         '連續 {n} 天',
    'dashboard.streak_one':     '連續 1 天',
    'dashboard.hardest':        '本週難字',
    'dashboard.loop_step':      '學習循環',
    'dashboard.ai_advice':      'AI 建議',
    'dashboard.demo_banner':    '目前顯示示範資料',
    'dashboard.demo_clear':     '清除示範資料',

    // ── Today's timetable (今日課表) ────────────────────────────────────────
    'timetable.period':         '第 {n} 節',
    'timetable.card_review':    '單字複習',
    'timetable.class13':        '第 13 節課',
    'timetable.wall':           '今日之牆',
    'timetable.guess':          '你說我猜',
    'timetable.after_school':   '放學',
    'timetable.done':           '已完成',
    'timetable.skip':           '跳過',

    // ── Cards ───────────────────────────────────────────────────────────────
    'cards.title':              '單字卡',
    'cards.search':             '搜尋單字...',
    'cards.filter_all':         '全部',
    'cards.filter_due':         '待複習',
    'cards.add':                '新增單字卡',
    'cards.detail':             '卡片詳情',
    'cards.history':            '學習紀錄',
    'cards.flip_hint':          '點擊翻牌 · 左右滑動評分',
    'cards.know':               '記住了',
    'cards.unknown':            '還不熟',
    'cards.hide':               '隱藏這張卡',
    'cards.unhide':             '顯示這張卡',
    'cards.delete_confirm':     '確定刪除「{word}」？此操作無法復原。',
    'cards.undo_hide':          '已隱藏「{word}」。',
    'cards.undo_delete':        '已刪除「{word}」。',

    // ── Leitner / Review ────────────────────────────────────────────────────
    'review.title':             '今日複習',
    'review.due':               '{n} 張待複習',
    'review.done':              '今日複習完成！',
    'review.box':               '第 {n} 盒',
    'review.promoted':          '升到第 {n} 盒',
    'review.demoted':           '回到第 1 盒',

    // ── Decks ───────────────────────────────────────────────────────────────
    'decks.title':              '卡組',
    'decks.create':             '建立卡組',
    'decks.name_placeholder':   '卡組名稱',
    'decks.card_count':         '{n} 張單字卡',

    // ── Games hub ───────────────────────────────────────────────────────────
    'games.title':              '遊戲',
    'games.personal_best':      '個人最佳',
    'games.class13.name':       '第 13 節課',
    'games.class13.desc':       '打字生存遊戲：在怪物到來前輸入正確單字。',
    'games.guess.name':         '你說我猜',
    'games.guess.desc':         '用中文描述，讓 AI 猜出你指的英文單字。',
    'games.wall.name':          '四格分類牆',
    'games.wall.desc':          '找出四組各有關聯的英文單字，一牆不留。',

    // ── Skill tabs ─────────────────────────────────────────────────────────
    'skill.vocab':              '單字',
    'skill.grammar':            '文法',
    'skill.dialogue':           '對話',

    // ── AI panel ───────────────────────────────────────────────────────────
    'ai.disclaimer':            'AI 可能出錯，請以卡片內容為準。',
    'ai.source.nano':           'Gemini Nano',
    'ai.source.qwen':           'Qwen 2.5',
    'ai.source.template':       '離線範本',
    'ai.downloading':           '正在下載 AI 模型（{mb} MB）...',
    'ai.download_done':         'AI 模型已就緒。',
    'ai.download_error':        '模型下載中斷，已改用離線題庫。',

    // ── Settings ───────────────────────────────────────────────────────────
    'settings.title':           '設定',
    'settings.language':        '介面語言',
    'settings.theme':           '主題',
    'settings.theme.auto':      '跟隨系統',
    'settings.theme.light':     '下午（亮色）',
    'settings.theme.dark':      '夜晚（暗色）',
    'settings.daily_new':       '每日新單字數',
    'settings.periods':         '每日節數',
    'settings.auto_play':       '自動播放發音',
    'settings.speech_rate':     '語速',
    'settings.safe_mode':       '安心模式',
    'settings.safe_mode.desc':  '關閉第 13 節課的恐怖氣氛效果。',
    'settings.ai_engine':       'AI 引擎',
    'settings.ai_engine.auto':  '自動',
    'settings.ai_engine.nano':  'Gemini Nano',
    'settings.ai_engine.qwen':  'Qwen 2.5',
    'settings.ai_engine.tpl':   '離線範本',
    'settings.storage':         '儲存空間',
    'settings.export':          '匯出資料',
    'settings.import':          '匯入資料',
    'settings.reset':           '重置所有資料',
    'settings.reset.confirm':   '輸入「刪除」以確認重置所有資料。',
    'settings.reset.keyword':   '刪除',
    'settings.demo_load':       '載入示範資料',
    'settings.ai_diag':         'AI 診斷',

    // ── Statistics ─────────────────────────────────────────────────────────
    'stats.title':              '統計',
    'stats.filter.7d':          '7 天',
    'stats.filter.30d':         '30 天',
    'stats.filter.all':         '全部',
    'stats.show_table':         '以表格顯示',
    'stats.leitner':            'Leitner 分佈',
    'stats.accuracy':           '14 天正確率',
    'stats.calendar':           '學習日曆',
    'stats.by_skill':           '技能正確率',
    'stats.keymap':             '鍵盤熱圖',
    'stats.confusion':          '混淆字對',
    'stats.bests':              '個人最佳',

    // ── Stamps ─────────────────────────────────────────────────────────────
    'stamps.title':             '集章冊',
    'stamps.locked_hint':       '達成條件後解鎖。',

    // ── Misc ────────────────────────────────────────────────────────────────
    'misc.loading':             '載入中...',
    'misc.period_unit':         '節',
    'misc.day_unit':            '天',
    'misc.word_unit':           '個單字',
    'misc.accuracy_unit':       '正確率',
  };
})();
