# Tests

Kiểm thử tự động cho phần đọc **nét vẽ vector** (linework) — chạy app thật
trong Chromium headless và đối chiếu với bản vẽ mẫu có kích thước biết trước.

## Chạy

```bash
npm install playwright-core          # trong thư mục tests/
node tests/run.js
```

Chromium lấy từ `CHROME_PATH`, mặc định
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

Runner tự dựng một web server tạm trên cổng ngẫu nhiên (service worker và
Blob worker của pdf.js cần `http://`, không chạy được với `file://`).

## Bản vẽ mẫu

`fixtures.py` sinh ra hai file PDF, mỗi nét vẽ đặt ở toạ độ định trước nên mọi
con số trong bài test là **phép tính**, không phải quan sát kết quả chương trình:

```bash
python3 tests/fixtures.py tests/test1.pdf tests/test2.pdf
```

| | Nội dung | Dùng để kiểm |
|---|---|---|
| `test1.pdf` | 3 tuyến (2 tuyến cắt nhau), chuỗi kích thước, nhãn trục, khung tên + hatching | Đọc nét, gắn nhãn ↔ tuyến, đo chiều dài, phát hiện va chạm, lọc nhiễu |
| `test2.pdf` | Cùng va chạm đó nhưng qua `cm` (CTM scale) và form XObject có `/Matrix` riêng | Ngăn xếp ma trận — bản vẽ CAD thật luôn lồng nội dung kiểu này |

Chuỗi kích thước cho **30 mm/đơn vị** (3000 mm mỗi 100 đơn vị), nên tuyến dài
400 đơn vị phải ra đúng 12 000 mm.

## Vì sao có bộ test này

Bản đánh giá (`DANH_GIA.md`) nêu "thiếu test tự động" là điểm yếu bảo trì lớn
nhất. Ngay trong lần phát triển đầu tiên, bộ test đã bắt được một lỗi thật:
trường neo `h` của nhãn ghi đè lên chiều cao ống, khiến `900x700` thành `900x8`
và làm sai toàn bộ phép kiểm va chạm.
