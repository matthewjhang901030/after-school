# Data Audit (`docs/DATA.md`)

This document records the exact observed schema of `data/english-2000-data.js` and the JSON content banks used by **放學後 After School**.

---

## 1. Course Word List: `data/english-2000-data.js`

- **Format:** Classic browser script assigning `window.ENGLISH_2000_DATA` (1,817,188 bytes).
- **Access rule:** Kept unmodified. Loaded via `<script src="./data/english-2000-data.js"></script>` before module scripts; only `js/store/cards.js` reads `window.ENGLISH_2000_DATA`.

### 1.1 Top-Level Keys

| Key | Type | Size / Value | Description |
|---|---|---|---|
| `source` | `object` | `{ title, csvPath, reviewNotes }` | Provenance metadata (`"English Vocabulary by Chapter 2025 reviewed"`, 4 review notes). |
| `stats` | `object` | See below | Summary counts and QA totals for the dataset. |
| `chapters` | `array` | 30 items | Chapter index (`{ chapterNo, title, count }`). |
| `units` | `array` | 133 items | Unit index (`{ unitNo, chapterNo, chapterTitle, title, count }`). |
| `words` | `array` | 2,029 items | Master vocabulary rows (`id` `"0001"` to `"2029"`). |

#### Observed `stats` values
- `rows`: `2029`
- `uniqueWords`: `1924` (97 case-insensitive headwords appear more than once)
- `chapters`: `30`
- `units`: `133`
- `sourceTranslations`: `767`, `machineTranslations`: `1260`, `manualCorrections`: `2`
- `sourceExamples`: `695`, `generatedExamples`: `1321`, `exampleTranslations`: `2029`
- `qaSummary`: `{ duplicate_word: 202, english_corrected_from_raw_note: 2, suspect_ocr_word: 1 }`

### 1.2 Fields on Each `words[i]` Entry (21 fields)

| Field | Type | Nulls | Empty (`""`) | Notes & Examples |
|---|---|---|---|---|
| `id` | `string` | 0 | 0 | Zero-padded 4-digit string `"0001"`–`"2029"`. |
| `order` | `number` | 0 | 0 | Sequential row order (`1`–`2029`). |
| `chapterNo` | `number` | 0 | 0 | `1`–`30`. |
| `chapterTitle` | `string` | 0 | 0 | e.g. `"People"`, `"Occupations"`. |
| `unitNo` | `number` | 0 | 0 | `1`–`133`. |
| `unitTitle` | `string` | 0 | 0 | e.g. `"Life Stages"`. |
| `wordNo` | `number` | 0 | 0 | Order within the unit. |
| `originalWord` | `string` | 0 | 0 | Original raw word before correction (differs from `word` on `"0291"` `ook→look` and `"0295"` `ip→lip`). |
| `word` | `string` | 0 | 0 | English headword, e.g. `"baby"`. Entry `"0722"` has `"l'"` (`suspect_ocr_word`). |
| `translation` | `string` | 0 | 0 | Traditional Chinese meaning, e.g. `"嬰兒"`. |
| `partOfSpeech` | `string` | 0 | 1,282 | Present on 747 rows; uses abbreviations (`"n.[C]"`, `"a."`, `"v."`, `"n.[U]"`, `"n.[pl.]"`, compound forms like `"a.；n.[C]"`), plus noisy number strings (e.g. `"n.a.；20"`, `"n.a.；0；Water freezes at zero degrees. 21 nineteen ("`, `"n.[[U]"`). |
| `example` | `string` | 0 | 0 | Primary English example sentence. |
| `examples` | `string[]` | 0 | 0 | Array of English example sentences (108 rows have > 1 item). |
| `exampleZh` | `string` | 0 | 0 | Traditional Chinese translation of the primary example. |
| `examplesZh` | `string[]` | 0 | 0 | Translations matching `examples` (108 secondary entries are `""`). |
| `source` | `string` | 0 | 0 | e.g. `"Manual correction from page image"`. |
| `note` | `string` | 0 | 0 | Raw/OCR note. |
| `reviewNote` | `string` | 0 | 2,028 | Non-empty only on `"0722"` (`"疑似 OCR 錯字；2029 主清單保留原值，需回原始頁面確認。"`). |
| `translationSource` | `string` | 0 | 0 | `"source_771"` \| `"machine_translation"` \| `"manual_correction"`. |
| `exampleSource` | `string` | 0 | 0 | `"source_771"` \| `"generated_example"` \| `"curated_example"`. |
| `qaFlags` | `string[]` | 0 | 0 | Contains any of `"duplicate_word"`, `"english_corrected_from_raw_note"`, `"suspect_ocr_word"`. |

**Absent fields:** There is **no `ipa` field** in `data/english-2000-data.js`.

### 1.3 Mapping to Application `card` Model (Section 3.1)

When `js/store/cards.js` imports `window.ENGLISH_2000_DATA.words`:
- Rows with the same `word.trim().toLowerCase()` are **merged into one builtin card** (`1,924` unique cards), with primary `id: "b-" + firstRow.id` and `sourceIds: string[]` storing all contributing row IDs (`"0001"`, ...).
- `word`: `row.word.trim()`
- `ipa`: `null` (never invented; IPA UI row stays hidden unless user edits it)
- `pos`: normalized from `row.partOfSpeech` (`"a."` → `"adj."`, etc.; empty or unparseable → `null`)
- `zh`: unique `translation` values across merged rows joined with `"；"`
- `example` / `exampleZh`: from primary row (`row.example`, `row.exampleZh`)
- `tags`: chapter/unit tags (plus QA tags where relevant)
- `source`: `"builtin"`
- `hidden`: `true` for `suspect_ocr_word` entries (e.g. `id: "0722"`, `"l'"`) so they stay in data without appearing in games; `false` otherwise (plus user override state in `as.v1.cards.overrides`)
- `chapterNo`, `unitNo`: kept for distractor fallback when `pos` is `null`


### 1.4 Non-Destructive Curation Layer (`data/card-fixes.js`)

Applied in `js/store/cards.js` by raw row ID before case-insensitive deduplication (`data/english-2000-data.js` remains completely unmodified):
- **Active study/game cards:** `1899` (plus `29` hidden OCR-garbage / section-header rows excluded from study and games).
- **OCR headword fixes:** `38` rows corrected from textbook `note` & unit context.
- **Context meaning fixes:** `125` rows corrected (both OCR-damaged words and clearly wrong machine translations).
- **Examples:** `665` active cards retain a real human example sentence (`source_771` / `curated_example`); all synthetic `generated_example` meta-templates are hidden (`example: null`) and excluded from games and M7 embeddings; trailing Chinese notes are stripped from `57` mixed examples.

#### A. Hidden Garbage & Section-Header Rows (29 rows)

| Row ID | Raw Word | Old Meaning | Reason |
|---|---|---|---|
| `0345` | `OO` | 哦 | OCR bullet circles ("OO") |
| `0380` | `Afi` | 阿菲 | Unrecoverable OCR fragment ("Afi") |
| `0429` | `fij` | 斐濟 | Unrecoverable OCR fragment ("fij") |
| `0524` | `OO` | 哦 | OCR bullet circles ("OO") |
| `0581` | `Chap` | 章 | Chapter header fragment ("Chap") |
| `0630` | `build strong bones` | 強健骨骼 | Example phrase fragment ("build strong bones") |
| `0645` | `meat and eggs` | 肉和蛋 | Unit title ("meat and eggs") |
| `0649` | `oo` | 哦 | OCR bullet circles ("oo") |
| `0666` | `OO` | 哦 | OCR bullet circles ("OO") |
| `0696` | `OO` | 哦 | OCR bullet circles ("OO") |
| `0714` | `Cooking` | 烹飪 | Unit title ("Cooking") |
| `0720` | `ways of` | 的方式 | Incomplete phrase fragment ("ways of") |
| `0722` | `l'` | 待確認（疑似 OCR 錯字） | Flagged suspect_ocr_word ("l'") |
| `0735` | `OO` | 哦 | OCR bullet circles ("OO") |
| `0736` | `three glasses of wine` | 三杯酒 | Example phrase fragment ("three glasses of wine") |
| `0806` | `COO` | 營運長 | OCR bullet circles ("COO") |
| `0831` | `OO` | 哦 | OCR bullet circles ("OO") |
| `0834` | `CO` | 一氧化碳 | OCR bullet circles ("CO") |
| `0851` | `in the mountains` | 在山裡 | Example phrase fragment ("in the mountains") |
| `0852` | `up at` | 起於 | Incomplete phrase fragment ("up at") |
| `0892` | `join a dancing club` | 加入舞蹈俱樂部 | Example phrase fragment ("join a dancing club") |
| `0941` | `clean up his/her waste` | 清理他/她的廢物 | Example sentence fragment ("clean up his/her waste") |
| `0956` | `Action Verbs` | 動作動詞 | Unit title ("Action Verbs") |
| `0957` | `t a box` | 一個盒子 | OCR phrase fragment ("t a box") |
| `1038` | `Cautbayoal` | 考特巴約阿爾 | Unrecoverable OCR fragment ("Cautbayoal") |
| `1128` | `upstai` | 上層 | Garbled duplicate of upstairs ("upstai") |
| `1315` | `aar` | 阿爾 | Unrecoverable OCR fragment ("aar") |
| `1616` | `ee MV` | MV | Unrecoverable OCR fragment ("ee MV") |
| `1742` | `oft` | 常 | Garbled OCR fragment ("oft") |

#### B. OCR Headword Fixes (38 rows)

| Row ID | Old Word | New Word | Old Meaning | New Meaning | Reason |
|---|---|---|---|---|---|
| `0315` | `eg` | `leg` | 例如 | 腿 | OCR dropped "l" (note: leg [leg] (n.)) |
| `0374` | `ucky` | `lucky` | 幸運的 | 幸運的 | OCR dropped "l" (note: lucky (a.)) |
| `0388` | `ess` | `less` | 埃斯 | 較少的 | OCR dropped "l" (note: less (a.)) |
| `0421` | `ive` | `live` | 我已經 | 居住；生活 | OCR dropped "l" (note: live (v.)) |
| `0443` | `ovely` | `lovely` | 過於 | 可愛的；迷人的 | OCR dropped "l" (note: lovely (a.)) |
| `0466` | `tul` | `two` | 圖爾 | 二 | OCR read IPA "[tu]" as "tul" (note: 4 two) |
| `0495` | `ate` | `late` | 吃了 | 遲到的；晚的 | OCR dropped "l" (note: late (a.) (adv.)) |
| `0523` | `II October` | `October` | 十月二號 | 十月 | OCR prefix "II " glued to month |
| `0550` | `iater` | `later` | 伊阿特 | 稍後的；後來的 | OCR "l"->"i" in iater (Past, Present, Future) |
| `0578` | `end` | `lend` | 結束 | 借出 | OCR dropped "l" (note: lend (v.)) |
| `0612` | `emon` | `lemon` | 右衛門 | 檸檬 | OCR dropped "l" (note: lemon (n.)) |
| `0638` | `II crab` | `crab` | 二、螃蟹 | 螃蟹 | OCR prefix "II " glued to crab |
| `0641` | `Iamb` | `lamb` | 羊肉 | 羊肉；小羊 | OCR "l"->"I" in Iamb (Meat and Eggs) |
| `0747` | `id` | `lid` | 編號 | 蓋子 | OCR dropped "l" (note: lid (n.)) |
| `0938` | `ose` | `lose` | 奧塞 | 輸；失去 | OCR dropped "l" (note: lose (v.)) |
| `1033` | `greet ery` | `greet` | 問候埃里 | 問候；打招呼 | OCR garbage tail "ery" in greet ery |
| `1095` | `wiz set` | `set` | 嚮導集 | 電視機；套組 | OCR prefix "wiz " (note: There is a TV set) |
| `1137` | `MN basement` | `basement` | 明尼蘇達地下室 | 地下室 | OCR prefix "MN " glued to basement |
| `1154` | `il trashcan` | `trashcan` | 伊爾垃圾桶 | 垃圾桶 | OCR prefix "il " glued to trashcan |
| `1208` | `os language` | `language` | 作業系統語言 | 語言 | OCR prefix "os " glued to language |
| `1210` | `poem rpomn` | `poem` | 詩歌朗誦 | 詩 | OCR IPA garbage "rpomn" glued to poem |
| `1214` | `N chemistry` | `chemistry` | 氮化學 | 化學 | OCR prefix "N " glued to chemistry |
| `1216` | `S biology` | `biology` | S生物學 | 生物學 | OCR prefix "S " glued to biology |
| `1275` | `Pencilcase` | `pencil case` | 鉛筆盒 | 鉛筆盒 | Standard spacing/casing for Pencilcase |
| `1279` | `Postcard` | `postcard` | 明信片 | 明信片 | Lowercase common noun Postcard |
| `1280` | `FP backpack` | `backpack` | FP背包 | 背包 | OCR prefix "FP " glued to backpack |
| `1333` | `i left` | `left` | 我離開了 | 左邊；向左 | OCR prefix "i " glued to left (Directions) |
| `1345` | `tore` | `store` | 撕裂 | 商店 | OCR dropped "s" (note: store, merges w/ 1342) |
| `1386` | `cene` | `scene` | 場景 | 場景；景色 | OCR dropped "s" (note: scene) |
| `1388` | `radition` | `tradition` | 輻射 | 傳統 | OCR dropped "t" (note: tradition) |
| `1413` | `Ohope` | `hope` | 奧霍普 | 希望 | OCR bullet "O" glued to hope (note: Peter hopes) |
| `1432` | `flattire` | `flat tire` | 平底鞋 | 爆胎 | OCR merged words "flattire" (Transportation) |
| `1457` | `iShighway` | `highway` | 高速公路 | 高速公路 | OCR prefix "iS" glued to highway |
| `1506` | `Bheight` | `height` | 高度 | 高度 | OCR prefix "B" glued to height |
| `1553` | `T mass` | `mass` | T品質 | 大量；質量 | OCR prefix "T " glued to mass (Quantities) |
| `1687` | `Zhen` | `hen` | 珍 | 母雞 | OCR prefix "Z" glued to hen (note: The hens lay) |
| `1746` | `open foponj` | `open` | 打開 foponj | 打開 | OCR IPA garbage "foponj" glued to open |
| `1774` | `easy riz` | `easy` | 簡單的riz | 簡單的 | OCR IPA garbage "riz" glued to easy |

#### C. Context-Wrong Meaning Fixes (92 rows)

| Row ID | Word | Old Meaning | New Meaning | Reason |
|---|---|---|---|---|
| `0046` | `last name / family name` | 姓氏/姓氏 | 姓氏 | Redundant "姓氏/姓氏" |
| `0789` | `ring` | 圓環 | 戒指 | Accessories unit (was 圓環) |
| `0803` | `item` | 專案 | 物品；項目 | Clothes & Accessories unit (was 專案) |
| `0805` | `string` | 字串 | 細繩；線 | Clothes & Accessories unit (was 字串) |
| `0807` | `wear` | 磨損 | 穿戴 | Clothes unit (was 磨損) |
| `0810` | `take off` | 起飛 | 脫下 | Clothes unit between put on / try on (was 起飛) |
| `0812` | `match` | 比賽 | 搭配；相配 | Clothes unit (was 比賽) |
| `0832` | `bat` | 蝙蝠 | 球棒 | Sports unit next to baseball (was 蝙蝠; Animal row 1707 stays 蝙蝠) |
| `0844` | `roll` | 卷 | 滾動 | Sports unit after bowling (was 卷) |
| `0853` | `race` | 種族 | 賽跑；競賽 | Outdoor Activities unit (was 種族) |
| `0872` | `custom` | 客製化 | 習俗；風俗 | Traveling unit after culture (was 客製化) |
| `0881` | `pack` | 包包 | 打包；收拾行李 | Traveling unit (was 包包) |
| `0913` | `instrument` | 儀器 | 樂器 | Music unit (was 儀器) |
| `0919` | `fan` | 風扇 | 歌迷；迷 | Music unit (was 風扇; Bedroom row 1106 stays 風扇) |
| `0942` | `raise` | 提高 | 飼養；養育 | Raising a Dog unit (was 提高) |
| `0945` | `feed` | 飼料 | 餵食 | Raising a Dog unit, verb (was 飼料) |
| `0958` | `lift` | 電梯 | 舉起；抬起 | Action Verbs unit (was 電梯) |
| `0960` | `strike` | 罷工 | 打；擊打 | Action Verbs unit (was 罷工) |
| `0968` | `walk` | 行人徒步區 | 走路；步行 | Action Verbs unit (was 行人徒步區) |
| `1029` | `bow` | 弓 | 鞠躬 | Social Life unit before gesture (was 弓) |
| `1061` | `offer` | 報價 | 提供；主動給予 | Good vs. Bad Behavior unit (was 報價) |
| `1067` | `fault` | 故障 | 過錯；缺點 | Good vs. Bad Behavior unit (was 故障) |
| `1100` | `sheet` | 片材 | 床單 | Bedroom unit before blanket (was 片材) |
| `1115` | `refrigerator / fridge` | 冰箱/冰箱 | 冰箱 | Redundant "冰箱/冰箱" |
| `1124` | `table` | 表 | 桌子；餐桌 | Kitchen & Dining Room unit (was 表) |
| `1153` | `iron` | 鐵 | 熨斗；熨燙 | Doing Housework unit (was 鐵; Material row 0798 stays 鐵) |
| `1166` | `meter` | 米 | 儀表；水電錶 | Household Problems unit (was 米) |
| `1174` | `minor` | 未成年人 | 副修；次要的 | Education unit (was 未成年人) |
| `1190` | `lesson` | 教訓 | 課程；一堂課 | In Class unit (was 教訓) |
| `1199` | `miss` | 小姐 | 錯過；想念 | In Class unit verb (was 小姐; 0035 Miss stays 小姐) |
| `1204` | `subject` | 主題 | 科目；學科 | Subjects unit (was 主題) |
| `1223` | `spell` | 咒語 | 拼字；拼寫 | Taking a Language Course unit (was 咒語) |
| `1227` | `letter` | 信 | 字母；信 | Taking a Language Course unit (was 信 only) |
| `1243` | `equal` | 平等 | 等於；相等的 | Math Course unit (was 平等) |
| `1244` | `divide` | 劃分 | 除以；分割 | Math Course unit (was 劃分) |
| `1251` | `review` | 評論 | 複習 | Preparing for a Test unit (was 評論) |
| `1259` | `grade` | 等級 | 成績；年級 | Preparing for a Test unit (was 等級) |
| `1260` | `final` | 決賽 | 期末考；最後的 | Preparing for a Test unit (was 決賽) |
| `1262` | `pass` | 透過 | 及格；通過 | Preparing for a Test unit (was 透過) |
| `1267` | `board` | 董事會 | 黑板；板子 | Stationery unit (was 董事會) |
| `1276` | `marker` | 標記 | 麥克筆；奇異筆 | Stationery unit (was 標記) |
| `1310` | `enter` | 輸入 | 進入 | Locations & Positions after entrance (was 輸入) |
| `1331` | `backward` | 落後 | 向後地 | Directions & Movements unit (was 落後) |
| `1370` | `slide` | 幻燈片 | 溜滑梯；滑動 | At the Playground unit (was 幻燈片) |
| `1377` | `lie` | 謊言 | 躺；說謊 | At the Playground unit (was 謊言 only) |
| `1401` | `American` | 美國 | 美國的；美國人 | The World unit adjective/noun (was 美國) |
| `1419` | `public` | 公開的 | 公共的；大眾的 | Public Transportation unit (was 公開的) |
| `1434` | `scooter` | 踏板車 | 速克達；輕型機車 | Transportation unit (was 踏板車) |
| `1440` | `gas` | 氣體 | 汽油；氣體 | Transportation unit after engine (was 氣體) |
| `1445` | `park` | 公園 | 停車 | Ways & Facilities before parking lot (was 公園; 1367 stays 公園) |
| `1447` | `block` | 區塊 | 街區 | Ways & Facilities unit (was 區塊) |
| `1451` | `cross` | 十字 | 穿越；橫過 | Ways & Facilities unit (was 十字) |
| `1454` | `platform` | 平台 | 月台 | Ways & Facilities before railroad (was 平台) |
| `1463` | `board` | 董事會 | 搭乘；登機 | Passengers & Drivers unit (was 董事會) |
| `1472` | `fine` | 很好 | 罰款 | Passengers & Drivers unit (was 很好) |
| `1487` | `meter` | 米 | 公尺 | Units of Measurement Taiwan usage (was 米) |
| `1490` | `yard` | 庭院 | 碼 | Units of Measurement unit (was 庭院; 1077 stays 庭院) |
| `1514` | `amount` | 金額 | 數量；總量 | Amount, Depth, Thickness unit (was 金額) |
| `1535` | `spot` | 現貨 | 斑點；地點 | Shapes and Marks unit (was 現貨) |
| `1538` | `can` | 可以 | 罐頭；一罐 | Quantities unit before bottle (was 可以; 1863 stays 可以) |
| `1542` | `pack` | 包包 | 一包；包裝 | Quantities unit (was 包包) |
| `1543` | `package` | 包包 | 包裹 | Quantities unit (was 包包) |
| `1545` | `dozen` | 十幾個 | 一打（十二個） | Quantities unit (was 十幾個) |
| `1547` | `sheet` | 片材 | 一張（紙） | Quantities unit (was 片材) |
| `1548` | `loaf` | 麵包 | 一條（麵包） | Quantities unit (was 麵包) |
| `1601` | `shower` | 淋浴 | 陣雨；淋浴 | Weather 1 unit after rain (was 淋浴 only) |
| `1631` | `star` | 明星 | 星星 | Earth & Universe after moon (was 明星) |
| `1633` | `rock` | 搖滾 | 岩石 | Earth & Universe before stone (was 搖滾; 0908 stays 搖滾) |
| `1645` | `bank` | 銀行 | 河岸 | Nature 1 after river (was 銀行; 1351 stays 銀行) |
| `1646` | `stream` | 流 | 小溪；溪流 | Nature 1 before pond (was 流) |
| `1658` | `plain` | 普通的 | 平原 | Nature 2 between island & mountain (was 普通的; 0829 stays 普通的) |
| `1675` | `smoke` | 抽煙 | 煙；冒煙 | Pollution unit after factory (was 抽煙) |
| `1684` | `mouse` | 滑鼠 | 老鼠 | Animals 1 before rat (was 滑鼠) |
| `1744` | `follow` | 關注 | 跟隨 | Opposite Actions 1 (was 關注) |
| `1749` | `take` | 採取 | 拿；帶走 | Opposite Actions 1 (was 採取) |
| `1750` | `hold` | 保持 | 握住；拿著 | Opposite Actions 1 (was 保持) |
| `1815` | `rather` | 相反 | 相當；寧願 | Degree adverbs unit (was 相反) |
| `1851` | `am` | 上午 | 是（I 的現在式） | Be & Auxiliaries between be and is (was 上午) |
| `1856` | `been` | 曾經 | 是（be 的過去分詞） | Be & Auxiliaries unit (was 曾經) |
| `1858` | `does` | 確實 | 做（do 的第三人稱單數） | Be & Auxiliaries unit (was 確實) |
| `1869` | `may` | 五月 | 可能；可以 | Modal Verbs unit (was 五月; 0519 May stays 五月) |
| `1874` | `which` | 其中 | 哪一個 | Wh-Words unit (was 其中) |
| `1888` | `goodbye / bye` | 再見/再見 | 再見 | Redundant "再見/再見" |
| `1891` | `the` | 的 | 這；那（定冠詞） | Articles unit (was 的) |
| `1913` | `you (object)` | 你（對象） | 你（受格） | Pronouns unit (was 你（對象）) |
| `1930` | `it (object)` | 它（對象） | 它（受格） | Pronouns unit (was 它（對象）) |
| `1967` | `over` | 結束 | 在…上方；越過 | Prepositions: Places (was 結束) |
| `1974` | `by` | 透過 | 在…旁邊 | Prepositions: Places (was 透過) |
| `1991` | `by` | 透過 | 在…之前 | Prepositions: Time (was 透過; 2006 stays 透過) |
| `1998` | `off` | 關閉 | 離開；脫離 | Prepositions: Movements (was 關閉) |
| `2021` | `so ... that` | 所以...那個 | 如此…以至於 | Conjunctions unit (was 所以...那個) |
| `2028` | `either ... or` | 要么...要么 | 不是…就是… | Conjunctions unit (was 要么...要么) |

---

## 2. Planned JSON Content Banks (To Be Populated in Later Milestones)

| File | Milestone | Status | Purpose |
|---|---|---|---|
| `data/walls.json` | M5 / M10 | Not created yet | Handcrafted 4×4 Connections-style walls (drafted & owner-reviewed first). |
| `data/tense.json` | M8 | Not created yet | Verb-form grammar items (drafted & owner-reviewed first). |
| `data/broadcast.json` | M10 | Not created yet | Dialogue cloze items (drafted & owner-reviewed first). |
| `data/class-rules.json` | M10 | Not created yet | Gacha rules for 第 13 節課. |
| `data/demo-seed.json` | M11 | Not created yet | Two weeks of clearly labelled sample learning data. |
| `tests/guess-eval.json` | M7 | Not created yet | 30-item evaluation set for 你說我猜 embedding ranking. |
