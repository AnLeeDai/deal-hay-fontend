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
          Các trang mua sắm có thể hiển thị quảng cáo của Google AdSense. Google
          và các đối tác quảng cáo có thể sử dụng cookie, địa chỉ IP và thông
          tin trình duyệt để phân phối, cá nhân hóa và đo lường quảng cáo dựa
          trên những lần bạn truy cập trang này và các trang khác. Xem thêm tại{" "}
          <a
            className="text-primary underline"
            href="https://policies.google.com/technologies/ads?hl=vi"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cách Google sử dụng thông tin cho quảng cáo
          </a>
          .
        </p>
        <p>
          Bạn có thể quản lý lựa chọn và tắt cá nhân hóa quảng cáo tại{" "}
          <a
            className="text-primary underline"
            href="https://myadcenter.google.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Trung tâm quảng cáo của Google
          </a>
          .
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">6. Nhiệm vụ nhận mã giảm giá</h2>
        <p>
          Khi bạn tự chọn tham gia nhiệm vụ, Deal Hay mở trang Offerwall của
          AdGem và gửi mã nhận diện dành cho tích hợp cùng thông tin phiên nhiệm
          vụ để ghi nhận phần thưởng cho đúng tài khoản và sản phẩm. AdGem và
          bên cung cấp nhiệm vụ có thể xử lý địa chỉ IP, thông tin thiết bị,
          trình duyệt và hoạt động của bạn theo chính sách của họ. Xem thêm tại{" "}
          <a
            className="text-primary underline"
            href="https://adgem.com/privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Chính sách bảo mật của AdGem
          </a>
          .
        </p>
        <p>
          Deal Hay nhận thông tin chuyển đổi do đối tác xác nhận, gồm mã nhiệm
          vụ, mã giao dịch, thời điểm hoàn thành và doanh thu ghi nhận, để cấp
          mã giảm giá, đối soát và phòng chống nhận thưởng trùng lặp. Việc tham
          gia nhiệm vụ là tự nguyện và không phải điều kiện để đặt hàng.
        </p>
      </section>
      <Link className="inline-block text-primary underline" href="/sign-up">
        Quay lại đăng ký
      </Link>
    </article>
  )
}
