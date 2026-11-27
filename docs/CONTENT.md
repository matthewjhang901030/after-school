# Authored English Learning Content (`docs/CONTENT.md`)

All handwritten English learning content authored for **放學後 After School** is listed here for project-owner review.

- **Vocabulary target:** Taiwanese university students at a basic 2,000-word level (`data/english-2000-data.js`).
- **Validation:** Every wall below is automatically checked by `js/games/wall/validate.js` (4 groups × 4 unique items, ≤ 3 words per tile, all 3 skills `vocab` / `grammar` / `dialogue` present, all vocabulary words verified against the active 2,000-word list).

---

## 1. 四格分類牆 — Curated Walls (`data/walls.js`, 12 walls for M5; expanding to 30 by T3)

### `w-01` · 校園放學後 (After-school campus)
- **Red herring:** `a note` tempts stationery (`notebook`), and `took` is the past form of `take`.

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | Study supplies / 書包文具 | `notebook`, `pencil`, `eraser`, `chalk` | 教室與書包裡常見的學習用品。 |
| 2 | `grammar` | Irregular past tense / 不規則過去式 | `went`, `ate`, `saw`, `took` | 不加 -ed 的常見動詞過去式（go / eat / see / take）。 |
| 3 | `dialogue` | Replies to "Thank you" / 回應「謝謝」 | `You're welcome`, `No problem`, `My pleasure`, `Anytime` | 別人道謝時，日常對話中最自然的四種回應。 |
| 4 | `vocab` | Take ___ collocations / 搭配 take 的片語 | `a break`, `a note`, `a seat`, `a shower` | 四個名詞片語都常接在動詞 take 後面（take a break / note / seat / shower）。 |

### `w-02` · 天氣與求助 (Weather and asking for help)
- **Red herring:** `may` looks like a month/season word alongside `spring`, `summer`, `autumn`, `winter`.

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | Weather / 天氣詞彙 | `rain`, `wind`, `snow`, `fog` | 描述雨、風、雪、霧等常見天氣現象的名詞。 |
| 2 | `vocab` | Four seasons / 一年四季 | `spring`, `summer`, `autumn`, `winter` | 春、夏、秋、冬四個季節名稱。 |
| 3 | `grammar` | Modal verbs / 情態助動詞 | `can`, `could`, `should`, `may` | 放在原形動詞前，表達能力、請求或建議的助動詞（may 容易被誤看成五月）。 |
| 4 | `dialogue` | Asking for help / 開口請人幫忙 | `Could you help?`, `Help me out`, `Got a second?`, `Can you help me?` | 需要同學或路人協助時常用的簡短英文開頭。 |

### `w-03` · 餐桌與點餐 (At the table)
- **Red herring:** `cut` tempts kitchen/tableware (`knife`); `orange` can look like a color.

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | Tableware / 常見餐具 | `spoon`, `fork`, `knife`, `plate` | 餐桌上使用的湯匙、叉子、餐刀與盤子。 |
| 2 | `vocab` | Fruits / 常見水果 | `apple`, `banana`, `grape`, `orange` | 四種日常水果名稱（orange 也常被當成顏色）。 |
| 3 | `grammar` | Same base and past form / 三態同形動詞 | `cut`, `put`, `hit`, `cost` | 原形、過去式與過去分詞拼法完全相同的動詞（cut 容易被誤分到餐具）。 |
| 4 | `dialogue` | Ordering food / 餐廳點餐與結帳 | `I'll have this`, `Check, please`, `For here`, `To go` | 在咖啡廳或餐廳點餐、決定內用外帶與結帳的實用短句。 |

### `w-04` · 每天的步調 (Daily rhythm)
- **Red herring:** `hot` and `sweet` tempt drink collocations (`coffee`, `tea`).

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | Drinks / 常見飲品 | `coffee`, `tea`, `milk`, `water` | 每天最常喝到的四種飲料。 |
| 2 | `grammar` | Frequency adverbs / 頻率副詞 | `always`, `usually`, `often`, `never` | 表示動作發生頻率的副詞，通常放在一般動詞前或 be 動詞後。 |
| 3 | `dialogue` | Ways to agree / 表示同意 | `Good idea`, `Sounds good`, `I agree`, `Fair enough` | 在對話中贊成對方提議時的自然說法。 |
| 4 | `vocab` | Tastes and temperature / 味覺與口感 | `sweet`, `sour`, `bitter`, `hot` | 形容食物味道或辣度的形容詞（hot 和 sweet 容易讓人聯想到飲品）。 |

### `w-05` · 通勤與問路 (On the commute)
- **Red herring:** `Across from` and spatial prepositions (`behind`, `between`) overlap closely.

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | City transport / 城市交通工具 | `subway`, `train`, `taxi`, `bicycle` | 上下學通勤時會搭到或騎到的交通工具。 |
| 2 | `vocab` | Parts of a building / 建築構造 | `door`, `window`, `floor`, `stairs` | 進出大樓或教室時常見的建築部位。 |
| 3 | `grammar` | Prepositions of place / 地方介系詞 | `under`, `above`, `between`, `behind` | 描述物體相對位置的介系詞（容易與指路用語混淆）。 |
| 4 | `dialogue` | Asking and giving directions / 問路與指路 | `Which way?`, `Turn left`, `Go straight`, `Across from` | 在街上開口問路或指引方向時的常用語。 |

### `w-06` · 身體不舒服 (Under the weather)
- **Red herring:** `head` tempts `headache`; `cold` also looks like weather/temperature.

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | Cold symptoms / 感冒與不適症狀 | `fever`, `cough`, `headache`, `cold` | 看醫生時常提到的身體症狀（cold 也是「冷的」）。 |
| 2 | `vocab` | Body parts / 身體部位 | `head`, `heart`, `stomach`, `shoulder` | 常見的人體部位名詞（head 容易和 headache 混在一起）。 |
| 3 | `grammar` | Subordinating conjunctions / 從屬連接詞 | `because`, `although`, `while`, `until` | 連接主要子句與原因、讓步或時間子句的連接詞。 |
| 4 | `dialogue` | Showing care / 關心對方 | `Take care`, `Get well soon`, `Feel better`, `Are you okay?` | 朋友生病或疲累時表達關心的自然用語。 |

### `w-07` · 逛街與付錢 (Shopping and money)
- **Red herring:** `fine` looks like a conversational response ("I'm fine") rather than a fee/penalty.

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | Clothes and accessories / 衣著與配件 | `jacket`, `sweater`, `scarf`, `tie` | 天氣微涼或正式場合會穿戴的服飾配件。 |
| 2 | `vocab` | Money and payment / 金錢與費用 | `cash`, `coin`, `bill`, `fine` | 與付款、帳單或罰款相關的名詞（fine 也常被當成「很好」的回應）。 |
| 3 | `grammar` | Irregular comparatives / 不規則比較級 | `better`, `worse`, `farther`, `less` | 不加 -er 也不加 more 的特殊比較級（good / bad / far / little）。 |
| 4 | `dialogue` | Polite declines / 委婉拒絕 | `Maybe later`, `No, thanks`, `Not today`, `I'll pass` | 不想買或婉拒邀約時，有禮貌又不尷尬的說法。 |

### `w-08` · 職場與見面 (People and greetings)
- **Red herring:** `waiter` and `clerk` look like professions alongside `doctor`, `nurse`, `lawyer`, `engineer`.

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | Professions / 專業職業 | `doctor`, `nurse`, `lawyer`, `engineer` | 需要專業執照或訓練的職業名稱（waiter 與 clerk 是服務場合的誘答）。 |
| 2 | `vocab` | People at a shop or hotel / 服務場合人物 | `guest`, `customer`, `waiter`, `clerk` | 在餐廳、商店或飯店中會遇到的人員與顧客。 |
| 3 | `grammar` | WH-question words / 疑問詞 | `who`, `where`, `whose`, `which` | 放在問句開頭，用來詢問人物、地點、所有權或選擇的疑問詞。 |
| 4 | `dialogue` | Everyday greetings / 見面打招呼 | `Hi there`, `Good morning`, `Good evening`, `What's up?` | 在不同時段或輕鬆場合見到朋友時的招呼語。 |

### `w-09` · 大自然探索 (Exploring nature)
- **Red herring:** `bear` is both an animal and a verb; `broken`/`written` test `-en` participle recognition.

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | Nature and landforms / 自然景觀 | `mountain`, `river`, `forest`, `island` | 山、河、森林與島嶼等戶外地景名詞。 |
| 2 | `vocab` | Wild animals / 野生動物 | `tiger`, `elephant`, `monkey`, `bear` | 四種常見野生動物（bear 同時也能當動詞「忍受」）。 |
| 3 | `grammar` | Past participles ending in -en / -en 結尾過去分詞 | `broken`, `chosen`, `eaten`, `written` | 完成式與被動語態中以 -en 結尾的過去分詞（break / choose / eat / write）。 |
| 4 | `dialogue` | Expressing surprise / 表達驚訝 | `No way`, `Really?`, `Seriously?`, `Are you sure?` | 聽到意想不到的消息時，口語中最常脫口而出的反應。 |

### `w-10` · 家裡的一角 (Around the house)
- **Red herring:** `table` and `kitchen` strongly associate across rooms and furniture.

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | Spaces at home / 居家空間 | `kitchen`, `bedroom`, `bathroom`, `garden` | 家裡各個功能空間與庭院的名稱。 |
| 2 | `vocab` | Furniture / 常見家具 | `table`, `chair`, `sofa`, `desk` | 擺放在客廳、書房或餐廳的家具（table 容易被誤放進廚房空間）。 |
| 3 | `grammar` | Adjectives ending in -ful / -ful 字尾形容詞 | `careful`, `helpful`, `useful`, `wonderful` | 加上字尾 -ful 表示「充滿……特質」的形容詞。 |
| 4 | `dialogue` | Apologizing / 道歉用語 | `My bad`, `I'm sorry`, `Excuse me`, `Sorry about that` | 不小心做錯事或打擾別人時常用的道歉說法。 |

### `w-11` · 時間與約會 (Time and making plans)
- **Red herring:** `yesterday`, `today`, `tomorrow` overlap with days of the week (`Monday`–`Sunday`).

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | Days of the week / 星期幾 | `Monday`, `Wednesday`, `Friday`, `Sunday` | 一週七天中的四個星期名稱，字首永遠大寫。 |
| 2 | `vocab` | Months of the year / 月份 | `January`, `April`, `August`, `October` | 一年十二個月中的四個月份名稱，字首永遠大寫。 |
| 3 | `grammar` | Time adverbs / 時間副詞 | `yesterday`, `today`, `tomorrow`, `already` | 用來標示過去、現在、未來或已完成狀態的時間副詞（容易與星期混在一起）。 |
| 4 | `dialogue` | Making plans / 約見面與回應邀約 | `Are you free?`, `Let's meet up`, `Sounds like fun`, `Count me in` | 和朋友約時間出門或開心答應邀約時的自然短句。 |

### `w-12` · 藝文與道別 (Arts and saying goodbye)
- **Red herring:** `theater` and `museum` strongly link with arts (`music`, `movie`, `drama`, `poem`).

| Level | Skill | Group (EN / ZH) | Items | Rule (ZH) |
|---|---|---|---|---|
| 1 | `vocab` | Arts and entertainment / 藝文與娛樂 | `music`, `movie`, `drama`, `poem` | 音樂、電影、戲劇與詩歌等藝文領域名詞。 |
| 2 | `vocab` | Places in town / 市區公共場所 | `museum`, `theater`, `library`, `park` | 週末常去的公共地點（theater 與 museum 容易和藝文領域混淆）。 |
| 3 | `grammar` | Reflexive pronouns / 反身代名詞 | `myself`, `yourself`, `himself`, `themselves` | 表示「……自己」的反身代名詞，單數結尾為 -self，複數為 -selves。 |
| 4 | `dialogue` | Saying goodbye / 道別用語 | `See you later`, `Take it easy`, `Good night`, `Talk soon` | 聚會結束或放學分開時常用的自然道別語。 |

---

## Planned Future Content Banks (Not Yet Authored)
- `data/walls.js`: expand from 12 → 30 walls by T3.
- `data/tense.js` (M8): 80 verb-form items.
- `data/broadcast.js` (M10): 40 dialogue cloze items.
- `data/class-rules.js` (M10): 8 class-rule gacha cards.

---

## M8 Content Banks for Owner Review

### 1. Verb-Form Grammar Bank (`data/tense.js` — 80 items)

- **Irregular past tense (`t-01`–`t-30`, 30 items):** `go→went`, `eat→ate`, `see→saw`, `take→took`, `write→wrote`, `give→gave`, `come→came`, `make→made`, `buy→bought`, `bring→brought`, `think→thought`, `teach→taught`, `catch→caught`, `find→found`, `know→knew`, `tell→told`, `say→said`, `keep→kept`, `leave→left`, `feel→felt`, `meet→met`, `run→ran`, `begin→began`, `drink→drank`, `sing→sang`, `swim→swam`, `break→broke`, `speak→spoke`, `drive→drove`, `ride→rode`.
- **Past participle (`t-31`–`t-50`, 20 items):** `go→gone`, `eat→eaten`, `see→seen`, `take→taken`, `write→written`, `give→given`, `know→known`, `break→broken`, `choose→chosen`, `speak→spoken`, `drive→driven`, `ride→ridden`, `drink→drunk`, `sing→sung`, `swim→swum`, `begin→begun`, `fly→flown`, `grow→grown`, `show→shown`, `do→done`.
- **Third-person singular (`t-51`–`t-65`, 15 items):** `study→studies`, `carry→carries`, `try→tries`, `fly→flies`, `worry→worries`, `watch→watches`, `wash→washes`, `teach→teaches`, `finish→finishes`, `miss→misses`, `fix→fixes`, `go→goes`, `do→does`, `have→has`, `play→plays`.
- **Present participle `-ing` (`t-66`–`t-80`, 15 items):** `make→making`, `write→writing`, `come→coming`, `take→taking`, `have→having`, `run→running`, `swim→swimming`, `sit→sitting`, `stop→stopping`, `plan→planning`, `begin→beginning`, `lie→lying`, `die→dying`, `study→studying`, `shop→shopping`.

### 2. Broadcast Dialogue Cloze Bank (`data/broadcast.js` — 40 items)

| ID | Line A | Line B (Cloze) | Accepted Answers |
|---|---|---|---|
| `b-01` | Where were you last night? | I ___ at home studying. | `was` |
| `b-02` | Did you finish the report? | No, I ___ finish it yet. | `didn't`, `did not` |
| `b-03` | What is Mia doing now? | She is ___ a letter to her aunt. | `writing` |
| `b-04` | How do you go to campus? | I usually ___ the bus. | `take` |
| `b-05` | Have you ever been to Tainan? | Yes, I ___ there twice. | `have been`, `went` |
| `b-06` | Why is the floor wet? | Someone ___ a cup of water. | `dropped`, `spilled` |
| `b-07` | Are you free this Friday? | Sorry, I ___ to work late. | `have` |
| `b-08` | Whose umbrella is this? | It belongs ___ Ken. | `to` |
| `b-09` | Can you speak Japanese? | Yes, I ___ speak a little. | `can` |
| `b-10` | Where did Leo go? | He ___ to the library. | `went` |
| `b-11` | Thank you for helping me. | You are ___. | `welcome` |
| `b-12` | What time does class start? | It ___ at nine sharp. | `starts`, `begins` |
| `b-13` | Is there any milk left? | No, there ___ any left. | `isn't`, `is not` |
| `b-14` | How many books did you borrow? | I ___ three books today. | `borrowed` |
| `b-15` | Do you want tea or coffee? | I ___ like hot tea, please. | `would` |
| `b-16` | Why did you bring a coat? | Because it is ___ outside. | `cold`, `freezing` |
| `b-17` | Where were they at noon? | They ___ eating lunch together. | `were` |
| `b-18` | Did Emma call you back? | Yes, she ___ me an hour ago. | `called` |
| `b-19` | What will you do tomorrow? | I ___ visit my grandparents. | `will` |
| `b-20` | Excuse me, how much is this pen? | It ___ fifty dollars. | `costs`, `is` |
| `b-21` | Why is Sam smiling so much? | He ___ the math exam. | `passed` |
| `b-22` | Could you open the window? | Sure, no ___. | `problem` |
| `b-23` | How long have you lived here? | I have lived here ___ five years. | `for` |
| `b-24` | When is your birthday? | It is ___ October. | `in` |
| `b-25` | When does the store open? | It opens ___ Monday morning. | `on` |
| `b-26` | Is your sister taller than you? | Yes, she is taller ___ me. | `than` |
| `b-27` | Is the Zhuoshui River long? | Yes, it is the ___ river in Taiwan. | `longest` |
| `b-28` | Did you remember to lock the door? | Oh no, I ___ to lock it. | `forgot` |
| `b-29` | Who broke this glass? | The cat ___ it off the table. | `knocked`, `pushed` |
| `b-30` | Would you mind turning down the music? | Not at ___. | `all` |
| `b-31` | What did you have for breakfast? | I ___ a sandwich and milk. | `had`, `ate` |
| `b-32` | Where is my notebook? | Look, it is ___ the desk. | `on` |
| `b-33` | Are you ready to order? | Yes, I will ___ the beef noodles. | `have`, `take`, `order` |
| `b-34` | Why are you late today? | I ___ the early train. | `missed` |
| `b-35` | Do you know where Ben lives? | He ___ near the night market. | `lives` |
| `b-36` | Can I borrow your eraser? | Here you ___. | `are` |
| `b-37` | How was the movie last weekend? | It ___ really exciting. | `was` |
| `b-38` | You look tired today. | I did not ___ well last night. | `sleep` |
| `b-39` | Where can I buy fresh fruit? | You can buy some ___ the market. | `at`, `in` |
| `b-40` | See you tomorrow morning. | Take ___, see you then. | `care` |
