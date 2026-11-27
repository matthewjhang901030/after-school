# Báo Cáo Phiên Làm Việc Tự Động Qua Đêm (`overnight`)

- **Nhánh làm việc:** `overnight` (tách từ `main` tại commit `ea6f17a`, **không đụng tới `main`**)
- **Thời điểm hoàn tất:** 2026-11-28 00:31 (UTC+8)
- **Tuân thủ quy tắc:** Không khởi chạy hay tự động hóa trình duyệt; giữ nguyên `data/english-2000-data.js`; hoạt động khi bấm đúp `index.html` (`file://`); toàn bộ script dạng classic IIFE trên `window.App`, không dùng `innerHTML`, không dùng CSS gradient, không `fetch()` tệp cục bộ, không ảnh/âm thanh ngoài (SVG + CSS + Web Audio API tổng hợp trực tiếp).

---

## 1. Các Hạng Mục Đã Hoàn Thành & Commit Hash

| Thứ tự | Hạng mục | Commit | Ghi chú |
|---|---|---|---|
| 1 & 2 (gốc nhánh) | Đóng M6 (thêm mục backlog modal `'may'` cho M13 vào `docs/DECISIONS.md`) + Triển khai M7 **你說我猜** (MiniLM Blob Worker + IndexedDB cache + offline fallback ranker + rule checker + UI + test) | `ea6f17a` | Nền nhánh `overnight`. |
| 2b (DoD M7) | Thêm bộ đánh giá 30 câu `tests/guess-eval.js`, kiểm định tất cả 30 từ với card thực + rule checker, ghi số liệu vào `docs/DECISIONS.md` | `4522170` | 60/60 tests pass. |
| 3a (M8 Phần a, b, e) | Xây dựng lõi **第 13 節課**: vòng lặp sinh tồn (khoảng cách `12m → 0m`, tiết `90s`, mục tiêu `600 + 200×(p−1)`, `8s`/câu), 80 câu ngữ pháp động từ (`data/tense.js`), 40 câu hội thoại phát thanh (`data/broadcast.js`), ưu tiên từ sai, kiểm tra từng ký tự hỗ trợ nhiều đáp án (`didn't` / `did not`), nhân vật SVG co giãn với chữ sai viết mực đỏ (`creature.js`), màn hình kết thúc (`補考名單`, chữ hay gõ sai, AI giải thích, chuyển sang `你說我猜`), ghi `as.v1.attempts` & Leitner Hộp 1 | `a9c6257` | 64/64 tests pass. Đã sửa lỗi cắt dấu cách cuối tiền tố khi gõ đáp án có khoảng trắng (`did not`). |
| 4 (Quality Pass) | Quét toàn diện 61 JS, 11 CSS, toàn bộ i18n, walls/tense/broadcast/guess-eval và ngân sách JS; phát hiện & sửa câu `b-27` trong `data/broadcast.js` (chỗ trống đặt nhầm ở `lineA` và lộ đáp án ở `lineB`) + thêm kiểm định trong test | `6fc6bb1` | `QUALITY PASS: ZERO ISSUES`. |
| 3b (M8 Phần c & d — Full Mechanics + A11y) | Bổ sung đầy đủ cơ chế đặc biệt và trợ năng cho **第 13 節課**: vòng lặp `requestAnimationFrame` **fixed-timestep 50 ms**, tách hoàn toàn logic khỏi render (`supplies.js`, `questions.js`), **4 vật phẩm tiếp tế** (`下課鐘` đóng băng 5s, `慢速時鐘` giảm 50% tốc độ 8s, `立可白` đẩy +3m, `手電筒` mở 2 chữ cái — kích hoạt bằng phím `1`/`2`/`3` hoặc chạm), **phím ăn mòn `腐蝕鍵`** (khóa 3s, tối đa 3 phím cùng lúc, phím cũ nhất tự hồi phục), **xáo trộn bàn phím từ Tiết 3**, **thông báo phát thanh PA** + **âm thanh bước chân/nhịp tim tổng hợp bằng Web Audio API** (`atmosphere.js`), **8 thẻ nội quy 扭蛋機** (`data/class-rules.js`), vòng **chỉ nghe** (Tiết 3+ / `cr-audio`), nâng cấp **安心模式** (chậm hơn `0.7×`, `12s`/câu, dễ đọc, tắt toàn bộ kinh dị/âm thanh/rung/nhấp nháy/ăn mòn/xáo trộn), hỗ trợ điều khiển **100% bằng bàn phím** (`Esc` tạm dừng, `1–3` tiếp tế, `Enter` sang tiết), `prefers-reduced-motion`, nhấp nháy đèn `0.42 Hz` (`< 3 lần/giây`) | `7689e3f` | 65/65 tests pass, `QUALITY PASS: ZERO ISSUES`. |
| 5 (Báo cáo) | Cập nhật báo cáo tiếng Việt `docs/OVERNIGHT_REPORT.md` trên nhánh `overnight` | *(commit cuối trên `overnight`)* | Hoàn tất toàn bộ kế hoạch + phần bổ sung M8. |

---

## 2. Những Phần Bị Lỗi Hoặc Bỏ Qua

- **Không có hạng mục nào bị lỗi hay bỏ qua.** Toàn bộ yêu cầu ban đầu (M6 close-out, M7, M8, Quality Pass) và yêu cầu bổ sung (M8 phần a–e, fixed timestep, Web Audio không tệp ngoài, tách logic/render, `安心模式` + trợ năng) đều đã hoàn thành và vượt qua toàn bộ kiểm thử tự động.
- **Lưu ý rà soát buổi sáng:** Nội dung tiếng Anh mới (`data/tense.js` 80 câu và `data/broadcast.js` 40 câu) đã được liệt kê trong `docs/CONTENT.md` để bạn rà soát tự nhiên/chính xác trước Demo 1.

---

## 3. Các Quyết Định Kỹ Thuật Đã Thực Hiện Thay Bạn

Ghi đầy đủ tại `docs/DECISIONS.md` (mục #32, #33, #34):

1. **Tập ứng viên giới hạn 19 từ cho `你說我猜` (M7):** Chọn từ mục tiêu + **18 từ gây nhiễu** cùng bài/chương/từ loại (`buildCandidates`), kèm bộ đánh giá 30 câu `tests/guess-eval.js` (bản ngoại tuyến đạt `5/30` top-3 trên tập cùng chủ đề khó, xác nhận MiniLM embedding là bộ xếp hạng ngữ nghĩa chính).
2. **Kiến trúc tách logic/render + fixed-timestep 50 ms cho `第 13 節課` (M8):**
   - `questions.js` và `supplies.js` hoàn toàn thuần logic (0 DOM), có hàm `stepSimulation(ms)` giúp test chính xác từng mốc thời gian (`3000 ms` hồi phím ăn mòn, `5000 ms` đóng băng, `8000 ms` giảm tốc).
   - `atmosphere.js` tổng hợp 100% bằng Web Audio API (bước chân low-pass theo khoảng cách, nhịp tim `< 3 m`), chỉ mở khóa sau thao tác bấm **「進教室」**, tắt hoàn toàn khi bật `安心模式` hoặc `unmount()`.
3. **Thông số `安心模式` (`safeMode`) dễ đọc và thân thiện:** Giảm tốc độ tiến lại còn **`0.70×`**, kéo dài thời gian mỗi câu từ `8 s` lên **`12 s`**, đổi nền hành lang sang tông giấy sáng độ tương phản cao, tắt hoàn toàn tiếng bước chân/nhịp tim, rung màn hình, chớp đèn, màn đen 0.6s, phím ăn mòn và xáo trộn bàn phím.
4. **An toàn quang học (WCAG):** Hiệu ứng nhấp nháy đèn huỳnh quang (chỉ bật khi tắt `安心模式` và không có `prefers-reduced-motion`) có chu kỳ `2.4 s` (`0.42` lần/giây — thấp hơn rất nhiều so với ngưỡng tối đa `3` lần/giây).

---

## 4. Danh Sách Kiểm Tra Thủ Công Sáng Nay (Chrome / Edge / Dia qua `file://`)

> Chuyển sang nhánh `overnight` (`git checkout overnight`), sau đó bấm đúp mở `tests/test.html` và `index.html`.

### Bước 1 — Chạy kiểm thử tự động (`tests/test.html`)
- **Mở:** Bấm đúp `tests/test.html`.
- **Thấy gì:** Khung tóm tắt màu xanh hiển thị **`65 passed, 0 failed (65 total) · file:`**, không có mục `✗ FAIL`.

### Bước 2 — Kiểm tra M7: **你說我猜** (`#/games/guess`)
1. Vào **遊戲 → 你說我猜**.
2. Bấm **「離線模式開始」** → xác nhận nhãn **`離線版本`**, thẻ mục tiêu + nghĩa tiếng Trung + nút phát âm + **3 từ cấm**, đồng hồ **60s**.
3. Thử gõ tiếng Trung (`請用英文描述`), gõ 2 từ (`再多寫一點`), gõ chứa đáp án/dạng chia (`不能直接說出答案`, gạch đỏ), gõ chứa từ cấm (`不能使用禁忌字`, chip nổi bật).
4. Quay lại màn hình đầu, bấm **「開始遊戲（MiniLM AI）」** → tải/đọc cache MiniLM (~22.6 MB), nhãn đổi sang **`MiniLM · WebGPU`** hoặc **`MiniLM · WASM`**, gõ mô tả tiếng Anh 4–30 từ → AI mở lần lượt top-3 dự đoán kèm thanh phần trăm.
5. Bỏ qua 1 câu, hoàn thành 5 câu → kiểm tra `本輪詞彙回顧`, rồi mở **今日複習 (`#/review`)** xác nhận từ bỏ qua đã vào Hộp 1 đến hạn hôm nay.

### Bước 3 — Kiểm tra M8: **第 13 節課** (`#/games/class13`) — Chế độ thường
1. Vào **遊戲 → 第 13 節課**, để **安心模式** tắt, kiểm tra hộp **夜間教室氛圍提醒** (có ô "下次不再顯示此提醒") rồi bấm **「進教室」**.
2. Vào **第 1 節**:
   - Thấy thanh thông báo PA (`廣播：...`), cửa hành lang có bóng đen SVG + thanh khoảng cách `12.0 m`, máy chiếu câu hỏi (`8s`), thanh 2 ô tiếp tế `[1] 空補給槽 [2] 空補給槽`, và bàn phím ảo bên dưới.
   - Nghe tiếng bước chân trầm nhỏ dần/to dần theo khoảng cách (và tiếng nhịp tim khi `< 3.0 m`).
3. **Phím ăn mòn (`腐蝕鍵`):** Cố tình gõ sai 4 phím khác nhau liên tiếp (vd `z`, `x`, `q`, `j`) → thấy tối đa **3 phím** bị nhuộm đỏ khóa trên bàn phím ảo (phím đầu tự hồi ngay khi phím thứ 4 bị ăn mòn), gõ lại phím đang khóa trên bàn phím vật lý sẽ hiện thông báo khóa và không bị trừ thêm khoảng cách; đợi 3 giây phím tự hồi.
4. **Tiếp tế (`Supply crates`):** Gõ đến câu thứ 6 (viền đỏ **`補給難題`**) và gõ đúng → nhận 1 vật phẩm vào ô `[1]` (`下課鐘` / `慢速時鐘` / `立可白` / `手電筒`). Nhấn phím **`1`** (hoặc bấm nút) để kích hoạt và xác nhận hiệu ứng (đóng băng `凍結 5s`, giảm tốc `減速 8s`, đẩy `+3.0m`, hoặc mở 2 chữ cái).
5. **Tạm dừng & Đổi tab:** Nhấn **`Esc`** (hoặc chuyển sang tab khác) → hiện màn hình tạm dừng, đồng hồ và âm thanh dừng hẳn; nhấn `Esc` hoặc **繼續遊戲** để tiếp tục.
6. **Qua Tiết & 扭蛋機:** Đạt `600` điểm ở Tiết 1 → hiện màn hình **第 1 節下課** kèm thẻ **扭蛋機 · 第 2 節班規** (1 trong 8 nội quy ngẫu nhiên). Nhấn **`Enter`** (hoặc bấm nút) vào Tiết 2 → xác nhận thẻ nội quy hiện ở thanh trên, câu hội thoại phát thanh `A: ... / B: ... ___ ...` xuất hiện (gõ được cả `didn't` lẫn `did not`). Lên **Tiết 3** → xác nhận nhãn **`鍵盤已打亂`** và bàn phím ảo đã xáo trộn vị trí.
7. **Thua & Màn kết thúc:** Để khoảng cách về `0.0 m` → chớp đen `0.6s`, hiện con dấu đỏ **`不及格`**, **`補考名單`**, **`最常打錯的字母`**, nút **「請 AI 解釋錯題」** (mở khung AI M6) và **「用這些錯字玩你說我猜」** (chuyển sang `#/games/guess?words=...`).

### Bước 4 — Kiểm tra M8: **安心模式** (`safeMode`)
1. Quay lại màn hình đầu **第 13 節課**, bật **安心模式**, bấm **「進教室」**.
2. Xác nhận: **không** có tiếng bước chân/nhịp tim, **không** rung/nhấp nháy/màn đen, hành lang nền giấy sáng dễ đọc, chữ chiếu lớn hơn, thời gian mỗi câu dài hơn (`12s`), tốc độ tiến chậm hơn (`0.7×`), gõ sai **không** bị phím ăn mòn, và đến Tiết 3 **không** bị xáo trộn bàn phím.

---

## 5. Kích Thước Bundle & Kết Quả Kiểm Thử Hiện Tại

- **Initial-load JS (`index.html`, 27 script lõi):** **`202.4 KB`** (dưới ngân sách `300 KB` — còn dư `97.6 KB`)
- **Tổng kích thước toàn bộ `js/` (bao gồm toàn bộ game & AI lazy-load):** `668.3 KB`
- **Ngân hàng dữ liệu lazy-load:** `data/walls.js` (`15.9 KB`), `data/tense.js` (`11.2 KB`), `data/broadcast.js` (`6.0 KB`), `data/class-rules.js` (`2.7 KB`)
- **i18n parity:** `zh-TW = 442` khóa, `en = 442` khóa (0 khóa thiếu, 0 dấu `!`/`！`)
- **Kiểm thử tự động (`tests/smoke.test.js`):** **`65 passed, 0 failed (65 total)`**
- **Quality pass tĩnh:** **`QUALITY PASS: ZERO ISSUES`** (64 tệp JS, 11 tệp CSS; 0 `innerHTML`, 0 CSS gradient, 0 `z-index > 100`, 0 `setInterval` trong game, `data/english-2000-data.js` nguyên vẹn).
