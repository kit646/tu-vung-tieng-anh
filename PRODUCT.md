# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain static HTML, CSS, and JavaScript (ES modules), no build step, no UI framework (confirmed in `AGENTS.md`).

## Users

- **Người học chính:** Người Việt tự học tiếng Anh trình độ sơ cấp (A1–A2), muốn nắm vững toàn bộ bộ từ vựng từ giáo trình *Vocabulary in Action* (Level 1 A1 & Level 2 A2) và *Elementary Wordlist A2 (Unit 1–6)*.
- **Hoàn cảnh sử dụng:** Tự học đều đặn 10–20 phút mỗi ngày, chủ yếu trên trình duyệt điện thoại (khi rảnh, di chuyển, buổi tối) và đôi khi trên máy tính để bàn/laptop (ưu tiên thao tác nhanh bằng phím tắt).
- **Công việc cần hoàn thành (Job-to-be-done):** Tra cứu nhanh từ theo Level/Unit/Chủ đề, ôn thẻ nhớ đến hạn mỗi ngày để không quên từ cũ, làm bài tập thực hành theo từng Unit và tự kiểm tra để thấy rõ sự tiến bộ của bản thân.

## Product Purpose

Giúp người học duy trì thói quen học từ vựng đều đặn mỗi ngày, ghi nhớ lâu dài toàn bộ 362 từ vựng A1–A2 bằng thuật toán lặp lại ngắt quãng (SRS), và luôn nhìn thấy cảm giác tiến bộ rõ ràng qua từng phiên học ngắn.

## Positioning

Ứng dụng web tĩnh tự chứa (zero-backend, không cần đăng nhập, chạy ngay trên trình duyệt di động và máy tính), kết hợp chặt chẽ đúng bộ dữ liệu học tập thực tế của người học (253 từ *Elementary Wordlist A2* và 120 từ + 468 câu bài tập sách *Vocabulary in Action* A1–A2) trong một luồng khép kín: **Thư viện từ → Flashcard SRS → 5 dạng Bài tập → Kiểm tra Unit/Level → Bảng tiến độ**.

## Operating Context

- **Phiên học ngắn (10–20 phút/ngày):** Người học mở app trên điện thoại, xem ngay số từ cần ôn hôm nay và chuỗi ngày học (streak) trên Trang chủ, bấm "Học ngay" để hoàn thành một phiên Flashcard tối đa 20 thẻ hoặc làm một bài luyện tập/kiểm tra ngắn.
- **Lưu trữ & sao lưu cục bộ:** Toàn bộ trạng thái SRS, lịch sử điểm kiểm tra, streak và cài đặt lưu trong `localStorage` với tiền tố key `vocab:`, kèm tính năng Xuất/Nhập file JSON để sao lưu hoặc chuyển thiết bị.
- **Môi trường chạy:** Chạy trực tiếp qua HTTP server tĩnh ở local (`python -m http.server`) hoặc triển khai trên các nền tảng static hosting (GitHub Pages, Netlify, Vercel).

## Capabilities and Constraints

- **Tính năng cốt lõi (MVP):**
  1. **Trang chủ (Home):** Hiển thị số từ đến hạn ôn tập hôm nay, chuỗi ngày học (streak), tiến độ tóm tắt và nút "Học ngay".
  2. **Thư viện từ vựng (Library) & Chi tiết từ (Word Detail):** Duyệt theo Nguồn / Level (`A1`, `A2`) → Unit → Chủ đề; tìm kiếm không phân biệt hoa thường; lọc theo từ loại (`noun`, `verb`, `adj`, `adv`, `phrase`, `preposition`, `interj`); xem chi tiết từ (IPA, định nghĩa tiếng Anh, nghĩa tiếng Việt, các câu ví dụ, nút 🔊 phát âm).
  3. **Flashcard & SRS:** Lật thẻ `EN ↔ VI`, phát âm Web Speech API (ưu tiên giọng `en-GB`, tốc độ `0.8x`/`1.0x`, tự ẩn nút nếu trình duyệt không hỗ trợ), chấm điểm 3 mức (`Quên` / `Khó` / `Nhớ`) theo thuật toán SM-2 rút gọn / Leitner 5 hộp, giới hạn 20 thẻ/phiên.
  4. **Bài tập thực hành (Practice):** 4 dạng từ sách (*Nối từ – định nghĩa*, *Điền từ vào chỗ trống có word bank*, *Trắc nghiệm 4 lựa chọn*, *Sắp xếp chữ cái*) cộng thêm dạng *Nghe – viết*; sử dụng bài tập gốc từ `data/exercises.json` và tự sinh bài tập từ `data/vocab.json` cho các Unit wordlist chưa có bài tập riêng; phản hồi đúng/sai tức thì kèm nghĩa tiếng Việt, từ làm sai tự động cộng `lapses` trong SRS.
  5. **Kiểm tra (Test) & Review:** Bài kiểm tra 20 câu trộn các dạng theo Unit/Level và 2 bài Review gốc từ sách (Level 1 Review trang 22, Level 2 Review trang 41, mỗi bài 12 câu), chấm điểm, xem lại câu sai và lưu lịch sử điểm.
  6. **Tiến độ (Progress):** Thống kê số từ theo trạng thái (*Mới* / *Đang học* / *Đã thuộc*), % hoàn thành theo từng Unit, streak, biểu đồ 14 ngày gần nhất (SVG thuần), top 10 từ hay sai (có nút "Ôn ngay"), Xuất/Nhập JSON và Đặt lại tiến độ (có xác nhận).
- **Ràng buộc kỹ thuật bắt buộc (`AGENTS.md`):**
  - Chỉ đọc dữ liệu học tập từ `data/vocab.json` và `data/exercises.json`; tuyệt đối không hard-code từ vựng hay câu hỏi trong mã JS.
  - Giao diện (UI) 100% tiếng Việt, nội dung học tiếng Anh; mọi chuỗi giao diện đặt tập trung trong `js/i18n.js`.
  - Mọi key trong `localStorage` bắt buộc có tiền tố `"vocab:"`.
- **Ngoài phạm vi MVP:** Tài khoản đăng nhập, đồng bộ đám mây (cloud sync), AI chấm câu viết tự do (Exercise E).

## Brand Commitments

- **Giọng điệu (Voice & Tone):** Thân thiện, khích lệ, rõ ràng, thực tế; tôn trọng người học trưởng thành, tuyệt đối không dùng giọng điệu hay hình ảnh trẻ con/sáo rỗng.
- **Ngôn ngữ hiển thị:** Nhãn điều hướng, hướng dẫn và thông báo ngắn gọn bằng tiếng Việt tự nhiên; thuật ngữ học tập tiếng Anh (từ vựng, IPA, từ loại, câu ví dụ) giữ chuẩn xác.

## Evidence on Hand

- `data/vocab.json`: 362 bản ghi từ vựng đã chuẩn hóa và kiểm tra hợp lệ (253 từ wordlist A2 Unit 1–7 và 120 từ sách A1 Unit 1–6 / A2 Unit 7–12, đã gộp 11 từ trùng với `sources: ["wordlist", "book"]` và lưu đủ 2 câu ví dụ trong `examples`), đầy đủ `id`, `word`, `pos`, `ipa`, `definition_en`, `meaning_vi`, `example`, `examples`, `level`, `unit`, `page`, `topic`, `tags`.
- `data/exercises.json`: 12 Unit bài tập sách (phần A, B, C, D, E kèm `unit_meta` và `study_tip`) + 2 bài Review Level 1 & Level 2 (tổng cộng 468 mục bài tập/câu hỏi), tất cả đều đã giải đáp án đơn trị và gắn `word_id` khớp với `data/vocab.json`.
- `data/corrections.md`: Nhật ký 17 lỗi chính tả/ngữ pháp từ PDF gốc đã được sửa sạch.
- `data/vocab_vi_review.csv`: Bảng đối chiếu 362 từ (`word, pos, example, meaning_vi`) chuẩn UTF-8 BOM.
- **Không được bịa đặt:** Không tự bịa thêm số liệu người dùng, chứng nhận, bảng xếp hạng cộng đồng hay câu ví dụ nằm ngoài dữ liệu đã kiểm định.

## Product Principles

1. **Vào việc ngay trong một chạm:** Trang chủ luôn đưa người học thẳng tới phiên ôn tập cần thiết hôm nay mà không bắt đi qua nhiều bước cấu hình.
2. **Tiến bộ nhìn thấy được, không gây áp lực:** Mọi con số (từ đến hạn, từ đã thuộc, streak, câu sai cần ôn lại) đều cụ thể, trung thực và hướng tới hành động tiếp theo thay vì tạo cảm giác quá tải.
3. **Chính xác tuyệt đối với tài liệu gốc:** Từ vựng, phiên âm IPA, nghĩa tiếng Việt theo ngữ cảnh và câu bài tập phải phản ánh trung thực bộ dữ liệu chuẩn trong `data/`.
4. **Tối ưu cho ngón cái trên di động và bàn phím trên máy tính:** Mọi thao tác lặp lại hàng trăm lần (lật thẻ, nghe phát âm, chấm điểm SRS, chọn đáp án) phải nhanh, rõ vùng chạm trên mobile và có phím tắt tương ứng trên desktop.

## Accessibility & Inclusion

- Đạt chuẩn tương phản màu tối thiểu **WCAG AA** ở cả chế độ sáng và tối (dark mode).
- Thiết kế **Mobile-first** (vùng chạm tối thiểu 44×44px, điều hướng thuận tiện bằng một tay trên màn hình 375px) và mở rộng mượt lên tablet/desktop (1280px).
- Hỗ trợ đầy đủ điều hướng bàn phím (`Tab`, focus ring rõ ràng) và phím tắt trên desktop (`Space` lật thẻ, `1`/`2`/`3` chấm điểm SRS, `Enter` nộp bài/chuyển câu).
- Cấu trúc HTML ngữ nghĩa (`<main>`, `<nav>`, `<button>`, `aria-label`, `aria-live` cho phản hồi đúng/sai và trạng thái lật thẻ) và tôn trọng `prefers-reduced-motion` cho mọi hiệu ứng chuyển động.
