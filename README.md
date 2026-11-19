# Vocab A1–A2 · Ứng dụng học từ vựng tiếng Anh

Ứng dụng web tĩnh (HTML/CSS/JS ES modules thuần, không cần build) giúp người Việt tự học **362 từ vựng trình độ A1–A2** và **468 mục bài tập / Review** từ giáo trình *Vocabulary in Action* (Level 1–2) và *Elementary Wordlist A2*.

## Tính năng chính

- **Trang chủ (`#/home`):** Theo dõi số từ đến hạn hôm nay, chuỗi ngày học (streak), tiến độ tổng và vào phiên học ngay trong một chạm.
- **Thư viện từ vựng (`#/library`) & Chi tiết từ (`#/word/:id`):** Duyệt theo Nguồn / Level (`A1`, `A2`) → Unit → Chủ đề; tìm kiếm không phân biệt hoa thường theo từ tiếng Anh, nghĩa tiếng Việt hoặc định nghĩa; lọc theo từ loại; xem IPA, nghĩa tiếng Việt, định nghĩa tiếng Anh và toàn bộ câu ví dụ.
- **Phát âm (Web Speech API):** Ưu tiên giọng `en-GB`, hỗ trợ chuyển tốc độ `1.0x` / `0.8x`; tự ẩn nút phát âm nếu trình duyệt không hỗ trợ.
- **Flashcard & Lặp lại ngắt quãng (`#/flashcards`):** Thuật toán SM-2 rút gọn kết hợp 5 hộp Leitner (`{ box, ease, interval, due, lapses }`), chọn nguồn (đến hạn hôm nay / theo Unit / từ hay sai / từ mới), tối đa 20 thẻ/phiên, hỗ trợ chiều `EN → VI` và `VI → EN`, tóm tắt cuối phiên.
- **Bài tập thực hành (`#/practice`):** Dùng bài gốc từ `data/exercises.json` cho 12 Unit sách và tự sinh bài tập từ `data/vocab.json` cho các Unit Wordlist với 5 dạng bài: *Nối từ* (kéo thả + chạm chọn), *Điền từ* (word bank), *Trắc nghiệm* (3 đáp án nhiễu cùng từ loại/Unit), *Xếp chữ* (chạm thẻ chữ cái), và *Nghe – viết*. Từ làm sai tự động tăng `lapses + 1` trong SRS.
- **Kiểm tra & Review (`#/test`):** Đề kiểm tra 20 câu trộn theo Unit hoặc theo Level (`A1`/`A2`), kèm 2 bài *Level 1 Review* (trang 22) và *Level 2 Review* (trang 41), xem lại câu sai và lưu lịch sử điểm.
- **Tiến độ & Sao lưu (`#/progress`):** Thống kê *Đã thuộc / Đang học / Chưa học*, biểu đồ cột 14 ngày gần nhất bằng SVG thuần, % hoàn thành từng Unit, Top 10 từ hay sai kèm nút `"Ôn ngay"`, Xuất/Nhập tiến độ ra tệp `.json` và Đặt lại tiến độ có hộp thoại xác nhận.
- **Giao diện Sáng/Tối & Phím tắt:** Hỗ trợ Dark mode, đạt chuẩn WCAG AA, mobile-first và phím tắt trên desktop (`Space` lật thẻ, `1/2/3` chấm điểm SRS, `1–4` trắc nghiệm, `Enter` kiểm tra/tiếp tục, `R` nghe lại, `/` tìm kiếm, `Esc` quay lại).

---

## Cách chạy trên máy (Local)

Vì ứng dụng sử dụng ES modules (`<script type="module">`) và `fetch("./data/...")`, trình duyệt sẽ chặn nếu mở trực tiếp bằng giao thức `file://`. Hãy chạy qua một HTTP server tĩnh bất kỳ trong thư mục `vocab-app`:

### Cách 1: Dùng Python (khuyên dùng)
```powershell
cd "D:\downloads\Tổng Hợp Từ Vựng\vocab-app"
python -m http.server 5173
```
Sau đó mở trình duyệt tại: `http://localhost:5173`

### Cách 2: Dùng Node.js (`serve`) hoặc VS Code Live Server
```powershell
npx serve . -l 5173
```
Hoặc mở thư mục `vocab-app` trong VS Code và bấm **Go Live** (tiện ích *Live Server*).

### Chạy kiểm thử tự động & kiểm tra dữ liệu
```powershell
# Unit test thuật toán SRS, bộ sinh bài tập và sao lưu/khôi phục tiến độ
node --test tests/srs.test.js tests/exercises.test.js

# Kiểm tra tính toàn vẹn của data/vocab.json và data/exercises.json
.\scripts\.venv\Scripts\python.exe scripts\validate_data.py
```

---

## Cấu trúc thư mục & Dữ liệu

```text
vocab-app/
├── index.html                 # Điểm vào SPA duy nhất
├── .nojekyll                  # Tắt xử lý Jekyll khi deploy GitHub Pages
├── css/
│   ├── tokens.css             # Biến màu (Light/Dark WCAG AA), typography, spacing
│   ├── base.css               # Reset, scrollbar, focus ring, tabular numerals
│   └── components.css         # Shell, thanh điều hướng mobile/desktop, thẻ, bài tập
├── js/
│   ├── app.js                 # Khởi tạo theme, router, speech và phím tắt toàn cục
│   ├── i18n.js                # Toàn bộ chuỗi giao diện tiếng Việt tập trung
│   ├── icons.js               # Bộ icon SVG đồng nhất
│   ├── router.js              # Hash router (#/home, #/library, #/word/:id, ...)
│   ├── store.js               # Cache JSON và quản lý localStorage (tiền tố "vocab:")
│   ├── srs.js                 # Thuật toán SM-2 rút gọn / 5 hộp Leitner
│   ├── speech.js              # Web Speech API (ưu tiên giọng en-GB)
│   ├── exercises.js           # Chuyển đổi bài sách & sinh bài tập/đề kiểm tra
│   ├── utils.js               # Tiện ích escape HTML và badge
│   └── views/                 # Các màn hình: home, library, word, flashcards, practice, test, progress
├── data/
│   ├── raw/                   # Dữ liệu trích xuất thô (pdf_wordlist.json, book_units.json, book_exercises.json)
│   ├── vocab.json             # 362 bản ghi từ vựng chuẩn hóa
│   ├── exercises.json         # 12 Unit bài tập sách + 2 bài Review Level 1 & 2
│   ├── corrections.md         # Nhật ký 17 lỗi chính tả/ngữ pháp đã sửa từ bản gốc
│   └── vocab_vi_review.csv    # Bảng UTF-8 BOM để duyệt nghĩa tiếng Việt trên Excel
├── scripts/
│   ├── extract_pdf.py         # Trích bảng từ PDF bằng pdfplumber theo tọa độ cột
│   ├── vi_meanings.py         # Từ điển nghĩa tiếng Việt cho các từ vựng
│   ├── build_data.py          # Gộp dữ liệu thô, sửa chính tả, xuất vocab.json / exercises.json / CSV
│   ├── validate_data.py       # Kiểm tra schema, id trùng, đáp án, hoán vị chữ cái
│   └── requirements.txt       # Thư viện Python cho thư mục scripts/.venv
└── tests/
    ├── srs.test.js            # Unit test cho SRS và sao lưu tiến độ
    └── exercises.test.js      # Unit test cho bộ sinh bài tập & đề kiểm tra
```

### Schema `data/vocab.json`
Mỗi phần tử trong mảng JSON có dạng:
```json
{
  "id": "a2-u1-aunt",
  "word": "aunt",
  "pos": "noun",
  "ipa": "ɑːnt",
  "definition_en": "the sister of your mother or father, or the wife of your uncle",
  "meaning_vi": "cô, dì, thím, bác gái",
  "example": "Alice is my aunt.",
  "examples": [
    "Alice is my aunt.",
    "My aunt lives in Spain."
  ],
  "level": "A2",
  "source": "wordlist",
  "sources": ["wordlist", "book"],
  "unit": 1,
  "page": 11,
  "topic": "Quốc gia & tính cách",
  "tags": ["Quốc gia & tính cách"]
}
```
*(Các từ trùng giữa hai nguồn sẽ có thêm `book_level`, `book_unit`, `book_page`, `book_topic`, `book_definition_en` để hiển thị được ở cả hai nơi.)*

### Schema `data/exercises.json`
Gồm hai khóa gốc:
- `units`: Mảng 12 Unit sách (`level`, `unit`, `pages`, `unit_meta` chứa `title`, `topic`, `study_tip`, `page`, và 5 phần `A` Nối từ, `B` Điền từ, `C` Trắc nghiệm, `D` Xếp chữ, `E` Viết câu tự do). Mỗi câu đều gắn `id` duy nhất và `word_id` tham chiếu tới `data/vocab.json`.
- `reviews`: Mảng 2 bài ôn tập tổng hợp từ sách (`Level 1 Review` trang 22 và `Level 2 Review` trang 41), mỗi bài gồm 12 câu điền từ kèm `word_bank` và `word_id`.

### Các key `localStorage`
- `vocab:srs`: Trạng thái ghi nhớ của từng từ (`{ box, ease, interval, due, lapses }`).
- `vocab:streak`: Chuỗi ngày học liên tiếp (`count`, `lastDate`, `history` theo `YYYY-MM-DD`).
- `vocab:settings`: Cài đặt giao diện (`theme`, `speechRate`, `cardDirection`).
- `vocab:tests`: Lịch sử tối đa 50 lần làm bài kiểm tra / Review gần nhất.

---

## Cách thêm từ mới hoặc Unit mới

### Cách 1: Qua pipeline Python (khuyên dùng)
1. Bổ sung dữ liệu thô vào `data/raw/pdf_wordlist.json` hoặc `data/raw/book_units.json` (có thể trích từ PDF mới bằng `scripts/extract_pdf.py`).
2. Thêm cặp `"{id}": "{nghĩa tiếng Việt ngắn 1–4 từ}"` vào `MEANINGS_VI` trong `scripts/vi_meanings.py` (nếu có Unit mới, cập nhật thêm ánh xạ chủ đề trong `WORDLIST_TOPICS` hoặc `BOOK_TOPICS` của `scripts/build_data.py`).
3. Chạy lại bộ gộp và kiểm tra dữ liệu:
   ```powershell
   .\scripts\.venv\Scripts\python.exe scripts\build_data.py
   .\scripts\.venv\Scripts\python.exe scripts\validate_data.py
   ```
   Đảm bảo `validate_data.py` báo `VALIDATION PASSED: 0 errors`.
4. Chạy lại unit test (`node --test tests/srs.test.js tests/exercises.test.js`) và tải lại trang web — ứng dụng sẽ tự nhận diện các từ/Unit mới mà không cần sửa code JS.

### Cách 2: Chỉnh sửa nhanh trực tiếp trong `data/vocab.json`
1. Thêm bản ghi mới vào `data/vocab.json` tuân thủ đầy đủ các trường bắt buộc: `id` duy nhất theo mẫu `{level}-u{unit}-{slug}` (chữ thường, ví dụ `a2-u7-passport`), `word`, `pos`, `ipa`, `definition_en`, `meaning_vi`, `example`, `examples` (mảng không rỗng), `level` (`"A1"` hoặc `"A2"`), `source`, `sources`, `unit` (số nguyên), `page` (số nguyên), `topic`, `tags` (mảng không rỗng).
2. Chạy kiểm tra hợp lệ:
   ```powershell
   .\scripts\.venv\Scripts\python.exe scripts\validate_data.py
   ```

---

## Hướng dẫn Deploy lên GitHub Pages (miễn phí)

Toàn bộ đường dẫn trong ứng dụng (`./css/...`, `./js/...`, `./data/...`, hash route `#/...`) đều là đường dẫn tương đối nên chạy mượt trên mọi đường dẫn con `https://<username>.github.io/<repo-name>/`.

1. **Tạo repository mới trên GitHub:**
   - Truy cập <https://github.com/new>, đặt tên repository (ví dụ `vocab-a1-a2`), chọn **Public** (hoặc Private nếu dùng gói trả phí), **không** tích chọn tạo sẵn README / `.gitignore`.
2. **Kiểm tra & commit các thay đổi ở local (trong `D:\downloads\Tổng Hợp Từ Vựng\vocab-app`):**
   ```powershell
   cd "D:\downloads\Tổng Hợp Từ Vựng\vocab-app"
   git status
   git add .
   git commit -m "feat: complete vocab-app A1-A2 web application"
   ```
3. **Liên kết remote và đẩy code lên GitHub:**
   ```powershell
   git branch -M main
   git remote add origin https://github.com/<ten-tai-khoan>/<ten-repo>.git
   git push -u origin main
   ```
4. **Bật GitHub Pages trong phần Settings của repository:**
   - Mở repository trên GitHub → vào tab **Settings** → chọn mục **Pages** ở thanh bên trái.
   - Ở phần **Build and deployment → Source**, chọn **Deploy from a branch**.
   - Ở phần **Branch**, chọn nhánh **`main`** và thư mục **`/ (root)`**, rồi bấm **Save**.
5. **Chờ 1–2 phút và truy cập:**
   - GitHub sẽ hiển thị liên kết ở đầu trang **Settings → Pages** theo dạng:
     `https://<ten-tai-khoan>.github.io/<ten-repo>/`
   - Mở thử các đường dẫn `#/home`, `#/library`, `#/flashcards`, `#/practice`, `#/test`, `#/progress` trên cả điện thoại và máy tính để kiểm tra.
