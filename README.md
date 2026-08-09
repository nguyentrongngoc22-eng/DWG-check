# CSD Drawing Checker

Công cụ kiểm tra bản vẽ MEP từ lớp text của file PDF. Chạy hoàn toàn trong trình duyệt — không gửi bản vẽ đi đâu, không cần mạng sau lần tải đầu.

Dự án: Olympus Vietnam New Building Construction Project.

---

## Đưa lên GitHub Pages

**1. Tạo repository**

Vào github.com → **New repository** → đặt tên, ví dụ `csd-checker` → chọn **Public** → **Create repository**.

> Pages chỉ chạy miễn phí với repo Public. Repo Private cần tài khoản trả phí.

**2. Tải file lên**

Trong repo vừa tạo → **Add file** → **Upload files** → kéo **toàn bộ 7 file** trong thư mục này vào:

```
index.html
manifest.webmanifest
sw.js
icon-180.png
icon-192.png
icon-512.png
icon-512-maskable.png
```

Bấm **Commit changes**.

**3. Bật Pages**

**Settings** → **Pages** → mục *Build and deployment*:
- Source: **Deploy from a branch**
- Branch: **main**, thư mục **/ (root)**
- **Save**

Đợi 1–2 phút. Link sẽ có dạng:

```
https://<tên-tài-khoản>.github.io/csd-checker/
```

---

## Cài lên điện thoại

**Android (Chrome)** — mở link → menu ⋮ → **Cài đặt ứng dụng** / *Install app*.

**iPhone (Safari)** — mở link → nút Chia sẻ → **Thêm vào MH chính** / *Add to Home Screen*.

Sau khi cài, app chạy được cả khi mất mạng — toàn bộ pdf.js và font đã nhúng sẵn trong `index.html`.

---

## Khi cập nhật phiên bản mới

Máy đã cài sẽ giữ bản cũ trong cache nếu không đổi số phiên bản. Mỗi lần thay `index.html`, **phải sửa luôn dòng đầu trong `sw.js`**:

```js
const CACHE = 'csd-checker-v2.0.0';   →   'csd-checker-v2.1.0'
```

Không đổi dòng này thì máy đã cài sẽ tiếp tục chạy bản cũ.

---

## Phạm vi kiểm tra

App nhận 4 họ bản vẽ, tự phân loại và hiện ở ô **TYPE**:

| Họ | Loại bản vẽ | Ví dụ cú pháp nhãn |
|---|---|---|
| **CSD** | Mặt bằng combine services | `SM_SED : 900x700` · `BOD:RFL+1800` |
| **MP** | Mặt cắt cấp thoát nước | `WW- UPVC-110` · `BOP=B.1FL-2420` |
| **FS** | Phòng cháy + điện + ELV | `BS DN32` · `CR 200x100` · `BOC=1FL+2400` |
| **AC** | Sơ đồ nguyên lý VRF | `OU 1-5 [RAS-62CNBCMQ]` · `f28.58mm` |

Thả **nhiều file cùng lúc** để chạy các phép đối chiếu chéo — ví dụ sơ đồ VRF với mặt bằng mái sẽ so số mô-đun từng hệ.

### Giới hạn

- Chỉ đọc **chữ ghi chú**, không đọc nét vẽ. Không tự phát hiện va chạm hình học — chỉ khoanh vùng các tuyến cùng dải cao độ để người kiểm tra soi mặt cắt.
- PDF scan (không có lớp text) không đọc được.
- Bản vẽ giá đỡ, trần phản chiếu, bố trí chung không mang nhãn hệ thống nên nằm ngoài phạm vi — app sẽ báo rõ thay vì im lặng.

Đây là bộ lọc sơ cấp, không thay thế việc review bản vẽ.

### Gặp bản vẽ app không nhận ra

Bấm **Xuất text thô (.txt)** — file này chứa toàn bộ chuỗi ký tự app đọc được, chỉ vài chục KB, đủ để bổ sung quy ước ghi chú mới mà không phải gửi cả bản vẽ.

---

Developed by Trọng Ngọc
