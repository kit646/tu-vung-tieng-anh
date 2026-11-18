# AGENTS.md — Quy ước dự án `vocab-app`

## Kiến trúc & Stack
- **Stack:** HTML, CSS và JavaScript (ES modules) thuần. **Không dùng bước build**, **không dùng framework** (React, Vue, Tailwind, v.v.).
- **Cấu trúc thư mục:**
  - `index.html`: Điểm vào duy nhất của ứng dụng (SPA).
  - `css/`: `tokens.css`, `base.css`, `components.css`.
  - `js/`: `app.js`, `router.js`, `store.js`, `srs.js`, `speech.js`, `i18n.js`, và `views/*.js`.
  - `data/`: `vocab.json`, `exercises.json`, và dữ liệu thô trong `data/raw/`.
  - `scripts/`: Các script Python xử lý/kiểm tra dữ liệu (`extract_pdf.py`, `build_data.py`, `validate_data.py`).

## Dữ liệu
- Dữ liệu học tập **chỉ đọc từ `data/vocab.json` và `data/exercises.json`**.
- **Không hard-code** từ vựng, nghĩa, ví dụ hay câu hỏi bài tập trong mã nguồn JS.

## Ngôn ngữ & Chuỗi giao diện (i18n)
- **Giao diện (UI):** Tiếng Việt.
- **Nội dung học:** Tiếng Anh (từ vựng, phiên âm IPA, định nghĩa EN, câu ví dụ).
- **Mọi chuỗi UI** (nhãn nút, tiêu đề, thông báo, placeholder, aria-label, v.v.) **phải đặt tập trung trong `js/i18n.js`**, không viết rải rác trong các file view/component.

## Lưu trữ cục bộ (`localStorage`)
- Tiến độ học tập, trạng thái SRS, streak và cài đặt người dùng lưu trong `localStorage`.
- Tất cả key trong `localStorage` **phải có tiền tố `"vocab:"`** (ví dụ: `vocab:progress`, `vocab:settings`, `vocab:streak`).

## Giao diện & Khả năng truy cập (Accessibility)
- **Mobile-first:** Thiết kế ưu tiên màn hình di động trước, sau đó mở rộng cho tablet và desktop.
- **Phím tắt desktop:** Hỗ trợ điều hướng và thao tác nhanh bằng bàn phím trên desktop (ví dụ: lật thẻ, đánh giá SRS, phát âm, chuyển câu).
- **Chuẩn WCAG AA:** Đảm bảo độ tương phản màu sắc đạt tối thiểu WCAG AA, có focus ring rõ ràng, cấu trúc HTML ngữ nghĩa (`<main>`, `<nav>`, `<button>`, `aria-*`), hỗ trợ điều hướng bằng bàn phím và trình đọc màn hình.
