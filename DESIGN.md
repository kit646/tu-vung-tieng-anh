# DESIGN.md — Hệ thống thiết kế & UX `vocab-app`

## 1. Tổng quan UX & Chế độ bề mặt (`Operate`)

- **Bối cảnh & Mục tiêu:** Ứng dụng học và ôn tập từ vựng tiếng Anh A1–A2 (362 từ, 468 câu bài tập/review) cho người Việt tự học 10–20 phút/ngày, ưu tiên thao tác một tay trên điện thoại (`375px`) và thao tác tốc độ cao bằng phím tắt trên máy tính (`1280px`).
- **Surface Mode (`Operate`):** Giao diện công cụ học tập hằng ngày, đề cao **độ rõ ràng, nhất quán và tốc độ thao tác** hơn trang trí. Công cụ phải nhường chỗ cho nội dung học tập (từ vựng, IPA, ví dụ, nghĩa tiếng Việt).
- **Nguyên tắc cốt lõi:**
  1. **Một họ chữ duy nhất + Monospace cho ký tự kỹ thuật:** Dùng hệ font sans-serif của hệ điều hành có hỗ trợ đầy đủ dấu tiếng Việt; monospace chỉ dùng cho phiên âm IPA và huy hiệu phím tắt `<kbd>`.
  2. **Bảng màu tiết chế, giàu ngữ nghĩa (State-rich Restrained):** Nền giấy ấm dịu mắt vào buổi tối (giảm mỏi mắt), một màu nhấn chủ đạo cho hành động chính/trạng thái đang chọn, và 3 màu ngữ nghĩa tách biệt cho SRS & chấm bài (`Nhớ/Đúng`, `Khó/Cảnh báo`, `Quên/Sai`) đều đạt tối thiểu **WCAG AA (>= 4.5:1 cho chữ thường, >= 3:1 cho chữ lớn & viền điều khiển)**.
  3. **Chuyển động ngắn gọn (`150–220ms`):** Chỉ dùng chuyển động để báo chuyển trạng thái (lật thẻ, phản hồi đáp án, chuyển tab) và tôn trọng tuyệt đối `@media (prefers-reduced-motion: reduce)`.
  4. **Không tự chế control lạ:** Sử dụng nút, thẻ radio/checkbox, thanh tìm kiếm và `<dialog>` chuẩn HTML để hỗ trợ trình đọc màn hình và bàn phím.

### Sơ đồ điều hướng (Route Map)

| Route | Màn hình | Mục tiêu chính |
|---|---|---|
| `#/home` | Trang chủ | Vào phiên ôn tập hôm nay trong 1 chạm, xem streak & tổng quan |
| `#/library` | Thư viện | Chọn Level/Nguồn → Unit, tìm kiếm nhanh & lọc từ loại |
| `#/library/:source/:level/:unit` | Danh sách từ Unit | Duyệt từ trong 1 Unit cụ thể |
| `#/word/:id` | Chi tiết từ | Tra IPA, nghĩa VI, định nghĩa EN, các ví dụ, phát âm, trạng thái SRS |
| `#/flashcards` | Flashcard SRS | Ôn thẻ đến hạn / theo Unit / từ hay sai (`Space`, `1/2/3`) |
| `#/practice` | Bài tập | Luyện 5 dạng bài theo từng Unit (Nối, Điền, Trắc nghiệm, Xếp chữ, Nghe–viết) |
| `#/test` | Kiểm tra Unit / Review | Kiểm tra 20 câu trộn hoặc Review Level 1/2 (12 câu), xem lại câu sai |
| `#/progress` | Tiến độ | Thống kê mastery, biểu đồ 14 ngày (SVG), top 10 từ hay sai, sao lưu JSON |

---

## 2. Design Tokens (`css/tokens.css`)

### 2.1. Bảng màu (Light & Dark Mode — Đạt chuẩn WCAG AA)

#### Light Theme (`:root`)

| Token | Giá trị | Vai trò & Độ tương phản kiểm chứng |
|---|---|---|
| `--bg-canvas` | `#F7F8FA` | Nền tổng thể (lớp trung tính 1) |
| `--bg-surface` | `#FFFFFF` | Nền thẻ, card, thanh điều hướng (lớp trung tính 2) |
| `--bg-subtle` | `#EEF1F6` | Nền chip, thanh tiến độ rỗng, hover nhẹ |
| `--border-subtle` | `#DCE1EA` | Viền thẻ, đường chia danh sách |
| `--border-strong` | `#8B95A7` | Viền input/button đạt >= 3:1 trên `#FFFFFF` |
| `--text-primary` | `#161B26` | Văn bản chính (`17.2:1` trên `#FFFFFF`, `16.0:1` trên `#F7F8FA`) |
| `--text-secondary` | `#475266` | Nhãn phụ, định nghĩa EN phụ (`7.8:1` trên `#FFFFFF`) |
| `--text-muted` | `#5F6B7F` | Gợi ý phím tắt, metadata trang/unit (`5.3:1` trên `#FFFFFF`) |
| `--accent` | `#1D4ED8` | Màu nhấn chính, CTA `"Học ngay"` (`6.7:1` với `#FFFFFF`) |
| `--accent-hover` | `#1E40AF` | Hover nút chính |
| `--accent-active` | `#1E3A8A` | Active/nhấn giữ nút chính |
| `--accent-soft` | `#EFF6FF` | Nền trạng thái đang chọn |
| `--accent-text` | `#1E40AF` | Chữ trên nền `--accent-soft` (`7.9:1`) |
| `--success` | `#15803D` | Đúng / nút `Nhớ (3)` (`5.1:1` với `#FFFFFF`) |
| `--success-soft` | `#F0FDF4` | Nền banner đúng / badge đã thuộc |
| `--success-border` | `#86EFAC` | Viền phản hồi đúng |
| `--success-text` | `#166534` | Chữ trên `--success-soft` (`6.8:1`) |
| `--warning` | `#B45309` | Nút `Khó (2)` / Streak (`5.0:1` với `#FFFFFF`) |
| `--warning-soft` | `#FFFBEB` | Nền banner khó / streak chip |
| `--warning-border` | `#FCD34D` | Viền cảnh báo |
| `--warning-text` | `#92400E` | Chữ trên `--warning-soft` (`7.1:1`) |
| `--danger` | `#B91C1C` | Sai / nút `Quên (1)` (`6.4:1` với `#FFFFFF`) |
| `--danger-soft` | `#FEF2F2` | Nền phản hồi sai / từ hay sai |
| `--danger-border` | `#FCA5A5` | Viền lỗi |
| `--danger-text` | `#991B1B` | Chữ trên `--danger-soft` (`7.6:1`) |
| `--focus-ring` | `#2563EB` | Vòng focus `2px solid` + `offset 2px` |

#### Dark Theme (`[data-theme="dark"]`)

| Token | Giá trị | Vai trò & Độ tương phản kiểm chứng |
|---|---|---|
| `--bg-canvas` | `#0F141F` | Nền tổng thể buổi tối dịu mắt |
| `--bg-surface` | `#182030` | Nền card, panel, bottom bar |
| `--bg-subtle` | `#222D42` | Nền chip, input, hover |
| `--border-subtle` | `#2D3A52` | Viền thẻ |
| `--border-strong` | `#6B7A96` | Viền input/button (`>= 3.4:1` trên `#182030`) |
| `--text-primary` | `#F1F5F9` | Văn bản chính (`14.4:1` trên `#182030`) |
| `--text-secondary` | `#CBD5E1` | Văn bản phụ (`9.9:1` trên `#182030`) |
| `--text-muted` | `#94A3B8` | Nhãn metadata, `<kbd>` (`5.7:1` trên `#182030`) |
| `--accent` | `#3B82F6` | Màu nhấn chính (`4.6:1` với `#0F141F` hoặc chữ `#FFFFFF` trên `#2563EB`) |
| `--accent-btn-bg` | `#2563EB` | Nền nút chính chữ trắng (`5.1:1` với `#FFFFFF`) |
| `--accent-hover` | `#1D4ED8` | Hover nút chính |
| `--accent-soft` | `#1E2E4A` | Nền trạng thái đang chọn |
| `--accent-text` | `#93C5FD` | Chữ trên `--accent-soft` (`6.7:1`) |
| `--success` | `#16A34A` | Nút `Nhớ` (`#FFFFFF` trên `#15803D`: `5.1:1`) |
| `--success-soft` | `#132B21` | Nền đúng |
| `--success-border` | `#22C55E` | Viền đúng |
| `--success-text` | `#86EFAC` | Chữ trên `--success-soft` (`9.2:1`) |
| `--warning` | `#D97706` | Nút `Khó` / Streak (`#FFFFFF` trên `#B45309`: `5.0:1`) |
| `--warning-soft` | `#2E2212` | Nền cảnh báo |
| `--warning-border` | `#F59E0B` | Viền cảnh báo |
| `--warning-text` | `#FCD34D` | Chữ trên `--warning-soft` (`9.8:1`) |
| `--danger` | `#DC2626` | Nút `Quên` (`#FFFFFF` trên `#B91C1C`: `6.4:1`) |
| `--danger-soft` | `#32181C` | Nền sai |
| `--danger-border` | `#F87171` | Viền sai |
| `--danger-text` | `#FCA5A5` | Chữ trên `--danger-soft` (`7.3:1`) |
| `--focus-ring` | `#60A5FA` | Vòng focus nổi bật trên nền tối |

---

### 2.2. Typography Tokens (Tỷ lệ `rem` cố định, chuẩn Operate)

- `--font-sans`: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- `--font-mono`: `ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`

| Token | Giá trị (`rem` / `px`) | Line-height | Trọng số & Sử dụng |
|---|---|---|---|
| `--text-xs` | `0.75rem` (`12px`) | `1.35` | Nhãn tab bottom nav, `<kbd>`, chú thích nhỏ |
| `--text-sm` | `0.875rem` (`14px`) | `1.45` | Badge từ loại, metadata Unit, nút phụ, IPA phụ |
| `--text-base` | `1rem` (`16px`) | `1.5` | Câu ví dụ, định nghĩa, lựa chọn trắc nghiệm, input |
| `--text-lg` | `1.125rem` (`18px`) | `1.4` | Tiêu đề card, đầu mục danh sách từ |
| `--text-xl` | `1.25rem` (`20px`) | `1.3` | Tiêu đề màn hình (mobile), nghĩa VI trên flashcard |
| `--text-2xl` | `1.5rem` (`24px`) | `1.25` | Tiêu đề trang (desktop), con số KPI chính |
| `--text-3xl` | `2rem` (`32px`) | `1.15` | Từ vựng trung tâm trên Flashcard & Chi tiết từ |

---

### 2.3. Spacing, Kích thước chạm, Bo góc, Đổ bóng & Chuyển động

- **Khoảng cách (4px/8px grid):**
  - `--space-1`: `4px` | `--space-2`: `8px` | `--space-3`: `12px` | `--space-4`: `16px`
  - `--space-5`: `20px` | `--space-6`: `24px` | `--space-8`: `32px` | `--space-10`: `40px`
- **Vùng chạm tối thiểu (Mobile-first):**
  - `--tap-min`: `44px` (tất cả nút, chip lọc, tab điều hướng, tùy chọn bài tập đều có `min-height: 44px; min-width: 44px`).
- **Bo góc:**
  - `--radius-sm`: `6px` (chip, `<kbd>`, tag)
  - `--radius-md`: `10px` (button, input, list item)
  - `--radius-lg`: `16px` (flashcard, hero card, dialog)
  - `--radius-full`: `9999px` (pill badge, progress bar)
- **Đổ bóng (tiết chế):**
  - `--shadow-sm`: `0 1px 2px rgba(15, 23, 42, 0.06)`
  - `--shadow-md`: `0 4px 12px rgba(15, 23, 42, 0.08)`
- **Chuyển động:**
  - `--duration-fast`: `150ms` (hover, nhấn nút, focus)
  - `--duration-normal`: `220ms` (lật flashcard, mở banner phản hồi)
  - `--ease-out`: `cubic-bezier(0.22, 1, 0.36, 1)`
  - Khi `@media (prefers-reduced-motion: reduce)`: đặt `--duration-fast: 0ms; --duration-normal: 0ms` và bỏ hiệu ứng xoay 3D lật thẻ (chuyển sang đổi mặt tức thì).
- **Layout Breakpoints:**
  - Mobile: `< 768px` (chuẩn kiểm thử `375px`) — padding ngang `16px`, bottom nav cao `64px` (+ `env(safe-area-inset-bottom)`), không thanh bên.
  - Tablet: `768px – 1023px` (chuẩn `768px`) — tối đa `720px` căn giữa, chuyển từ bottom nav sang top nav.
  - Desktop: `>= 1024px` (chuẩn `1280px`) — container tối đa `1040px` căn giữa, lưới 2 cột cho Trang chủ & Tiến độ, hiển thị gợi ý `<kbd>` trên các nút hành động.

---

## 3. Hệ thống Thành phần & Ma trận Trạng thái (Components & States)

| Thành phần | Quy cách & Trạng thái bắt buộc |
|---|---|
| **Thanh điều hướng** | **Mobile:** Header gọn trên cùng (Logo/Tên trang + nút 🌓 Theme + nút Tốc độ đọc `1.0x`/`0.8x`) + **Bottom Tab Bar 5 tab cố định** (`Trang chủ`, `Thư viện`, `Flashcard`, `Bài tập`, `Tiến độ`, riêng `Kiểm tra` truy cập nhanh từ Trang chủ & đầu màn Bài tập). **Desktop:** Sticky top bar chứa đầy đủ 6 liên kết điều hướng + nút Theme/Audio. Trạng thái `aria-current="page"` làm nổi bật bằng màu `--accent-soft` + gạch/viền nhấn. |
| **Nút hành động (Buttons)** | `btn-primary` (nền `--accent`), `btn-secondary` (viền `--border-strong`), `btn-ghost`, `btn-icon` (🔊 `44×44px`), và nhóm 3 nút SRS (`Quên`, `Khó`, `Nhớ`). Đủ trạng thái: `default`, `hover`, `focus-visible` (`outline: 2px solid var(--focus-ring)`), `active` (`scale(0.98)`), `disabled` (`opacity: 0.45`, `cursor: not-allowed`). |
| **Thẻ & Danh sách từ** | Mỗi mục hiển thị rõ: Từ tiếng Anh (`font-weight: 600`), từ loại (`badge-pos`), phiên âm IPA (`--font-mono`, ẩn gọn nếu trống), nghĩa VI, chấm trạng thái SRS (`Mới` xám / `Đang học` hổ phách / `Đã thuộc` xanh lá) và nút 🔊 độc lập (không kích hoạt điều hướng sang chi tiết khi bấm 🔊). |
| **Bộ lọc & Tìm kiếm** | Ô tìm kiếm có nút xóa nhanh (`X`), tìm không phân biệt hoa thường theo cả `word` và `meaning_vi`; dải chip lọc theo Nguồn/Level (`Tất cả`, `A1 Sách`, `A2 Wordlist`, `A2 Sách`) và Từ loại (`noun`, `verb`, `adj`, `adv`, `phrase`). |
| **Banner phản hồi bài tập** | Nằm ngay dưới vùng câu hỏi (không bật modal che màn hình), dùng `aria-live="polite"`. Hiện trạng thái Đúng (`--success-soft`) hoặc Sai (`--danger-soft`), kèm đáp án đúng, nghĩa tiếng Việt (`meaning_vi`), nút 🔊 và nút `Tiếp theo [Enter]`. |
| **Trạng thái đặc biệt** | **Loading:** Skeleton bar nhấp nháy nhẹ (không xoay spinner giữa màn hình). **Empty:** Thông báo thân thiện kèm nút hành động tiếp theo (vd: *"Hôm nay bạn đã ôn hết thẻ đến hạn!"* + nút `"Ôn theo Unit"` hoặc `"Làm bài tập"`). **Error:** Thông báo lỗi tải JSON rõ ràng + nút `"Thử lại"`. |

---

## 4. Hệ thống Phím tắt trên Desktop

Chỉ hiển thị huy hiệu `<kbd>` trên màn hình có thiết bị trỏ chuột / desktop (`>= 1024px`) và tự động bỏ qua phím tắt khi người dùng đang gõ trong ô `<input>` hoặc `<textarea>` (trừ `Enter` để nộp bài và `Esc` để thoát).

| Bối cảnh | Phím tắt | Hành động |
|---|---|---|
| **Chung** | `Esc` | Đóng hộp thoại xác nhận hoặc quay lại danh sách |
| **Thư viện** | `/` | Focus nhanh vào ô tìm kiếm từ vựng |
| **Flashcard** | `Space` | Lật mặt thẻ (`EN ↔ VI`) |
| **Flashcard** | `1` / `2` / `3` | Chấm điểm SRS sau khi đã lật: `1` Quên · `2` Khó · `3` Nhớ |
| **Flashcard / Chi tiết / Nghe–viết** | `R` | Phát âm lại từ/câu đang học (🔊) |
| **Trắc nghiệm (Practice / Test)** | `1` – `4` | Chọn nhanh đáp án A / B / C / D |
| **Xếp chữ (Unscramble)** | `Backspace` | Trả lại chữ cái vừa chọn cuối cùng về khay |
| **Bài tập & Kiểm tra** | `Enter` | Kiểm tra đáp án hoặc chuyển sang câu tiếp theo |

---

## 5. Wireframe Chi tiết 7 Màn hình (Mobile `375px` & Desktop `1280px`)

### Màn 1: Trang chủ (`#/home`)

```text
MOBILE (375px)                              DESKTOP (1280px)
+-----------------------------------+       +---------------------------------------------------------------+
| Vocab A1-A2        [1.0x] [Theme] |       | Vocab A1-A2 | Trang chủ | Thư viện | Flashcard | Bài tập | KT | Tiến độ | [1.0x] [Theme] |
+-----------------------------------+       +---------------------------------------------------------------+
| Chào bạn, giữ nhịp 10-20 phút nhé |       | Chào bạn, giữ nhịp học mỗi ngày               🔥 Streak: 5 ngày |
| 🔥 Chuỗi học: 5 ngày liên tiếp    |       |                                                               |
|                                   |       | +---------------------------+ +-----------------------------+ |
| +-------------------------------+ |       | | HÔM NAY CẦN ÔN            | | TỔNG QUAN TỪ VỰNG (362 TỪ)  | |
| | HÔM NAY CẦN ÔN                | |       | |  18 từ đến hạn            | |  Đã thuộc: 84  Đang học: 56 | |
| |        18 từ                  | |       | |  + 2 thẻ hay sai          | |  Chưa học: 222              | |
| |  Thời gian ước tính: ~5 phút  | |       | |                           | |  [======------........] 23% | |
| |  [     Học ngay (18 từ)     ] | |       | |  [   Học ngay (18 từ)   ] | |  Xem chi tiết tiến độ ->    | |
| +-------------------------------+ |       | +---------------------------+ +-----------------------------+ |
|                                   |       |                                                               |
| Tiến độ tổng (362 từ):            |       | Lối tắt luyện tập nhanh                                       |
| [Đã thuộc 84][Đang 56][Mới 222]   |       | +-------------------+ +-----------------+ +-----------------+ |
|                                   |       | | Làm bài tập Unit  | | Kiểm tra 20 câu | | Ôn từ hay sai   | |
| Lối tắt nhanh:                    |       | | 5 dạng + Nghe viết| | Review L1 / L2  | | 7 từ cần chú ý  | |
| +---------------+ +-------------+ |       | +-------------------+ +-----------------+ +-----------------+ |
| | Làm bài tập   | | Kiểm tra    | +-------+---------------------------------------------------------------+
| +---------------+ +-------------+
| +-------------------------------+
| | Ôn 7 từ hay sai               |
| +-------------------------------+
+-----------------------------------+
| Trang chủ | Thư viện | Thẻ | BT | Tiến độ |
+-----------------------------------+
```

- **Trạng thái rỗng (0 từ đến hạn):** Thẻ chính chuyển sang thông báo nhẹ nhàng: *"Hôm nay bạn đã ôn xong hết thẻ đến hạn!"*, đổi nút chính thành `"Học thêm 10 từ mới"` hoặc `"Luyện bài tập Unit"`.

---

### Màn 2: Thư viện từ vựng (`#/library` & `#/library/:source/:level/:unit`)

```text
MOBILE (375px)                              DESKTOP (1280px)
+-----------------------------------+       +---------------------------------------------------------------+
| Thư viện từ vựng          [Theme] |       | Header & Top Nav                                              |
+-----------------------------------+       +---------------------------------------------------------------+
| [🔍 Tìm từ tiếng Anh / nghĩa VI ] |       | Thư viện từ vựng (362 từ)                                     |
|                                   |       | [🔍 Tìm từ tiếng Anh hoặc nghĩa tiếng Việt...         [/] ]   |
| Nguồn / Level:                    |       |                                                               |
| [Tất cả] [A1 Sách] [A2 WL] [A2 S] |       | Nguồn: [Tất cả] [A1 Sách U1-6] [A2 Wordlist U1-7] [A2 Sách]   |
|                                   |       | Loại:  [Tất cả] [noun] [verb] [adj] [adv] [phrase]            |
| Từ loại:                          |       |                                                               |
| [Tất cả][noun][verb][adj][phrase] |       | -- Khi chọn Unit (Lưới Unit) -------------------------------- |
|                                   |       | +----------------------+ +----------------------+ +---------+ |
| -- Chế độ xem Unit -------------- |       | | A1 Unit 1            | | A1 Unit 2            | | A2 U1   | |
| +-------------------------------+ |       | | Chào hỏi & con người | | Gia đình             | | Quốc gia| |
| | A1 · Unit 1           10 từ   | |       | | [====------] 4/10    | | [========--] 8/10    | | 12/72   | |
| | Chào hỏi & con người          | |       | +----------------------+ +----------------------+ +---------+ |
| | [======------------] 4/10 từ  | |       |                                                               |
| +-------------------------------+ |       | -- Hoặc Danh sách từ trong Unit / Kết quả tìm kiếm ---------- |
|                                   |       | +-----------------------------------------------------------+ |
| -- Hoặc Danh sách từ ------------ |       | | ● Brazil        /brəˈzɪl/   noun    nước Brazil      [🔊] | |
| +-------------------------------+ |       | | ● Brazilian     /brəˈzɪliən/ adj    thuộc Brazil     [🔊] | |
| | ● Brazil  [noun]         [🔊] | |       | | ○ aunt  [2 nguồn] /ɑːnt/     noun    cô, dì, thím     [🔊] | |
| |   /brəˈzɪl/ · nước Brazil     | |       | +-----------------------------------------------------------+ |
| +-------------------------------+ |       +---------------------------------------------------------------+
| | ● aunt [2 nguồn] [noun]  [🔊] | |
| |   /ɑːnt/ · cô, dì, thím       | |
| +-------------------------------+ |
+-----------------------------------+
| Trang chủ | Thư viện | Thẻ | BT | Tiến độ |
+-----------------------------------+
```

- **Chú ý UX:** Khi người dùng nhập vào ô tìm kiếm hoặc chọn chip Từ loại khác `"Tất cả"`, màn hình chuyển ngay sang hiển thị danh sách từ khớp điều kiện (kèm nút `"Xóa bộ lọc"` khi không tìm thấy từ nào). Với 11 từ trùng giữa 2 nguồn (`sources.length === 2`), gắn badge nhỏ `[2 nguồn]` và tìm thấy ở cả Unit wordlist lẫn Unit sách.

---

### Màn 3: Chi tiết từ (`#/word/:id`)

```text
MOBILE (375px)                              DESKTOP (1280px)
+-----------------------------------+       +---------------------------------------------------------------+
| <- Quay lại Thư viện              |       | Header & Top Nav                                              |
+-----------------------------------+       +---------------------------------------------------------------+
| [A2] [Unit 1] [Wordlist + Sách]   |       | <- Quay lại Thư viện (Esc)                                    |
|                                   |       |                                                               |
| aunt                     [noun]   |       | +----------------------------------+ +----------------------+ |
| /ɑːnt/      [🔊 1.0x]  [🐢 0.8x] |       | | [A2] [Unit 1 · Quốc gia] [2 nguồn]| | TRẠNG THÁI SRS       | |
|                                   |       | | aunt                      [noun] | | Hộp 3 · Đang học     | |
| +-------------------------------+ |       | | /ɑːnt/   [🔊 1.0x (R)] [🐢 0.8x]  | | Ôn tiếp: 4 ngày nữa  | |
| | NGHĨA TIẾNG VIỆT              | |       | |                                  | | Số lần quên: 0       | |
| | cô, dì, thím, bác gái         | |       | | NGHĨA TIẾNG VIỆT:                | |                      | |
| +-------------------------------+ |       | | cô, dì, thím, bác gái            | | [ Ôn thẻ từ này ]    | |
|                                   |       | |                                  | +----------------------+ |
| Định nghĩa (EN):                  |       | | Định nghĩa (EN):                 |                        |
| the sister of your mother or      |       | | the sister of your mother or     |                        |
| father, or the wife of your uncle |       | | father, or the wife of your uncle|                        |
|                                   |       | |                                  |                        |
| Câu ví dụ (2):                    |       | | Câu ví dụ (2):                   |                        |
| 1. Alice is my aunt.        [🔊]  |       | | 1. Alice is my aunt.        [🔊] |                        |
| 2. My aunt lives in Spain.  [🔊]  |       | | 2. My aunt lives in Spain.  [🔊] |                        |
|                                   |       | +----------------------------------+                        |
| Trạng thái SRS: Hộp 3 · Đang học  |       +---------------------------------------------------------------+
| [      Ôn lại thẻ từ này      ]   |
+-----------------------------------+
```

- **Chú ý UX:** Nếu trình duyệt không hỗ trợ `speechSynthesis`, ẩn hẳn các nút `🔊` / `🐢` (thay vì làm mờ vô ích) và chỉ hiển thị phiên âm IPA. Hiển thị toàn bộ mảng `examples` (1 ví dụ hoặc 2 ví dụ với từ gộp).

---

### Màn 4: Flashcard & SRS (`#/flashcards`)

```text
MOBILE (375px)                              DESKTOP (1280px)
+-----------------------------------+       +---------------------------------------------------------------+
| Flashcard        Thẻ 7 / 20       |       | Header & Top Nav                                              |
| [========----------------]        |       +---------------------------------------------------------------+
+-----------------------------------+       | Nguồn: [Đến hạn (18) v]  Unit: [Tất cả v]  Chiều: [EN -> VI v]  |
| Nguồn: [Đến hạn v] Chiều: [EN->VI]|       | Tiến độ phiên: Thẻ 7 / 20   [===========-------------------]  |
+-----------------------------------+       |                                                               |
|                                   |       |            +-------------------------------------+            |
|  +-----------------------------+  |       |            | A2 · Unit 1               Hộp 2     |            |
|  | A2 · Unit 1           Hộp 2 |  |       |            |                                     |            |
|  |                             |  |       |            |             Brazilian               |            |
|  |          Brazilian          |  |       |            |            /brəˈzɪliən/             |            |
|  |         /brəˈzɪliən/        |  |       |            |           [adj]   [🔊 Nghe (R)]     |            |
|  |            [adj]            |  |       |            | ----------------------------------- |            |
|  |          [🔊 Nghe]          |  |       |            | thuộc Brazil, người Brazil          |            |
|  |                             |  |       |            | "I'm chatting online to a Brazilian |            |
|  |   (Chạm thẻ để lật xem)     |  |       |            |  girl."                        [🔊] |            |
|  +-----------------------------+  |       |            +-------------------------------------+            |
|                                   |       |                                                               |
| -- Khi đã lật (Back) ------------ |       |   [  [1] Quên       ] [  [2] Khó        ] [  [3] Nhớ        ] |
|  | thuộc Brazil, người Brazil  |  |       |   |  (Ôn lại ngay)  | |  (1 ngày nữa)   | |  (4 ngày nữa)   | |
|  | from Brazil                 |  |       |   +-----------------+ +-----------------+ +-----------------+ |
|  | "I'm chatting online..."[🔊]|  |       |          Hoặc trước khi lật: [ Lật thẻ (Space) ]              |
|                                   |       +---------------------------------------------------------------+
| +----------+ +--------+ +-------+ |
| |   Quên   | |  Khó   | |  Nhớ  | |
| | (Học lại)| | (1 ng) | |(4 ng) | |
| +----------+ +--------+ +-------+ |
+-----------------------------------+
```

- **Luồng kết thúc phiên (tối đa 20 thẻ):** Hiện thẻ Tóm tắt phiên (`Số thẻ đã ôn`, `Nhớ: X`, `Khó: Y`, `Quên: Z`, `Streak hôm nay`) + nút `"Ôn tiếp lô sau"` (nếu còn thẻ đến hạn) hoặc `"Về Trang chủ"`.
- **Chiều `VI → EN`:** Mặt trước hiện `meaning_vi` + gợi ý từ loại `[pos]`, mặt sau hiện từ tiếng Anh + IPA + nút 🔊 + ví dụ.

---

### Màn 5: Bài tập thực hành (`#/practice`)

```text
MOBILE (375px)                              DESKTOP (1280px)
+-----------------------------------+       +---------------------------------------------------------------+
| Bài tập · A1 Unit 1       Câu 3/10|       | Header & Top Nav                                              |
+-----------------------------------+       +---------------------------------------------------------------+
| Unit: [A1-U1: Chào hỏi v] [Thi KT]|       | Chọn Unit: [A1 Unit 1: Chào hỏi & con người v]  [Sang Kiểm tra]|
| [Nối][Điền][Trắc nghiệm][Xếp][Nghe]|      | Dạng bài:  [Nối từ] [Điền từ] [Trắc nghiệm] [Xếp chữ] [Nghe-viết]|
+-----------------------------------+       | Câu 3 / 10  [=========--------------------------]           |
|                                   |       |                                                               |
| -- Ví dụ A: Nối (chạm 2 cột) ---- |       | -- Ví dụ B: Điền từ ----------------------------------------- |
| Cột Từ         | Cột Định nghĩa   |       | Word bank: [friend] [hello] [teacher] [welcome] ...           |
| [1. hello *]   | [a. lives near]  |       | Câu: "We [ ____ ] you to our home."                           |
| [2. neighbour] | [b. meet someone]|       |                                                               |
|                                   |       | -- Ví dụ D: Xếp chữ (chạm chữ cái) -------------------------- |
| -- Ví dụ C: Trắc nghiệm --------- |       | Gợi ý: (noun) a person you like and know well                 |
| "a person who lives near you."    |       | Ô ghép: [ F ] [ R ] [ I ] [ _ ] [ _ ] [ _ ]   [Xóa (Bksp)]    |
| ( ) a) student                    |       | Khay chữ: [E] [N] [D]                                         |
| ( ) b) goodbye                    |       |                                                               |
| ( ) c) please                     |       | -- Ví dụ E: Nghe - viết (Web Speech API) -------------------- |
| (●) d) neighbour                  |       | [🔊 Phát âm câu/từ (R)] [🐢 0.8x]  Gợi ý: "____ for help."   |
|                                   |       | Nhập từ nghe được: [ thanks                    ]  [Kiểm tra]  |
| +-------------------------------+ |       |                                                               |
| | ✓ Chính xác!                  | |       | +-----------------------------------------------------------+ |
| | neighbour = hàng xóm      [🔊]| |       | | ✓ Chính xác! · thanks = cảm ơn · [🔊] · [Tiếp theo (Enter)]| |
| | [      Tiếp theo (Enter)    ] | |       | +-----------------------------------------------------------+ |
| +-------------------------------+ |       +---------------------------------------------------------------+
+-----------------------------------+
| Trang chủ | Thư viện | Thẻ | BT | Tiến độ |
+-----------------------------------+
```

- **Chú ý dữ liệu:** Với 12 Unit sách (`data/exercises.json`), dùng đúng bài tập gốc từ sách cho các dạng Nối / Điền / Trắc nghiệm / Xếp chữ (và ghi chú mẹo học `study_tip` ở đầu Unit). Với 7 Unit Wordlist chưa có bài tập riêng, tự sinh động từ `data/vocab.json` (định nghĩa → từ, ví dụ đục lỗ → từ, trắc nghiệm với 3 đáp án nhiễu cùng từ loại/unit, xếp chữ). Mọi từ trả lời sai đều cộng `lapses + 1` trong SRS để ưu tiên ôn lại.

---

### Màn 6: Kiểm tra Unit / Review (`#/test`)

```text
MOBILE (375px)                              DESKTOP (1280px)
+-----------------------------------+       +---------------------------------------------------------------+
| Kiểm tra · A1 Unit 1              |       | Header & Top Nav                                              |
+-----------------------------------+       +---------------------------------------------------------------+
| -- Chọn bài kiểm tra ------------ |       | Chọn chế độ: [Unit (20 câu trộn) v]  [Review L1 (12)] [Review L2] |
| [Unit (20 câu)] [Review L1] [L2]  |       |                                                               |
|                                   |       | -- Màn Kết quả & Xem lại câu sai ---------------------------- |
| -- Màn Kết quả ------------------ |       | +-----------------------------------------------------------+ |
| +-------------------------------+ |       | | KẾT QUẢ: A1 Unit 1 (Chào hỏi & con người)                 | |
| | KẾT QUẢ KIỂM TRA              | |       | | Điểm: 17 / 20 (85%)   ·   Thời gian: 03:42   ·  Tốt lắm!  | |
| |       17 / 20  (85%)          | |       | | [Làm lại bài này]   [Ôn 3 từ làm sai (Flashcard)]         | |
| | [ Làm lại ]  [ Ôn 3 từ sai ]  | |       | +-----------------------------------------------------------+ |
| +-------------------------------+ |       |                                                               |
|                                   |       | Xem lại câu sai (3 câu):                                      |
| Xem lại câu sai (3):              |       | +-----------------------------------------------------------+ |
| +-------------------------------+ |       | | Câu 4 (Điền từ): "Our ____ has a small dog."              | |
| | Câu 4: "Our ____ has a dog."  | |       | | Bạn chọn: friend (x)  |  Đáp án đúng: neighbour (hàng xóm)  | |
| | Bạn chọn: friend              | |       | +-----------------------------------------------------------+ |
| | Đúng: neighbour (hàng xóm)[🔊]| |       | | Lịch sử kiểm tra gần đây: A1-U1 (85%), Review L1 (92%)      | |
| +-------------------------------+ |       +---------------------------------------------------------------+
+-----------------------------------+
```

---

### Màn 7: Tiến độ (`#/progress`)

```text
MOBILE (375px)                              DESKTOP (1280px)
+-----------------------------------+       +---------------------------------------------------------------+
| Tiến độ học tập                   |       | Header & Top Nav                                              |
+-----------------------------------+       +---------------------------------------------------------------+
| +---------------+ +-------------+ |       | +--------------+ +--------------+ +--------------+ +----------+ |
| | Đã thuộc: 84  | | Streak: 5ng | |       | | Đã thuộc: 84 | | Đang học: 56 | | Chưa học:222 | | Streak:5 | |
| +---------------+ +-------------+ |       | +--------------+ +--------------+ +--------------+ +----------+ |
| +---------------+ +-------------+ |       |                                                               |
| | Đang học: 56  | | Mới: 222    | |       | +----------------------------+ +----------------------------+ |
| +---------------+ +-------------+ |       | | Hoạt động 14 ngày (SVG)    | | Top từ hay sai (lapses)    | |
|                                   |       | |      |  |    |  |  | |  |    | | 1. neighbour (5 lần) [Ôn]  | |
| Hoạt động 14 ngày gần nhất:       |       | |   |  |  |  | |  |  | |  |    | | 2. colleague (4 lần) [Ôn]  | |
| +-------------------------------+ |       | |  T2 ... T7 ... CN ... Hôm nay| | 3. wardrobe  (3 lần) [Ôn]  | |
| |    |  |     |  |  |  |   |    | |       | +----------------------------+ +----------------------------+ |
| | [Biểu đồ cột SVG thuần 14 ng] | |       |                                                               |
| +-------------------------------+ |       | Tiến độ từng Unit (% đã thuộc/đang học):                    |
|                                   |       | A1-U1 Chào hỏi    [==================--] 90%                  |
| Top 10 từ hay sai:                |       | A2-U1 Quốc gia    [======--------------] 32%                  |
| 1. neighbour (5 lần)   [Ôn ngay]  |       |                                                               |
| 2. colleague (4 lần)   [Ôn ngay]  |       | Sao lưu & dữ liệu (localStorage vocab:*):                     |
|                                   |       | [Xuất JSON sao lưu]   [Nhập từ file JSON]   [Đặt lại dữ liệu] |
| Tiến độ theo Unit:                |       +---------------------------------------------------------------+
| A1-U1 Chào hỏi  [========--] 90%  |
|                                   |
| Sao lưu dữ liệu:                  |
| [Xuất JSON] [Nhập JSON] [Đặt lại] |
+-----------------------------------+
| Trang chủ | Thư viện | Thẻ | BT | Tiến độ |
+-----------------------------------+
```

- **Xác nhận an toàn:** Nút `"Đặt lại dữ liệu"` mở `<dialog>` xác nhận hai bước rõ ràng bằng tiếng Việt trước khi xóa các key `vocab:*` trong `localStorage`.

---

## 6. Ghi chú kiểm chứng cho giai đoạn dựng giao diện (Stage 4–6)

- Kiểm tra ở 3 kích thước viewport: Mobile `375×812`, Tablet `768×1024`, Desktop `1280×800`, cả Light mode và Dark mode.
- Không có cuộn ngang (`overflow-x`) ở `375px`; thanh tab dưới cùng không che nội dung cuối trang (nhờ `padding-bottom` của `<main>`).
- Chạy `impeccable detect --json` và kiểm tra Accessibility (focus order, `aria-live`, tương phản WCAG AA, phím tắt desktop) sau khi cài đặt HTML/CSS/JS.
