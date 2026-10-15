import {
  ADSTERRA_SMARTLINK_URL,
  ADSTERRA_WEBSITE_SCRIPTS,
} from "@/config/advertising"

export function GET(): Response {
  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Quảng cáo đối tác | Deal Hay</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f5f7fa;color:#172033;font:16px/1.65 system-ui,sans-serif}
    main{width:min(680px,calc(100% - 32px));margin:64px auto;padding:32px;background:white;border:1px solid #dce2ea;border-radius:16px}
    h1{font-size:28px;line-height:1.3;margin:12px 0}p{margin:16px 0}a{color:#2454c5}
    .tag{font-size:13px;color:#64748b}.button{display:inline-block;padding:12px 20px;background:#2454c5;color:white;border-radius:8px;text-decoration:none;font-weight:600}
    .note{font-size:14px;color:#566176}.return{display:inline-block;margin-top:16px}
  </style>
</head>
<body>
  <main>
    <span class="tag">Deal Hay · Quảng cáo đối tác</span>
    <h1>Quảng cáo Adsterra</h1>
    <p>Quảng cáo do đối tác Adsterra cung cấp. Bạn có thể mở quảng cáo bên dưới hoặc quay lại tab sản phẩm để tiếp tục mua sắm.</p>
    <a class="button" href="${ADSTERRA_SMARTLINK_URL.replaceAll("&", "&amp;")}" target="_blank" rel="noopener noreferrer sponsored">Mở quảng cáo đối tác</a>
    <p class="note">Quảng cáo này hiện chưa hỗ trợ nhận mã giảm giá. Việc mở, chờ hoặc đóng trang quảng cáo không cấp mã.</p>
    <a class="return" href="/" rel="noopener">Về trang mua sắm Deal Hay</a>
  </main>
  ${ADSTERRA_WEBSITE_SCRIPTS.map((src) => `<script src="${src}"></script>`).join("\n  ")}
</body>
</html>`

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Content-Security-Policy":
        "frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
    },
  })
}
