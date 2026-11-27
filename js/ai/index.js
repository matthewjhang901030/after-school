/**
 * Browser-side AI Coordinator — Three-tier detection, few-shot chat prompts,
 * lenient plain-text & JSON parsing, Simplified->Traditional conversion,
 * fact-consistency safety checks, 20-second TTFT timeout, and Feature A (錯題解說).
 *
 * Core principle (Section 5.1):
 *   Code supplies all FACTS; AI only phrases them in friendly language.
 *   Code validates every response and falls back cleanly to offline templates.
 * @namespace App.ai
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.ai = App.ai || {};

  const FIRST_TOKEN_TIMEOUT_MS = 20000;
  const FEATURE_A_MAX_TOKENS = 80;
  const LAST_ATTEMPT_KEY = 'as.v1.ai.lastAttempt';

  let _cachedStatus = null;
  let _lastAttempt = null;

  const FEATURE_A_SCHEMA = {
    type: 'object',
    properties: {
      why: { type: 'string' },
      tip: { type: 'string' },
      example: { type: ['string', 'null'] },
    },
    required: ['why', 'tip'],
    additionalProperties: false,
  };

  /**
   * Unambiguous Simplified -> Traditional Chinese character map for
   * English-learning explanations (avoids context-ambiguous chars like 只/面/干).
   */
  const S2T_PAIRS = [
    '这這', '个個', '词詞', '语語', '记記', '忆憶', '错錯', '误誤', '单單', '组組',
    '类類', '属屬', '于於', '写寫', '动動', '时時', '态態', '过過', '复複', '习習',
    '题題', '说說', '话話', '对對', '帮幫', '应應', '该該', '没沒', '关關', '系係',
    '区區', '别別', '联聯', '发發', '选選', '项項', '规規', '则則', '现現', '实實',
    '际際', '见見', '简簡', '连連', '数數', '体體', '验驗', '练練', '学學', '师師',
    '书書', '笔筆', '铅鉛', '图圖', '馆館', '电電', '邮郵', '给給', '让讓', '从從',
    '为為', '与與', '虽雖', '当當', '里裡', '们們', '来來', '进進', '还還', '经經',
    '会會', '长長', '开開', '听聽', '读讀', '问問', '买買', '卖賣', '带帶', '换換',
    '试試', '点點', '击擊', '显顯', '隐隱', '删刪', '义義', '释釋', '举舉', '头頭',
    '无無', '仅僅', '并並', '确確', '认認', '识識', '标標', '准準', '构構', '结結',
    '断斷', '较較', '级級', '极極', '总總', '种種', '样樣', '条條', '处處', '备備',
    '齐齊', '异異', '乱亂', '难難', '专專', '业業', '职職', '场場', '务務', '顾顧',
    '宾賓', '铁鐵', '车車', '机機', '飞飛', '桥橋', '岛島', '风風', '云雲', '雾霧',
    '气氣', '温溫', '热熱', '凉涼', '湿濕', '脏髒', '净淨', '轻輕', '贵貴', '钱錢',
    '币幣', '账帳', '费費', '罚罰', '礼禮', '谢謝', '请請', '欢歡', '离離', '约約',
    '计計', '划劃', '间間', '钟鐘', '历曆', '岁歲', '节節', '剧劇', '诗詩', '艺藝',
    '乐樂', '画畫', '园園', '厅廳', '厨廚', '卧臥', '卫衛', '阶階', '门門', '墙牆',
    '顶頂', '盘盤', '汤湯', '饭飯', '鱼魚', '鸡雞', '盐鹽', '苹蘋', '咸鹹', '脸臉',
    '脚腳', '颈頸', '肤膚', '烧燒', '药藥', '医醫', '护護', '农農', '红紅', '蓝藍',
    '绿綠', '黄黃', '东東', '后後', '内內', '边邊', '远遠', '强強', '满滿', '坏壞',
    '优優', '胜勝', '负負', '赢贏', '输輸', '败敗', '爱愛', '惊驚', '叹嘆', '拣揀',
    '减減', '诱誘', '导導', '启啟', '页頁', '册冊', '补補', '测測', '评評', '绩績',
    '奖獎', '励勵', '赞讚', '赏賞', '报報', '诉訴', '讲講', '谈談', '论論', '辩辯',
    '许許', '诺諾', '绝絕', '辞辭', '谅諒', '贺賀', '愿願', '驻駐', '继繼', '续續',
    '终終', '毕畢', '旧舊', '恒恆', '暂暫', '临臨', '尔爾', '屡屢', '频頻', '谁誰',
    '么麼', '几幾', '蛮蠻', '颇頗', '刚剛', '却卻', '设設', '纵縱', '须須', '冲衝',
    '顺順', '据據', '凭憑', '随隨', '达達', '绕繞', '围圍', '责責', '担擔', '参參',
    '归歸', '骑騎', '驾駕', '驶駛', '脱脫', '饮飲', '运運', '递遞', '领領', '赚賺',
    '储儲', '积積', '择擇', '决決', '变變', '调調', '制製', '产產', '创創', '寻尋',
    '检檢', '证證', '绍紹', '传傳', '沟溝', '适適', '质質', '响響', '征徵', '势勢',
    '战戰', '险險', '稳穩', '协協', '统統', '独獨', '伦倫', '观觀', '逻邏', '辑輯',
    '骤驟', '环環', '细細', '范範', '领領', '织織', '团團', '队隊', '伙夥', '员員',
    '户戶', '众眾', '游遊', '戏戲', '竞競', '赛賽', '录錄', '签籤', '归歸', '汇匯',
    '线線', '状狀', '饼餅', '广廣', '办辦', '议議', '银銀', '码碼', '术術', '网網',
    '链鏈', '浏瀏', '览覽', '软軟', '设設', '键鍵', '麦麥', '摄攝', '号號', '注註',
    '权權', '缓緩', '载載', '诊診', '弹彈', '钮鈕', '栏欄', '侧側', '块塊', '颜顏',
    '圆圓', '阴陰', '迟遲', '占佔', '输輸', '锁鎖', '毁毀', '两兩', '严嚴', '丽麗',
    '争爭', '亏虧', '亚亞', '亲親', '亿億', '仪儀', '价價', '伟偉', '伤傷', '伪偽',
    '俩倆', '俭儉', '债債', '倾傾', '偿償', '儿兒', '兑兌', '党黨', '兰蘭', '兴興',
    '养養', '兽獸', '军軍', '况況', '冻凍', '凄淒', '凑湊', '凤鳳', '凯凱', '刘劉',
    '剑劍', '劝勸', '劲勁', '劳勞', '华華', '双雙', '叙敘', '叠疊', '叶葉', '吗嗎',
    '吨噸', '吴吳', '哑啞', '唤喚', '嘱囑', '圣聖', '坚堅', '执執', '扩擴', '扫掃',
    '扬揚', '扰擾', '抛拋', '抢搶', '拟擬', '拥擁', '挂掛', '挤擠', '挥揮', '损損',
    '掷擲', '摆擺', '携攜', '搅攪', '敌敵', '晓曉', '杀殺', '杂雜', '树樹', '档檔',
    '梦夢', '楼樓', '欧歐', '残殘', '汉漢', '沟溝', '洁潔', '浅淺', '浇澆', '浊濁',
    '济濟', '浑渾', '浓濃', '涌湧', '涛濤', '润潤', '涨漲', '渐漸', '渔漁', '湾灣',
    '滚滾', '滤濾', '滨濱', '滩灘', '滞滯', '潜潛', '灭滅', '灯燈', '灵靈', '灾災',
    '灿燦', '炉爐', '炼煉', '烂爛', '爷爺', '牵牽', '牺犧', '犹猶', '狭狹', '狮獅',
    '狱獄', '猎獵', '猪豬', '猫貓', '献獻', '琐瑣', '畅暢', '疗療', '疯瘋', '皱皺',
    '盖蓋', '盗盜', '监監', '着著', '睁睜', '瞧瞧', '矿礦', '砖磚', '础礎', '硕碩',
    '祸禍', '称稱', '税稅', '稿稿', '谷穀', '穷窮', '窃竊', '窥窺', '笋筍', '笼籠',
    '筑築', '筛篩', '筹籌', '粮糧', '紧緊', '纠糾', '纤纖', '纪紀', '纯純', '纲綱',
    '纷紛', '纸紙', '纹紋', '纺紡', '纽紐', '绅紳', '绊絆', '绑綁', '绘繪', '络絡',
    '绪緒', '维維', '绵綿', '综綜', '缀綴', '编編', '缘緣', '缝縫', '缩縮', '缴繳',
    '罗羅', '罢罷', '聪聰', '肃肅', '肠腸', '胶膠', '脉脈', '脑腦', '腊臘', '腾騰',
    '舰艦', '舱艙', '艳豔', '苍蒼', '苏蘇', '荣榮', '获獲', '营營', '萧蕭', '葱蔥',
    '蒜蒜', '虑慮', '虚虛', '虫蟲', '虾蝦', '蚁蟻', '蜡蠟', '装裝', '裤褲', '视視',
    '觉覺', '触觸', '订訂', '讨討', '训訓', '讯訊', '访訪', '译譯', '诚誠', '诞誕',
    '询詢', '详詳', '诸諸', '课課', '谊誼', '谋謀', '谓謂', '谜謎', '谨謹', '谱譜',
    '贝貝', '贞貞', '贡貢', '财財', '贤賢', '货貨', '贩販', '贪貪', '贫貧', '购購',
    '贯貫', '贱賤', '贴貼', '贷貸', '贸貿', '贼賊', '资資', '赋賦', '赌賭', '赐賜',
    '赔賠', '赖賴', '赠贈', '赴赴', '赵趙', '赶趕', '趋趨', '跃躍', '迹跡', '轨軌',
    '转轉', '轮輪', '轰轟', '轿轎', '辅輔', '辆輛', '辈輩', '辉輝', '辞辭', '辟闢',
    '辽遼', '迁遷', '迈邁', '违違', '迹跡', '逊遜', '遗遺', '遥遙', '邻鄰', '郁鬱',
    '郑鄭', '酝醞', '酿釀', '采採', '针針', '钓釣', '钢鋼', '钻鑽', '铃鈴', '铜銅',
    '铸鑄', '铺鋪', '销銷', '锅鍋', '锋鋒', '锡錫', '锦錦', '镇鎮', '镜鏡', '闪閃',
    '闭閉', '闯闖', '闲閒', '闷悶', '闹鬧', '闻聞', '阀閥', '阁閣', '阅閱', '阔闊',
    '阳陽', '阵陣', '陆陸', '陈陳', '险險', '随隨', '静靜', '韵韻', '顽頑', '顿頓',
    '颁頒', '颂頌', '预預', '颇頗', '颗顆', '额額', '颠顛', '飘飄', '饥饑', '饰飾',
    '饱飽', '饲飼', '饿餓', '马馬', '驱驅', '驳駁', '驼駝', '骗騙', '骚騷', '鲁魯',
    '鲜鮮', '鲸鯨', '鸟鳥', '鸣鳴', '鸭鴨', '鸿鴻', '鹅鵝', '鹤鶴', '鹰鷹', '齿齒',
    '龄齡', '龙龍', '龟龜',
  ];

  const S2T_MAP = new Map();
  for (const pair of S2T_PAIRS) {
    if (pair.length === 2 && pair[0] !== pair[1]) {
      S2T_MAP.set(pair[0], pair[1]);
    }
  }

  /**
   * Convert common Simplified Chinese characters to Traditional Chinese (zh-Hant).
   * @param {string} text
   * @returns {string}
   */
  function s2t(text) {
    if (typeof text !== 'string' || !text) return '';
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      out += S2T_MAP.get(ch) || ch;
    }
    return out;
  }

  function _saveLastAttempt(record) {
    _lastAttempt = Object.assign({}, record);
    if (App.store && App.store.db) {
      App.store.db.set(LAST_ATTEMPT_KEY, _lastAttempt);
    }
  }

  /**
   * Return the most recent AI attempt record (including raw model output and rejection reason).
   * @returns {Object|null}
   */
  function getLastAttempt() {
    if (_lastAttempt) return Object.assign({}, _lastAttempt);
    if (App.store && App.store.db) {
      const saved = App.store.db.get(LAST_ATTEMPT_KEY, null);
      if (saved && typeof saved === 'object') {
        _lastAttempt = saved;
        return Object.assign({}, saved);
      }
    }
    return null;
  }

  /**
   * Detect available AI tiers (non-blocking, cached unless force === true).
   * @param {boolean} [force=false]
   * @returns {Promise<Object>}
   */
  async function detect(force) {
    if (_cachedStatus && !force) return Object.assign({}, _cachedStatus);

    const preferred = App.store && App.store.settings
      ? App.store.settings.get('aiEngine') || 'auto'
      : 'auto';

    const nanoInfo = App.ai.nano
      ? await App.ai.nano.detect()
      : { available: false, ready: false, availability: 'unavailable', translatorAvailability: 'unavailable' };

    const qwenSupported = App.ai.qwen ? App.ai.qwen.isSupported() : false;
    const qwenCache = App.ai.qwen ? await App.ai.qwen.inspectCache() : { cached: false, files: 0, bytes: 0 };
    const webgpu = typeof navigator !== 'undefined' && Boolean(navigator.gpu);

    let activeTier = 'template';
    if (preferred === 'templates') {
      activeTier = 'template';
    } else if (preferred === 'nano') {
      activeTier = nanoInfo.available ? 'nano' : 'template';
    } else if (preferred === 'qwen') {
      activeTier = qwenSupported ? 'qwen' : 'template';
    } else {
      const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
      if (nanoInfo.ready) {
        activeTier = 'nano';
      } else if (qwenSupported && (qwenCache.cached || online)) {
        activeTier = 'qwen';
      } else {
        activeTier = 'template';
      }
    }

    const qwenMetrics = App.ai.qwen ? App.ai.qwen.getMetrics() : {};

    _cachedStatus = {
      preferred,
      activeTier,
      webgpu,
      nano: nanoInfo,
      qwen: {
        supported: qwenSupported,
        cached: qwenCache.cached,
        cachedFiles: qwenCache.files,
        cachedBytes: qwenCache.bytes,
        approxMB: App.ai.qwen ? App.ai.qwen.approxSizeMB() : 467,
        device: qwenMetrics.device || (webgpu ? 'webgpu' : 'wasm'),
        activeDevice: qwenMetrics.device || null,
        webgpuError: qwenMetrics.webgpuError || null,
        warmedUp: Boolean(qwenMetrics.warmedUp),
      },
      checkedAt: Date.now(),
    };

    if (App.bus) App.bus.emit('ai:status', Object.assign({}, _cachedStatus));
    return Object.assign({}, _cachedStatus);
  }

  function _formatFactSentence(facts) {
    const f = facts || {};
    if (f.game === 'wall') {
      const picked = Array.isArray(f.selectedItems) ? f.selectedItems.join(', ') : '';
      const parts = [`Game: Four-Group Wall. Picked: ${picked}.`];
      parts.push(f.isOneAway ? 'Mistake: 3 match, 1 does not.' : `Mistake: mixed ${f.distinctGroupCount || 2} different groups.`);
      if (Array.isArray(f.skillsPresent) && f.skillsPresent.length) {
        parts.push(`Skills mixed: ${f.skillsPresent.join(', ')}.`);
      }
      if (Array.isArray(f.cardMeanings) && f.cardMeanings.length) {
        parts.push('Meanings: ' + f.cardMeanings.slice(0, 3).map((m) => `${m.word}=${m.zh}`).join('; ') + '.');
      }
      if (f.spoilerSafe) {
        parts.push('Hint without revealing hidden group names.');
      } else if (f.majorityGroup) {
        parts.push(`Group "${f.majorityGroup.labelZh}" rule: ${f.majorityGroup.ruleZh}`);
        if (Array.isArray(f.oddItems) && f.oddItems.length) {
          parts.push('Mismatch: ' + f.oddItems.map((it) => `${it.item} belongs to ${it.groupLabelZh}`).join('; ') + '.');
        }
      }
      return parts.join(' ');
    }

    const parts = [];
    if (f.word) parts.push(`Word: ${f.word}${f.pos ? ` (${f.pos})` : ''}${f.meaningZh ? ` = ${f.meaningZh}` : ''}.`);
    if (f.expected && f.expected !== f.word) parts.push(`Expected: ${f.expected}.`);
    if (f.userAnswer) parts.push(`Student wrote: ${f.userAnswer}.`);
    if (f.errorType) parts.push(`Error: ${f.errorType}.`);
    if (Array.isArray(f.wrongLetters) && f.wrongLetters.length) {
      parts.push(`Wrong letters: ${f.wrongLetters.join(', ')}.`);
    }
    return parts.join(' ');
  }

  /**
   * Build multi-turn few-shot chat messages for Qwen (plain text, NO JSON required).
   * Uses Qwen's native chat template with 2 short few-shot examples + low temperature.
   * @param {Object} facts
   * @param {{ language?: string }} [opts]
   * @returns {Array<{ role: string, content: string }>}
   */
  function buildFeatureAMessages(facts, opts) {
    const o = opts || {};
    const lang = o.language || (App.i18n ? App.i18n.lang() : 'zh-TW');
    const isEn = lang === 'en';
    const userFact = _formatFactSentence(facts);

    if (isEn) {
      const sysEn = [
        'You are a concise English tutor for university students.',
        'Use ONLY the given facts. Reply in exactly two short lines:',
        'Reason: <one short sentence>',
        'Tip: <one short memory tip>',
      ].join('\n');
      return [
        { role: 'system', content: sysEn },
        {
          role: 'user',
          content: 'Game: Four-Group Wall. Picked: spoon, fork, knife, cut. Mistake: 3 match, 1 does not. Skills mixed: vocab, grammar. Hint without revealing hidden group names.',
        },
        {
          role: 'assistant',
          content: 'Reason: spoon, fork, and knife are tableware nouns, while cut is a verb from a grammar group.\nTip: Check part of speech first to spot red-herring verbs.',
        },
        { role: 'user', content: userFact },
      ];
    }

    const sysZh = [
      'You are a helpful English tutor for Taiwanese university students.',
      'Use ONLY the given facts. Reply in Traditional Chinese in exactly two short lines:',
      '原因：<one short sentence explaining the mistake>',
      '記憶提示：<one short memory tip>',
    ].join('\n');

    if (facts && facts.game === 'wall') {
      return [
        { role: 'system', content: sysZh },
        {
          role: 'user',
          content: 'Game: Four-Group Wall. Picked: spoon, fork, knife, cut. Mistake: 3 match, 1 does not. Skills mixed: vocab, grammar. Hint without revealing hidden group names.',
        },
        {
          role: 'assistant',
          content: '原因：spoon、fork、knife 都是餐具名詞，但 cut 屬於動詞文法組，四個無法歸成同一類。\n記憶提示：先分辨名詞和動詞，小心像 cut 這樣和餐具相關的誘答字。',
        },
        {
          role: 'user',
          content: 'Game: Four-Group Wall. Picked: apple, banana, grape, May. Mistake: 3 match, 1 does not. Skills mixed: vocab, grammar. Hint without revealing hidden group names.',
        },
        {
          role: 'assistant',
          content: '原因：apple、banana、grape 都是水果名詞，但 May 在這裡是助動詞，與其他三個不同類。\n記憶提示：遇到多義字時，先檢查它是不是文法助動詞或詞性不同。',
        },
        { role: 'user', content: userFact },
      ];
    }

    return [
      { role: 'system', content: sysZh },
      {
        role: 'user',
        content: 'Word: friend (n.) = 朋友. Student wrote: freind. Error: spelling. Wrong letters: i, e.',
      },
      {
        role: 'assistant',
        content: '原因：friend（朋友）正確拼法是 ie，你把字母 i 和 e 寫反成了 freind。\n記憶提示：把 friend 記成 fri-end（好朋友到最後 end 都在），就不容易拼反。',
      },
      {
        role: 'user',
        content: 'Word: eat (v.) = 吃. Expected: ate. Student wrote: eated. Error: tense.',
      },
      {
        role: 'assistant',
        content: '原因：eat 是不規則動詞，過去式是 ate，不是規則加 -ed 的 eated。\n記憶提示：把 eat 和 ate 當成一組口訣唸三次（eat → ate）。',
      },
      { role: 'user', content: userFact },
    ];
  }

  /**
   * Build compact prompt object (used by Tier 1 Gemini Nano JSON schema).
   * @param {Object} facts
   * @param {{ language?: string, targetTier?: string }} [opts]
   * @returns {{ systemPrompt: string, userPrompt: string }}
   */
  function buildFeatureAPrompt(facts, opts) {
    const o = opts || {};
    const lang = o.language || (App.i18n ? App.i18n.lang() : 'zh-TW');
    const isNano = o.targetTier === 'nano';
    const wantZh = lang !== 'en' && !isNano;

    const systemPrompt = [
      'English tutor. Use ONLY the given facts. Be brief.',
      wantZh
        ? 'Reply ONLY with JSON in Traditional Chinese: {"why":"1句原因","tip":"1句提示","example":null}'
        : (facts && facts.word && facts.game !== 'wall'
          ? 'Reply ONLY with JSON in simple English: {"why":"1 short sentence","tip":"1 short tip","example":"short sentence with WORD"}'
          : 'Reply ONLY with JSON in simple English: {"why":"1 short sentence","tip":"1 short tip","example":null}'),
    ].join('\n');

    return { systemPrompt, userPrompt: _formatFactSentence(facts) };
  }

  /**
   * Extract and parse the first balanced JSON object from model output text (Nano / JSON fallback).
   * @param {string} raw
   * @returns {Object|null}
   */
  function extractJsonObject(raw) {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      const direct = JSON.parse(trimmed);
      if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;
    } catch (_e) { /* fall through */ }

    const start = trimmed.indexOf('{');
    if (start < 0) return null;

    let depth = 0;
    let inStr = false;
    let escaped = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            const sub = JSON.parse(trimmed.slice(start, i + 1));
            if (sub && typeof sub === 'object' && !Array.isArray(sub)) return sub;
          } catch (_e) {
            return null;
          }
          break;
        }
      }
    }

    if (depth > 0) {
      const partial = trimmed.slice(start);
      const whyM = partial.match(/"why"\s*:\s*"((?:\\.|[^"\\])+)"/);
      const tipM = partial.match(/"tip"\s*:\s*"((?:\\.|[^"\\])+)/);
      if (whyM && tipM) {
        const unesc = (s) => s.replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\\\/g, '\\').trim();
        const exM = partial.match(/"example"\s*:\s*"((?:\\.|[^"\\])+)"/);
        return {
          why: unesc(whyM[1]),
          tip: unesc(tipM[1]),
          example: exM ? unesc(exM[1]) : null,
        };
      }
    }
    return null;
  }

  function _cleanLine(str) {
    return String(str || '')
      .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-z]*\s*/gi, '').replace(/```/g, ''))
      .replace(/\*\*|__|~~|`/g, '')
      .replace(/^\s*[-*•·\d.)]+\s*/, '')
      .replace(/^["'「『“”]+|["'」』“”]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function _truncate(str, maxChars) {
    const clean = String(str || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxChars) return clean;
    return clean.slice(0, maxChars - 1).trim() + '…';
  }

  function _checkFactConsistency(why, tip, facts) {
    if (!facts || typeof facts !== 'object') return null;
    const combined = `${why} ${tip}`;
    const lower = combined.toLowerCase();

    // Reject obvious API/code garbage or model refusals
    if (/(error_code|invalid input|@restcontroller|public class|as an ai\b|i cannot\b|無法回答)/i.test(combined)) {
      return 'refusal_or_code';
    }

    // Wall: must not falsely claim all 4 items belong together or the learner got it right
    if (facts.game === 'wall') {
      if (/(全部都屬於同一組|四個都是同一組|四個屬於同一類|都屬於同一組|這題答對了|all four belong|all belong to the same group|correct group)/i.test(combined)) {
        return 'contradicts_facts';
      }
    }

    // Word/spelling: must not claim the wrong userAnswer is the correct answer
    if (facts.expected && facts.userAnswer) {
      const exp = String(facts.expected).trim().toLowerCase();
      const usr = String(facts.userAnswer).trim().toLowerCase();
      if (exp && usr && exp !== usr) {
        const escUsr = usr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(正確拼法是|正確答案是|correct spelling is|correct answer is)\\s*["'「]?${escUsr}["'」]?(?:\\b|[。，,.])`, 'i').test(lower)) {
          return 'contradicts_facts';
        }
      }
    }

    return null;
  }

  /**
   * Lenient Feature A parser & safety validator (accepts plain text OR JSON).
   * - Strips markdown, quotes, bullets; accepts full-width or half-width colons.
   * - Accepts missing labels (first sentence = reason, rest = tip).
   * - Converts Simplified -> Traditional Chinese when UI is zh-TW.
   * - Enforces meaningful safety checks: Traditional Chinese (in zh-TW), length,
   *   no fact contradictions, and word-in-example validation.
   * @param {string|Object} raw
   * @param {Object} facts
   * @param {{ language?: string, requireJson?: boolean }} [opts]
   * @returns {{ valid: boolean, reason: string|null, data: { why: string, tip: string, example: string|null }|null }}
   */
  function parseFeatureAOutput(raw, facts, opts) {
    const o = opts || {};
    const lang = o.language || (App.i18n ? App.i18n.lang() : 'zh-TW');
    const requireZh = lang !== 'en';

    let why = '';
    let tip = '';
    let example = null;

    if (raw && typeof raw === 'object') {
      why = typeof raw.why === 'string' ? _cleanLine(raw.why) : '';
      tip = typeof raw.tip === 'string' ? _cleanLine(raw.tip) : '';
      example = typeof raw.example === 'string' && raw.example.trim() ? _cleanLine(raw.example) : null;
    } else if (typeof raw === 'string') {
      const stripped = raw.trim();
      if (!stripped) return { valid: false, reason: 'empty', data: null };

      // 1. Try JSON first if output contains braces
      const jsonObj = stripped.includes('{') ? extractJsonObject(stripped) : null;
      if (jsonObj && typeof jsonObj.why === 'string') {
        why = _cleanLine(jsonObj.why);
        tip = typeof jsonObj.tip === 'string' ? _cleanLine(jsonObj.tip) : '';
        example = typeof jsonObj.example === 'string' && jsonObj.example.trim() ? _cleanLine(jsonObj.example) : null;
      } else if (o.requireJson) {
        return { valid: false, reason: 'invalid_json', data: null };
      } else {
        // 2. Lenient plain-text parsing
        const noFences = stripped
          .replace(/^```[a-z]*\s*/gim, '')
          .replace(/\s*```$/gim, '')
          .replace(/\*\*/g, '')
          .replace(/__/g, '')
          .replace(/`/g, '');

        const lines = noFences
          .split(/\r?\n+/)
          .map((l) => l.trim())
          .filter(Boolean);

        const WHY_RE = /^(?:[-*•\d.)\s]*)(?:錯誤原因|原因|說明|解釋|why|reason)\s*[：:]\s*(.+)$/i;
        const TIP_RE = /^(?:[-*•\d.)\s]*)(?:記憶提示|記憶法|小提示|小撇步|提示|建議|口訣|memory\s*tip|tip|hint)\s*[：:]\s*(.+)$/i;
        const EX_RE = /^(?:[-*•\d.)\s]*)(?:英文例句|例句|範例|example)\s*[：:]\s*(.+)$/i;

        const unlabeled = [];
        for (const line of lines) {
          // Handle inline "原因：... 記憶提示：..." on the same single line
          const inlineSplit = line.match(/^(?:[-*•\d.)\s]*)(?:錯誤原因|原因|why|reason)\s*[：:]\s*(.+?)\s+(?:記憶提示|記憶法|提示|tip|hint)\s*[：:]\s*(.+)$/i);
          if (inlineSplit) {
            if (!why) why = _cleanLine(inlineSplit[1]);
            if (!tip) tip = _cleanLine(inlineSplit[2]);
            continue;
          }

          const mWhy = line.match(WHY_RE);
          if (mWhy) {
            why = why ? `${why} ${_cleanLine(mWhy[1])}` : _cleanLine(mWhy[1]);
            continue;
          }
          const mTip = line.match(TIP_RE);
          if (mTip) {
            tip = tip ? `${tip} ${_cleanLine(mTip[1])}` : _cleanLine(mTip[1]);
            continue;
          }
          const mEx = line.match(EX_RE);
          if (mEx) {
            const cleanedEx = _cleanLine(mEx[1]);
            if (cleanedEx && !/^(null|none|無|沒有)$/i.test(cleanedEx)) example = cleanedEx;
            continue;
          }
          const cleaned = _cleanLine(line);
          if (cleaned) unlabeled.push(cleaned);
        }

        // Missing labels fallback: first sentence/line = reason, rest = tip
        if (!why && unlabeled.length) {
          if (unlabeled.length >= 2) {
            why = unlabeled[0];
            tip = tip || unlabeled.slice(1).join(' ');
          } else {
            const parts = unlabeled[0]
              .split(/(?<=[。！？!?])\s*|(?<=\.)\s+(?=[A-Z\u4e00-\u9fff])/)
              .map((p) => p.trim())
              .filter(Boolean);
            why = parts[0] || unlabeled[0];
            if (!tip && parts.length >= 2) {
              tip = parts.slice(1).join(' ');
            }
          }
        } else if (why && !tip && unlabeled.length) {
          tip = unlabeled.join(' ');
        }
      }
    } else {
      return { valid: false, reason: 'empty', data: null };
    }

    if (requireZh) {
      why = s2t(why);
      tip = s2t(tip);
    }

    why = _truncate(why, 220);
    tip = _truncate(tip, 160);
    if (example) example = _truncate(example, 140);

    if (!why || why.length < 4) {
      return { valid: false, reason: 'too_short', data: null };
    }

    // Check refusal / code / fact contradictions BEFORE filling fallback tip
    const factErr = _checkFactConsistency(why, tip, facts);
    if (factErr) {
      return { valid: false, reason: factErr, data: null };
    }

    // In zh-TW UI, require Traditional Chinese characters in the explanation
    if (requireZh) {
      const cjkCount = (why.match(/[\u4e00-\u9fff]/g) || []).length;
      if (cjkCount < 3) {
        return { valid: false, reason: 'not_chinese', data: null };
      }
    }

    // If model gave a solid reason but omitted tip (or tip < 3 chars), use grounded template tip
    if (!tip || tip.length < 3) {
      if (o.requireJson) {
        return { valid: false, reason: 'missing_tip', data: null };
      }
      const tpl = App.ai.templates ? App.ai.templates.explainMistake(facts) : null;
      tip = tpl && tpl.tip ? tpl.tip : (requireZh ? '比對詞性與情境用法再試一次。' : 'Check part of speech and context before trying again.');
    }

    // Validate example sentence contains target word (Section 5.5)
    if (example && facts && facts.word) {
      const target = String(facts.word).trim().toLowerCase();
      const lowerEx = example.toLowerCase();
      const variants = App.text && typeof App.text.variants === 'function'
        ? App.text.variants(target)
        : [target];
      const containsWord = variants.some((v) => {
        const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i').test(lowerEx);
      });
      if (!containsWord) example = null;
    } else if (example && (!facts || !facts.word)) {
      example = null;
    }

    return { valid: true, reason: null, data: { why, tip, example } };
  }

  /**
   * Backwards-compatible wrapper for JSON-first validation (used by Nano & existing tests).
   */
  function validateFeatureAOutput(raw, facts, opts) {
    return parseFeatureAOutput(raw, facts, Object.assign({ requireJson: true }, opts || {}));
  }

  /**
   * Run a streaming generation with a Time-To-First-Token (TTFT) timeout only:
   * - If NO token arrives within `ttftTimeoutMs` (default 20s), aborts and throws TimeoutError.
   * - Once the first token arrives, the timeout is cleared so streaming finishes naturally.
   */
  async function _runWithFirstTokenTimeout(promiseFactory, ttftTimeoutMs, externalSignal) {
    const controller = new AbortController();
    let timedOut = false;
    let firstTokenSeen = false;

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    let timer = setTimeout(() => {
      if (firstTokenSeen) return;
      timedOut = true;
      controller.abort();
    }, ttftTimeoutMs);

    function markFirstToken() {
      if (firstTokenSeen) return;
      firstTokenSeen = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    try {
      return await promiseFactory(controller.signal, markFirstToken);
    } catch (err) {
      if (timedOut) {
        const tErr = new Error('No token received before timeout');
        tErr.name = 'TimeoutError';
        throw tErr;
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  /**
   * Warm up Qwen in the background ONLY when already cached (never auto-downloads).
   * @returns {Promise<{ warmed: boolean, device?: string|null, warmupMs?: number }>}
   */
  async function warmUpIfCached() {
    const preferred = App.store && App.store.settings
      ? App.store.settings.get('aiEngine') || 'auto'
      : 'auto';
    if (preferred === 'templates' || preferred === 'nano') return { warmed: false };
    if (!App.ai.qwen || typeof App.ai.qwen.warmUpIfCached !== 'function') return { warmed: false };
    return App.ai.qwen.warmUpIfCached();
  }

  /**
   * Feature A: Explain a learner mistake using the active/forced AI tier.
   * Records every attempt (including raw output and rejection reason) for #/settings/ai.
   * @param {Object} facts
   * @param {{ forceTier?: 'nano'|'qwen'|'template', signal?: AbortSignal, onProgress?: Function, onToken?: Function, onDevice?: Function, timeoutMs?: number }} [opts]
   * @returns {Promise<Object>}
   */
  async function explainMistake(facts, opts) {
    const o = opts || {};
    const timeoutMs = Number.isFinite(o.timeoutMs) ? o.timeoutMs : FIRST_TOKEN_TIMEOUT_MS;
    const status = await detect();
    const tier = o.forceTier || status.activeTier || 'template';
    const lang = App.i18n ? App.i18n.lang() : 'zh-TW';
    let genStart = performance.now();

    function fallback(note, extra) {
      const ex = extra || {};
      const tpl = App.ai.templates
        ? App.ai.templates.explainMistake(facts)
        : { why: '', tip: '', example: null };
      const elapsedMs = ex.elapsedMs || Math.max(1, Math.round(performance.now() - genStart));
      const fellBack = tier !== 'template';

      _saveLastAttempt({
        ts: Date.now(),
        tier,
        source: 'template',
        device: ex.device || null,
        fellBack,
        rejectionReason: note || null,
        rawOutput: ex.rawOutput || null,
        parsedWhy: tpl.why,
        parsedTip: tpl.tip,
        firstTokenMs: ex.firstTokenMs || null,
        elapsedMs,
        tokenCount: ex.tokenCount || null,
        tokensPerSec: ex.tokensPerSec || null,
      });

      return {
        why: tpl.why,
        tip: tpl.tip,
        example: tpl.example,
        source: 'template',
        device: ex.device || null,
        fellBack,
        note: note || null,
        elapsedMs,
      };
    }

    if (tier === 'template') {
      return fallback(null, {});
    }

    // ── Tier 1: Gemini Nano (+ Translator) ───────────────────────
    if (tier === 'nano' && App.ai.nano) {
      const prompt = buildFeatureAPrompt(facts, { language: lang, targetTier: 'nano' });
      genStart = performance.now();
      let lastRaw = null;
      let lastReason = 'invalid_json';
      let lastElapsed = 0;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await _runWithFirstTokenTimeout(
            (sig, markFirst) => App.ai.nano.generate({
              systemPrompt: prompt.systemPrompt,
              userPrompt: prompt.userPrompt,
              schema: FEATURE_A_SCHEMA,
              signal: sig,
              onProgress: o.onProgress,
              onToken: (chunk, full) => {
                if (chunk) markFirst();
                if (typeof o.onToken === 'function') o.onToken(chunk, full);
              },
            }),
            timeoutMs,
            o.signal
          );
          lastRaw = res.text;
          lastElapsed = res.elapsedMs;

          const checked = parseFeatureAOutput(res.text, facts, { language: 'en', requireJson: false });
          if (checked.valid) {
            let { why, tip, example } = checked.data;
            if (lang !== 'en') {
              why = s2t(await App.ai.nano.translateEnToZh(why));
              tip = s2t(await App.ai.nano.translateEnToZh(tip));
            }
            _saveLastAttempt({
              ts: Date.now(),
              tier: 'nano',
              source: 'nano',
              device: 'nano',
              fellBack: false,
              rejectionReason: null,
              rawOutput: res.text,
              parsedWhy: why,
              parsedTip: tip,
              firstTokenMs: null,
              elapsedMs: res.elapsedMs,
              tokenCount: null,
              tokensPerSec: null,
            });
            return {
              why,
              tip,
              example,
              source: 'nano',
              device: 'nano',
              fellBack: false,
              note: null,
              elapsedMs: res.elapsedMs,
            };
          }
          lastReason = checked.reason || 'invalid_format';
        } catch (err) {
          if (err && err.name === 'AbortError') return fallback('aborted', { rawOutput: lastRaw });
          if (err && err.name === 'TimeoutError') return fallback('timeout', { rawOutput: lastRaw });
          if (attempt === 1) return fallback('nano_error', { rawOutput: lastRaw });
        }
      }
      return fallback(lastReason, { rawOutput: lastRaw, elapsedMs: lastElapsed });
    }

    // ── Tier 2: Qwen 2.5 0.5B Instruct (plain-text few-shot chat template) ─
    if (tier === 'qwen' && App.ai.qwen) {
      const messages = buildFeatureAMessages(facts, { language: lang });
      let loadMs = 0;
      let activeDevice = null;
      try {
        const info = await App.ai.qwen.init({
          onProgress: o.onProgress,
          signal: o.signal,
        });
        loadMs = info.loadMs || 0;
        activeDevice = info.device || null;
        if (typeof o.onDevice === 'function' && activeDevice) o.onDevice(activeDevice);
      } catch (err) {
        if (err && err.name === 'AbortError') return fallback('aborted', {});
        return fallback('download_error', { rawOutput: err && err.message ? err.message : null });
      }

      genStart = performance.now();
      let lastRaw = null;
      let lastReason = 'invalid_format';
      let lastResMeta = { device: activeDevice };

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const runMsgs = attempt === 0
            ? messages
            : messages.concat([
              { role: 'user', content: lang === 'en' ? 'Reply in 2 short lines: Reason: ... and Tip: ...' : '請用繁體中文回答兩行：「原因：...」與「記憶提示：...」' },
            ]);

          const res = await _runWithFirstTokenTimeout(
            (sig, markFirst) => App.ai.qwen.generate({
              messages: runMsgs,
              maxNewTokens: FEATURE_A_MAX_TOKENS,
              temperature: 0.3,
              topP: 0.9,
              signal: sig,
              onToken: (chunk, full) => {
                if (chunk) markFirst();
                if (typeof o.onToken === 'function') o.onToken(chunk, full);
              },
            }),
            timeoutMs,
            o.signal
          );

          lastRaw = res.text;
          activeDevice = res.device || activeDevice;
          lastResMeta = {
            device: activeDevice,
            firstTokenMs: res.firstTokenMs || null,
            elapsedMs: res.elapsedMs,
            tokenCount: res.tokenCount || null,
            tokensPerSec: res.tokensPerSec || null,
            rawOutput: res.text,
          };

          const checked = parseFeatureAOutput(res.text, facts, { language: lang, requireJson: false });
          if (checked.valid) {
            _saveLastAttempt({
              ts: Date.now(),
              tier: 'qwen',
              source: 'qwen',
              device: activeDevice,
              fellBack: false,
              rejectionReason: null,
              rawOutput: res.text,
              parsedWhy: checked.data.why,
              parsedTip: checked.data.tip,
              firstTokenMs: res.firstTokenMs || null,
              elapsedMs: res.elapsedMs,
              tokenCount: res.tokenCount || null,
              tokensPerSec: res.tokensPerSec || null,
            });
            return {
              why: checked.data.why,
              tip: checked.data.tip,
              example: checked.data.example,
              source: 'qwen',
              device: activeDevice,
              fellBack: false,
              note: null,
              elapsedMs: res.elapsedMs,
              firstTokenMs: res.firstTokenMs || null,
              tokenCount: res.tokenCount || null,
              loadMs,
            };
          }
          lastReason = checked.reason || 'invalid_format';
        } catch (err) {
          if (err && err.name === 'AbortError') return fallback('aborted', lastResMeta);
          if (err && err.name === 'TimeoutError') return fallback('timeout', lastResMeta);
          if (attempt === 1) {
            return fallback('qwen_error', Object.assign({}, lastResMeta, {
              rawOutput: lastRaw || (err && err.message ? err.message : null),
            }));
          }
        }
      }
      return fallback(lastReason, lastResMeta);
    }

    return fallback('unavailable', {});
  }

  function invalidateDetection() {
    _cachedStatus = null;
  }

  async function destroyAll() {
    if (App.ai.nano) await App.ai.nano.destroy();
    if (App.ai.qwen) App.ai.qwen.destroy();
  }

  Object.assign(App.ai, {
    FIRST_TOKEN_TIMEOUT_MS,
    GENERATION_TIMEOUT_MS: FIRST_TOKEN_TIMEOUT_MS,
    FEATURE_A_MAX_TOKENS,
    FEATURE_A_SCHEMA,
    s2t,
    detect,
    warmUpIfCached,
    getLastAttempt,
    buildFeatureAMessages,
    buildFeatureAPrompt,
    extractJsonObject,
    parseFeatureAOutput,
    validateFeatureAOutput,
    explainMistake,
    invalidateDetection,
    destroyAll,
  });
})();
