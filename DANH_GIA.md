# Đánh giá ứng dụng — CSD Drawing Checker (v2.2)

> Công cụ kiểm tra bản vẽ MEP từ lớp text PDF, chạy hoàn toàn trong trình duyệt.
> Dự án: Olympus Vietnam New Building Construction Project.
>
> **Cập nhật v2.3** — phần "Điểm cần lưu ý" ở mục 6 đã được xử lý: app nay
> đọc được nét vẽ vector và đã có bộ kiểm thử tự động. Xem mục 8 ở cuối.

Bản đánh giá này dựa trên toàn bộ mã nguồn (`index.html`, `sw.js`, `manifest.webmanifest`, `README.md`).

---

## 1. Tổng quan

| Hạng mục | Nội dung |
|---|---|
| Loại | PWA một-file (single-file), cài được lên điện thoại, chạy offline |
| Kích thước | `index.html` ~1.7 MB (chủ yếu là font woff2 nhúng + pdf.js) |
| Logic ứng dụng | ~114 KB code JS thuần, không framework, không build step |
| Phụ thuộc ngoài | pdf.js (Mozilla) nhúng sẵn; **không có** thư viện khác, **không** gọi mạng khi chạy |
| Đầu vào | Nhiều file PDF (kéo-thả hoặc chọn), đọc **lớp text**; từ v2.3 đọc thêm **nét vẽ vector** (mục 8) |
| Đầu ra | Comment sheet `.xlsx` (tự viết ZIP/XLSX, không dùng SheetJS) + text thô `.txt` |
| Ngôn ngữ UI | Song ngữ VI/EN |

Ứng dụng nhận **4 họ bản vẽ** và tự phân loại: **CSD** (combine services), **MP** (cấp thoát nước / mặt cắt), **FS** (PCCC + điện + ELV), **AC** (sơ đồ nguyên lý VRF). Với nhiều file cùng lúc, có thêm các phép **đối chiếu chéo giữa các sheet**.

---

## 2. Kiến trúc & luồng xử lý

Luồng rất mạch lạc, chia thành các tầng rõ ràng:

```
PDF → pdf.js getTextContent
    → normaliseItems()   (xoay text về hệ trục, tính along/across)
    → buildLines()       (gom item thành dòng, ngắt theo khoảng trống ngang)
    → buildBlocks()      (gom dòng chồng nhau thành khối chú thích)
    → detectGrid()       (dò nhãn trục lưới, loại trục của key plan)
    → extract()          (chọn "grammar" theo họ bản vẽ: isAC/isFS/isMP/CSD)
    → runRules()         (bộ rule theo họ + rule cross-sheet + slope engine)
    → render() / exportXlsx()
```

Những điểm kiến trúc đáng khen:

- **Bố cục có đánh số mục** (0. bootstrap → 7. driver), comment giải thích **lý do** chứ không chỉ mô tả code. Ví dụ vì sao phải ngắt dòng theo khoảng trống (`buildLines`), vì sao chỉ ghép cao độ–ống trong cùng khối (leader line kéo text ra xa), vì sao đếm số lần xuất hiện nhãn trục để loại key plan.
- **Tách grammar theo họ bản vẽ**: mỗi họ có tập regex + bộ rule riêng (`RULES`, `RULES_MP`, `RULES_AC`), vì hai họ ghi cùng một vật thể vật lý theo cách không tương thích. Đây là quyết định thiết kế đúng.
- **Rule engine chống lỗi lan**: mỗi rule chạy trong `try/catch` riêng — một rule hỏng không giết cả phiên kiểm tra.
- **Tự viết XLSX writer** (ZIP store + CRC32 + OOXML tối giản) thay vì kéo cả SheetJS: giữ được cam kết offline và kích thước nhỏ. Rất ấn tượng về mặt kỹ thuật.
- **Không phụ thuộc mạng lúc chạy**: service worker cache-first, font và pdf.js đều inline. Cam kết "không gửi bản vẽ đi đâu" là **thật** ở cấp độ mã nguồn.

---

## 3. Chất lượng miền (domain) — điểm mạnh nổi bật

Đây là phần khiến ứng dụng vượt trên một "PDF text scraper" thông thường. Bộ rule thể hiện hiểu biết công trình MEP thực sự:

- **Cao độ / datum**: bắt datum thiếu số tầng (`FL` vs `1FL`), phân biệt mặt cắt cắt qua nhiều tầng (bình thường) với plan một tầng (lỗi), bắt "nghi gõ thiếu chữ số" khi lệch xấp xỉ một bậc 10/100/1000 mm (`EL-02`).
- **Độ dốc thoát nước**: cả đọc trực tiếp nhãn `%` trên bản vẽ (`MP-08/09`) lẫn **bảng kiểm độ dốc tương tác** — engineer chọn 2 điểm, app đo khoảng cách theo **tỷ lệ tự hiệu chuẩn từ chuỗi kích thước** (`calibrate()` dùng median để chống nhiễu), rồi tính `Δh/L`, so ngưỡng theo DN. Rất thực dụng: tác giả **cố tình không đoán** cặp điểm (vì leader line làm sai lệch), giao lại cho người dùng — một lựa chọn kỹ thuật chín chắn.
- **VRF (AC)**: kiểm tổ hợp mô-đun bằng mã dàn nóng (`RAS-xxCNBCMQ`), tỷ lệ kết nối 50–130% (Hitachi), chiều dài tuyến ống, và **đối chiếu sơ đồ nguyên lý ↔ mặt bằng mái** (số mô-đun mỗi hệ).
- **Vật lý cơ bản đúng**: vận tốc gió `v = Q/3600/A` với ngưỡng 6/9 m/s; chống hút lại khí thải (miệng xả gần miệng lấy gió tươi); cấp nước không được chạy dưới thoát nước.
- **Định vị theo lưới trục**: mỗi nhận xét gắn tọa độ dạng `DX4–DX5 / DY2`, phân biệt "nằm giữa hai trục", "ngoài trục cuối" (`DY16+`), "trước trục đầu" (`<DY1`).

Mức độ **trung thực về giới hạn** cũng rất cao: app nói rõ chỉ đọc chữ, không đọc nét, không tự phát hiện va chạm hình học; sheet ngoài phạm vi (giá đỡ, trần, key plan) được **báo rõ thay vì im lặng** (`NA-01`, `OUT_OF_SCOPE`); ngưỡng độ dốc ghi rõ là "thông lệ công trường VN, không phải tra TCVN/QCVN".

---

## 4. UX / giao diện

- Chủ đề "bản vẽ kỹ thuật" nhất quán (khung tên, register marks, hiệu ứng plotter sweep khi parse) — đẹp và phù hợp ngữ cảnh.
- Song ngữ đầy đủ, kể cả nội dung nhận xét (không chỉ nhãn UI).
- Có filter theo mức (Lỗi/Cảnh báo/Ghi nhận), bảng dữ liệu bóc được (drawer), responsive cho điện thoại, tôn trọng `prefers-reduced-motion`.
- Xử lý trạng thái rỗng đàng hoàng: phân biệt "PDF scan không có text" vs "đọc được nhưng không nhận ra nhãn".

---

## 5. Bảo mật & quyền riêng tư

- **Không rò rỉ dữ liệu**: toàn bộ xử lý client-side, không `fetch`/`XHR` tới máy chủ ngoài. Service worker chỉ cache origin của chính nó.
- **XSS**: mọi nội dung động khi render đều qua `esc()`; xuất XLSX qua `xesc()` (lọc cả ký tự điều khiển). Không thấy đường dẫn dữ liệu bản vẽ đi thẳng vào `innerHTML` mà không escape.
- Không dùng `eval`; worker của pdf.js tạo từ Blob của source đã inline.

Kết luận: mô hình bảo mật/riêng tư **vững**, phù hợp với dữ liệu bản vẽ nhạy cảm của dự án.

---

## 6. Điểm cần lưu ý / gợi ý cải thiện

Không có lỗi nghiêm trọng. Các điểm dưới đây là nhỏ hoặc mang tính hoàn thiện:

1. **Mất focus/scroll khi đổi ngôn ngữ trong lúc đang nhập bảng độ dốc**: `applyLang()` gọi `render()` dựng lại toàn bộ DOM, các ô `<select>/<input>` của bảng dốc bị tạo lại. Không mất dữ liệu (state nằm ở `S.slopes`) nhưng gián đoạn thao tác. Có thể re-render cục bộ.
2. **Ternary chết trong `acVsPlanRule` (`AC-09`)**: `a.sheets ? host : host` luôn trả `host`. Vô hại nhưng nên dọn.
3. **`buildXlsx` cắt tên sheet sau khi escape**: `xesc(title).slice(0,28)` có thể cắt giữa một entity (`&amp;`) tạo XML hỏng. Hiện `title` cố định là "Comment Sheet" nên chưa phát sinh, nhưng là lỗi tiềm ẩn nếu sau này tên sheet động — nên `slice` trước khi `xesc`.
4. **Rule vận tốc gió chỉ chạy khi đúng 1 quạt/sheet** (`fans.length !== 1` thì bỏ). Sheet nhiều quạt sẽ không được kiểm — có thể mở rộng ghép quạt–ống theo khoảng cách.
5. **Regex có cờ `/g` dùng lại nhiều nơi**: đã xử lý an toàn qua `allMatches()` (reset `lastIndex`) và `try/catch`, nhưng cần giữ kỷ luật này khi thêm rule mới để tránh bug trạng thái `lastIndex`.
6. **Không có test tự động**: với một rule engine phức tạp thế này, một bộ fixture PDF/text mẫu + kỳ vọng finding sẽ giúp chống hồi quy khi thêm quy ước ghi chú mới. Nút "Xuất text thô" đã là nền tảng tốt để dựng fixture.
7. **Đồng bộ số phiên bản thủ công**: mỗi lần đổi `index.html` phải nhớ bump `CACHE` trong `sw.js` (README có ghi rõ). Dễ quên; có thể tự sinh version từ hash lúc build nếu sau này có pipeline.
8. **Khả năng tiếp cận (a11y)**: đã tốt (aria-pressed, focus-visible, nhãn nút). Có thể bổ sung `aria-live` cho vùng `#status` để trình đọc màn hình đọc tiến trình.

---

## 7. Kết luận

**Đây là một ứng dụng được viết rất tốt và chín chắn.** Nó giải một bài toán hẹp, thực tế của công trường bằng cách tiếp cận thực dụng đúng đắn: đọc lớp text thay vì cố "hiểu" hình học, tự động hóa phần máy làm giỏi (đối chiếu, số học, phát hiện bất thường) và **giao lại cho người** phần dễ đoán sai (ghép cặp điểm độ dốc). Chất lượng mã, tổ chức, comment giải thích lý do, cam kết offline/riêng tư, và độ sâu hiểu biết miền MEP đều ở mức cao.

| Tiêu chí | Đánh giá |
|---|---|
| Kiến trúc & tổ chức mã | ★★★★★ |
| Chất lượng miền (rule MEP) | ★★★★★ |
| Bảo mật & riêng tư | ★★★★★ |
| UX / giao diện | ★★★★☆ |
| Khả năng bảo trì (test/versioning) | ★★★☆☆ |

**Khuyến nghị ưu tiên**: (1) thêm bộ test fixture từ text thô để chống hồi quy; (2) tự động hóa việc bump version của service worker. Ngoài ra ứng dụng đã sẵn sàng dùng thực tế.


---

## 8. Cập nhật v2.3 — đọc nét vẽ vector

Hai khuyến nghị ưu tiên ở mục 7 đã được thực hiện, cùng với việc mở rộng phạm vi
sang nét vẽ.

### Đã làm

| Việc | Kết quả |
|---|---|
| **Đọc nét vẽ vector** | Qua `page.getOperatorList()` của pdf.js — nét vẽ CAD là dữ liệu vector nên đọc trực tiếp, không cần OCR, giữ nguyên cam kết offline |
| **Ngăn xếp ma trận** | Xử lý `cm` (CTM) và form XObject `/Matrix`, đúng cách bản vẽ CAD thật lồng nội dung |
| **Gắn nhãn ↔ tuyến** | Mỗi nhãn hệ thống được nối với tuyến gần nhất trong bán kính vài lần chiều cao chữ |
| **Đo chiều dài thật** | Theo tỷ lệ tự hiệu chuẩn từ chuỗi kích thước của chính sheet |
| **Va chạm 2.5D (`GX-01`/`GX-02`)** | Cắt nhau trên mặt bằng (từ nét) + chồng cao độ (từ nhãn), kèm vị trí lưới trục |
| **Khung xem lại nét vẽ** | Canvas trong drawer: xám = nét đọc được, đen = tuyến có nhãn, vòng tròn = điểm giao |
| **Bộ kiểm thử tự động** | `tests/run.js` — 25 assertion trên 2 bản vẽ mẫu có kích thước biết trước |

### Cách lọc nhiễu — điểm thiết kế đáng ghi nhận

Bản đánh giá ban đầu dự đoán "phần khó nhất không phải đọc nét, mà là lọc
nhiễu". Lời giải chọn dùng tránh được bài toán đó thay vì đối đầu: **chỉ những
tuyến có nhãn gắn vào mới tham gia kiểm tra**. Hatching, khung tên, đường kích
thước vẫn được đọc nhưng không nhãn nào nhận, nên tự động bị bỏ qua — không cần
phân loại nét, không cần ngưỡng đoán mò.

### Bộ test đã chứng minh giá trị ngay lập tức

Trong lần chạy đầu, test bắt được một lỗi thật: trường neo `h` (chiều cao chữ)
ghi đè lên `h` (chiều cao ống), biến `900x700` thành `900x8` và làm sai toàn bộ
phép kiểm va chạm. Lỗi này sẽ không lộ ra qua kiểm tra bằng mắt vì app vẫn chạy
và vẫn xuất báo cáo — chỉ có con số là sai.

### Đánh giá lại

| Tiêu chí | Trước | Sau |
|---|---|---|
| Kiến trúc & tổ chức mã | ★★★★★ | ★★★★★ |
| Chất lượng miền (rule MEP) | ★★★★★ | ★★★★★ |
| Bảo mật & riêng tư | ★★★★★ | ★★★★★ (không đổi — vẫn không gọi mạng) |
| UX / giao diện | ★★★★☆ | ★★★★★ (khung xem lại nét vẽ giúp kiểm chứng) |
| Khả năng bảo trì | ★★★☆☆ | ★★★★☆ (đã có test; version SW vẫn bump tay) |

### Còn lại

- **Chưa kiểm chứng trên bản vẽ thật** — toàn bộ test chạy trên bản vẽ tổng hợp.
  Nét vẽ CAD thật lộn xộn hơn nhiều (ống gió vẽ 2 nét song song, leader line dài,
  block lồng nhau). Khung xem lại nét vẽ chính là công cụ để đánh giá điều này.
- Các điểm nhỏ ở mục 6 (ternary chết `AC-09`, `slice` sau `xesc`, rule vận tốc
  gió chỉ chạy với 1 quạt) vẫn chưa xử lý.
- Version service worker vẫn phải bump thủ công.
