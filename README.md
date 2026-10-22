# Business Hub

Ứng dụng Next.js nằm trong `nextjs-app/`. Có thể chạy các lệnh npm ngay tại thư mục gốc `D:\GitHub\business-hub`.

```sh
# Cài thư viện khi mới tải mã nguồn
npm --prefix nextjs-app ci

# Chạy môi trường phát triển
npm run dev
```

Mở http://localhost:3000 sau khi terminal báo Ready. Trong PowerShell, nếu `npm.ps1` bị chặn, dùng `npm.cmd` thay cho `npm`.

Các lệnh `npm run build`, `npm start`, `npm run lint`, `npm run typecheck` và `npm test` ở gốc cũng chuyển tiếp tới ứng dụng Next.js. `npm run test:legacy` kiểm tra bản HTML cũ.

Xem [hướng dẫn ứng dụng Next.js](nextjs-app/README.md) để biết chức năng và cách đăng nhập đồng bộ Firebase thật. Bản HTML cũ nằm tại `public/index.html`; các script Firebase ở gốc vẫn triển khai bản HTML này.
