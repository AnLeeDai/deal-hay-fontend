import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Chính sách bảo mật" }

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 text-sm leading-7">
      <h1 className="font-heading text-3xl font-semibold">
        Chính sách bảo mật Deal Hay
      </h1>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">1. Thông tin được cung cấp</h2>
        <p>
          Khi sử dụng Deal Hay, bạn có thể cung cấp email, họ tên, số điện
          thoại, địa chỉ, ảnh đại diện, thông tin cửa hàng, đơn hàng, đánh giá,
          tin nhắn, mã giảm giá đã lưu và tệp đính kèm. Hệ thống sử dụng cookie
          đăng nhập để duy trì phiên truy cập.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">2. Mục đích sử dụng</h2>
        <p>
          Thông tin được dùng để đăng nhập và bảo vệ tài khoản, hiển thị hồ sơ
          và cửa hàng, xử lý đơn hàng và giao nhận, trao đổi giữa các bên, gửi
          thông báo và xử lý yêu cầu hỗ trợ.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">3. Phạm vi hiển thị</h2>
        <p>
          Thông tin cửa hàng, sản phẩm và đánh giá được hiển thị cho người xem
          tương ứng. Người bán nhận thông tin liên hệ và giao nhận cần thiết cho
          đơn hàng. Nội dung trao đổi và yêu cầu hỗ trợ được cung cấp cho người
          tham gia và người quản trị có nhiệm vụ xử lý.
        </p>
        <p>
          Bạn nên tránh đưa mật khẩu hoặc thông tin nhạy cảm không cần thiết vào
          nội dung công khai, tin nhắn và tệp đính kèm.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">4. Quản lý thông tin</h2>
        <p>
          Bạn có thể cập nhật thông tin cá nhân và đổi mật khẩu trong hồ sơ. Để
          yêu cầu hỗ trợ về dữ liệu tài khoản, hãy gửi yêu cầu qua chức năng hỗ
          trợ trong hệ thống, nêu rõ tài khoản và nội dung cần xử lý.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">5. Quảng cáo</h2>
        <p>
          Khi bạn đồng ý cookie quảng cáo, các trang mua sắm có thể tải quảng
          cáo của Google. Bạn có thể tự chọn xem quảng cáo có thưởng để nhận ưu
          đãi vận chuyển theo điều kiện được hiển thị trước khi xem.
        </p>
        <p>
          Google và các đối tác quảng cáo có thể sử dụng cookie, địa chỉ IP,
          thông tin thiết bị, trình duyệt và hoạt động tương tác để phân phối,
          đo lường quảng cáo và phòng chống gian lận theo chính sách của họ. Xem
          thêm tại{" "}
          <a
            className="text-primary underline"
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cách Google sử dụng thông tin từ các trang web đối tác
          </a>{" "}
          và{" "}
          <a
            className="text-primary underline"
            href="https://policies.google.com/technologies/ads"
            target="_blank"
            rel="noopener noreferrer"
          >
            Chính sách công nghệ quảng cáo của Google
          </a>
          .
        </p>
        <p>
          Bạn có thể đồng ý hoặc từ chối tại hộp lựa chọn quảng cáo và đổi lựa
          chọn qua nút Tùy chọn cookie quảng cáo trên các trang mua sắm. Script
          quảng cáo chỉ tải sau khi bạn đồng ý. Lựa chọn được lưu bằng cookie
          trong 180 ngày; khi rút lại đồng ý, trang tải lại để dừng quảng cáo.
          Bạn có thể xóa cookie quảng cáo đã lưu trong cài đặt trình duyệt. Việc
          từ chối không ảnh hưởng đến khả năng mua sắm và đặt hàng.
        </p>
      </section>
      <Link className="inline-block text-primary underline" href="/sign-up">
        Quay lại đăng ký
      </Link>
    </article>
  )
}
