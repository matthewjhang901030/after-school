# Báo Cáo Phiên Làm Việc Tự Động Qua Đêm (`overnight`)

- **Nhánh làm việc:** `overnight` (tách từ `main` tại commit `ea6f17a`, **không đụng tới `main`**)
- **Thời điểm hoàn tất:** 2026-11-28 00:25 (UTC+8)
- **Tuân thủ quy tắc:** Không khởi chạy hay tự động hóa trình duyệt; giữ nguyên `data/english-2000-data.js`; hoạt động khi bấm đúp `index.html` (`file://`); toàn bộ script dạng classic IIFE trên `window.App`, không dùng `innerHTML`, không dùng CSS gradient, không `fetch()` tệp cục bộ.

---

## 1. Các Hạng Mục Đã Hoàn Thành & Commit Hash

| Thứ tự | Hạng mục | Commit | Ghi chú |
|---|---|---|---|
| 1 & 2 (trước khi tách nhánh) | Đóng M6 (thêm mục backlog modal `'may'` cho M13 vào `docs/DECISIONS.md`) + Triển khai đầy đủ M7 **你說我猜** (MiniLM Blob Worker + IndexedDB cache + offline fallback ranker + rule checker + giao diện + test) | `ea6f17a` (gốc nhánh `overnight`) | Đã có sẵn trên nhánh nền khi tách `overnight`. |
| 2b (Hoàn thiện DoD M7) | Thêm bộ đánh giá 30 câu `tests/guess-eval.js`, kiểm thử toàn bộ 30 từ với card thực và rule checker, ghi kết quả đo thực tế vào `docs/DECISIONS.md` | `4522170` | 60/60 tests pass. |
| 3 (M8 **第 13 節課** Core) | Xây dựng hoàn chỉnh lõi game **第 13 節課**: ngân hàng 80 câu ngữ pháp động từ (`data/tense.js`), 40 câu hội thoại phát thanh (`data/broadcast.js`), bộ sinh câu hỏi + ưu tiên từ sai (`js/games/class13/questions.js`), kiểm tra từng ký tự hỗ trợ nhiều đáp án (`didn't` / `did not`), nhân vật SVG co giãn theo khoảng cách với chữ sai viết bằng mực đỏ (`js/games/class13/creature.js`), giao diện chơi + đồng hồ 90s/tiết & 8s/câu + tạm dừng khi đổi tab + màn hình kết thúc (`補考名單`, chữ hay gõ sai, nút AI giải thích, nút chuyển sang `你說我猜`), lazy-load, i18n `zh-TW`/`en`, và bộ test M8 | `a9c6257` | 64/64 tests pass. Đã sửa lỗi cắt dấu cách cuối chuỗi tiền tố khi gõ đáp án có khoảng trắng (`did not`). |
| 4 (Quality Pass) | Quét toàn diện 61 tệp JS, 11 tệp CSS, 421 khóa i18n, kiểm định 12 walls, 80 câu `tense`, 40 câu `broadcast`, 30 câu `guess-eval`, và ngân sách JS; phát hiện & sửa lỗi câu `b-27` trong `data/broadcast.js` (chỗ trống `___` bị đặt ở `lineA` thay vì `lineB` và lộ đáp án) + thêm kiểm định tự động trong `tests/smoke.test.js` | `6fc6bb1` | `QUALITY PASS: ZERO ISSUES`, 64/64 tests pass. |
| 5 (Báo cáo) | Viết và đẩy báo cáo `docs/OVERNIGHT_REPORT.md` | *(commit tiếp theo trên `overnight`)* | Hoàn tất toàn bộ kế hoạch. |

---

## 2. Những Phần Bị Lỗi Hoặc Bỏ Qua

- **Không có tác vụ nào thất bại hay bị bỏ qua trong danh sách 1–4.**
- **Các phần cố ý giữ lại cho M10 (đúng theo Appendix A của `docs/spec/part10.md`):**
  - Âm thanh bước chân / nhịp tim Web Audio, khóa phím ăn mòn (key rot giới hạn 3 phím), xáo trộn bàn phím từ tiết 3, hòm tiếp tế (supply crates), vòng chỉ nghe (audio-only), và rút thẻ nội quy lớp học (gacha `data/class-rules.json`) thuộc phạm vi **M10**, chưa đưa vào M8 core để giữ phạm vi sạch và dễ kiểm thử.
  - Nội dung tiếng Anh mới (`data/tense.js` 80 câu và `data/broadcast.js` 40 câu) đã được liệt kê đầy đủ trong `docs/CONTENT.md` để bạn rà soát lại vào buổi sáng.

---

## 3. Các Quyết Định Kỹ Thuật Đã Thực Hiện Thay Bạn

Tất cả đều đã được ghi lại trong `docs/DECISIONS.md` (mục #32 và #33):

1. **Tập ứng viên giới hạn 19 từ cho `你說我猜` (M7):** Chọn từ mục tiêu + **18 từ gây nhiễu** cùng bài/chương/từ loại trong bộ thẻ đang chọn (`buildCandidates`), giúp MiniLM chạy tức thì và tạo độ khó gần nghĩa hợp lý (`bookstore` vs `library`).
2. **Đánh giá thực tế `tests/guess-eval.js`:** Trên tập 19 ứng viên cùng chủ đề, bộ xếp hạng dự phòng ngoại tuyến (`rankOffline`) đạt `5/30` (`16.7%`) top-3 vì các từ cùng chương dùng chung gợi ý chủ đề và nhiều thẻ gốc không có câu ví dụ thật; vì vậy xếp hạng ngữ nghĩa vẫn ưu tiên mô hình `Xenova/all-MiniLM-L6-v2` (tải qua Blob Worker + lưu vector vào IndexedDB), còn bản ngoại tuyến đóng vai trò dự phòng khi không có mạng.
3. **Đưa sẵn `data/broadcast.js` (40 câu hội thoại phát thanh) vào M8 (từ Tiết 2):** Dù M8 core yêu cầu tối thiểu nghĩa→từ và chia động từ, việc bổ sung luôn câu hội thoại điền khuyết từ Tiết 2 giúp **第 13 節課** bao phủ đủ cả 3 kỹ năng (`單字 + 文法 + 對話`) ngay trong Demo 1.
4. **Hỗ trợ cả 2 chế độ phím & cảnh báo nội dung ngay từ M8:** Gắn song song bàn phím vật lý (`window keydown`) và bàn phím ảo `App.keyboard` (thân thiện di động), kèm hộp cảnh báo không khí lớp học đêm có nút "không hiện lại" (`settings.class13WarningDismissed`) và công tắc **安心模式** (`safeMode`) tắt rung/hiệu ứng đen màn hình.

---

## 4. Quy Trình Kiểm Tra Thủ Công Sáng Nay (Chrome / Edge / Dia qua `file://`)

> Trước khi kiểm tra, hãy chuyển sang nhánh `overnight` (`git checkout overnight`), sau đó bấm đúp mở `index.html` và `tests/test.html`.

### Bước 1 — Chạy bộ test tự động trên trình duyệt
- **Trang:** Bấm đúp `tests/test.html`
- **Kết quả kỳ vọng:** Thanh tóm tắt màu xanh lá hiển thị **`64 passed, 0 failed (64 total) · file:`**, không có dòng lỗi đỏ.

### Bước 2 — Kiểm tra M7: **你說我猜** (`#/games/guess`)
1. Vào **遊戲 → 你說我猜** (`#/games/guess`).
2. **Chế độ ngoại tuyến:** Bấm **「離線模式開始」** → thấy nhãn **`離線版本`**, thẻ từ mục tiêu + nghĩa tiếng Trung + nút loa phát âm + **3 từ cấm (`禁忌字`)** và đồng hồ đếm ngược **60s**.
3. **Kiểm tra bộ lọc luật:**
   - Gõ tiếng Trung → bị chặn với thông báo `請用英文描述`.
   - Gõ 2–3 từ tiếng Anh → bị chặn với `再多寫一點（至少 4 個英文字）`.
   - Gõ chứa từ đáp án hoặc dạng chia (`-s`, `-ed`, `-ing`) → bị chặn, từ vi phạm bị gạch đỏ (`不能直接說出答案`).
   - Gõ chứa 1 trong 3 từ cấm (hoặc dạng chia) → bị chặn, chip từ cấm tương ứng nổi bật màu đỏ (`不能使用禁忌字`).
4. **Chế độ AI Embedding (MiniLM):** Quay lại màn hình bắt đầu, bấm **「開始遊戲（MiniLM AI）」** → thấy thanh tiến trình tải ~22.6 MB (từ lần 2 trở đi tải gần như ngay lập tức), nhãn đổi sang **`MiniLM · WebGPU`** hoặc **`MiniLM · WASM`**. Gõ mô tả tiếng Anh 4–30 từ → AI hiện khung hội thoại và **lần lượt mở 3 dự đoán hàng đầu kèm thanh phần trăm**.
5. **Kiểm tra nối vòng lặp Ôn tập:** Bấm **「跳過這題」** 1 câu rồi hoàn thành 5 câu → xem màn hình kết thúc (tổng điểm, `本輪詞彙回顧`, nút `查看卡片`/`加入卡組`), sau đó mở **今日複習 (`#/review`)** xác nhận từ bị bỏ qua đã về Hộp 1 và đến hạn hôm nay.

### Bước 3 — Kiểm tra M8: **第 13 節課** (`#/games/class13`)
1. Vào **遊戲 → 第 13 節課** (`#/games/class13`).
2. Xác nhận thấy lời phát thanh mở đầu, hộp **夜間教室氛圍提醒** (có ô tick không hiện lại), công tắc **安心模式**, và nút **「進教室」**.
3. Bấm **「進教室」** → qua đếm ngược `3-2-1` vào **第 1 節** (`90s`, mục tiêu `操行分數 0 / 600`, khoảng cách `12.0 m`).
4. **Gõ đúng / gõ sai:**
   - Thử gõ sai 1 chữ cái → thấy thông báo `✗ 打錯字母（-0.3m）`, khoảng cách giảm `0.3 m` (và rung nhẹ nếu tắt `安心模式`).
   - Gõ đúng toàn bộ từ (thử cả bàn phím máy tính lẫn bàn phím ảo bên dưới) → cộng điểm (`100` + thưởng tốc độ, `連對 ×3` nhân `1.5`), đẩy khoảng cách lùi `+1.5 m` (tối đa `12.0 m`).
   - Đợi hết `8s` một câu không gõ xong → câu đó tính là trượt (`-2.0 m`), chữ đáp án xuất hiện bằng **mực đỏ trên thân bóng đen SVG** ngoài cửa hành lang.
5. **Kiểm tra tạm dừng & thoát:**
   - Chuyển sang tab khác rồi quay lại → trò chơi tự động hiện màn hình **遊戲已暫停** và đồng hồ đã dừng.
   - Chơi đủ `600` điểm Tiết 1 → hiện màn hình **第 1 節下課** và cho bấm sang **第 2 節** (bắt đầu xuất hiện câu hội thoại phát thanh `A: ... / B: ... ___ ...`, hỗ trợ gõ cả `didn't` lẫn `did not`).
6. **Kiểm tra kết thúc & vòng lặp:** Để khoảng cách về `0.0 m` → (chớp tắt đèn 0.6s nếu không bật `安心模式`) hiện con dấu đỏ **不及格**, **`補考名單`**, **`最常打錯的字母`**, nút **「請 AI 解釋錯題」** (mở khung AI M6), và nút **「用這些錯字玩你說我猜」** (chuyển sang `#/games/guess?words=...`).
7. Rà soát nội dung tiếng Anh mới trong `docs/CONTENT.md` (80 câu `data/tense.js` + 40 câu `data/broadcast.js`).

---

## 5. Kích Thước Bundle & Kết Quả Kiểm Thử Hiện Tại

- **Initial-load JS (`index.html`, 27 script lõi):** **`199.6 KB`** (ngân sách `< 300 KB` — còn dư ~`100.4 KB`)
- **Tổng kích thước toàn bộ `js/` (bao gồm các game & AI lazy-load):** `636.8 KB`
- **Ngân hàng dữ liệu lazy-load:** `data/walls.js` (`15.9 KB`), `data/tense.js` (`11.2 KB`), `data/broadcast.js` (`6.0 KB`)
- **i18n parity:** `zh-TW = 421` khóa, `en = 421` khóa (0 khóa thiếu, 0 dấu `!`/`！`)
- **Kiểm thử tự động (`tests/smoke.test.js`):** **`64 passed, 0 failed (64 total)`**
- **Quality pass tĩnh:** **`QUALITY PASS: ZERO ISSUES`** (61 tệp JS, 11 tệp CSS; 0 `innerHTML`, 0 CSS gradient, 0 `z-index > 100`, 0 `setInterval` trong game, `data/english-2000-data.js` nguyên vẹn).
