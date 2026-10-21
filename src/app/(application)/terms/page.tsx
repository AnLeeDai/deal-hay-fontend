import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Điều khoản sử dụng" }

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 text-sm leading-7">
      <h1 className="font-heading text-3xl font-semibold">
        Điều khoản sử dụng Deal Hay
      </h1>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">1. Tài khoản</h2>
        <p>
          Bạn cần cung cấp thông tin liên hệ chính xác, bảo mật mật khẩu và chịu
          trách nhiệm về hoạt động trên tài khoản của mình. Không sử dụng tài
          khoản của người khác hoặc giả mạo cá nhân, cửa hàng.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          2. Thông tin sản phẩm và đặt hàng
        </h2>
        <p>
          Người bán chịu trách nhiệm về mô tả, hình ảnh, giá bán, tồn kho và khả
          năng giao hàng của sản phẩm. Người mua cần kiểm tra sản phẩm, giá,
          điều kiện ưu đãi và địa chỉ nhận hàng trước khi xác nhận đơn.
        </p>
        <p>
          Ưu đãi có thể kèm điều kiện được hiển thị trong quá trình đặt hàng.
          Giá và tổng tiền ở bước xác nhận là thông tin bạn cần kiểm tra trước
          khi đặt.
        </p>
        <p>
          Mã giảm giá đã có dành cho tài khoản nhận mã và sản phẩm được ghi trên
          mã. Bạn có thể dùng mã trong mục Mã giảm giá trước ngày hết hạn. Có
          thể cộng nhiều mã của cùng sản phẩm để giảm tiền hàng đến 0đ. Mỗi mã
          chỉ áp dụng một lần cho một đơn hàng; mã chưa cần dùng khi tiền hàng
          đã về 0đ được giữ lại. Mức giảm và hạn dùng được hiển thị trên mã.
        </p>
        <p>
          Deal Hay sử dụng quảng cáo Adsterra, gồm Social Bar, Popunder và
          Native Banner. Quảng cáo có thể mở trang của đối tác trong tab hoặc
          cửa sổ mới. Banner quảng cáo được đánh dấu riêng với nội dung sản
          phẩm. Việc mở quảng cáo không cấp mã giảm giá hoặc thay đổi giá đơn
          hàng. Nội dung trên trang quảng cáo bên thứ ba tuân theo điều khoản
          của bên cung cấp trang đó.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          3. Nội dung, đánh giá và trao đổi
        </h2>
        <p>
          Chỉ đăng nội dung bạn có quyền sử dụng. Không đăng thông tin sai sự
          thật, nội dung vi phạm quyền của người khác, spam hoặc sử dụng tin
          nhắn để quấy rối. Đánh giá sản phẩm phải dựa trên giao dịch và trải
          nghiệm thực tế của bạn.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">4. Xử lý vi phạm và hỗ trợ</h2>
        <p>
          Deal Hay có thể xem xét nội dung bị báo cáo, gỡ nội dung hoặc khóa tài
          khoản, gian hàng vi phạm. Khi cần hỗ trợ về tài khoản, sản phẩm hoặc
          giao dịch, hãy sử dụng chức năng hỗ trợ, phản ánh hoặc nhắn tin trong
          hệ thống và cung cấp thông tin liên quan.
        </p>
      </section>
      <p>
        Việc xử lý thông tin của bạn được trình bày tại{" "}
        <Link className="text-primary underline" href="/privacy">
          Chính sách bảo mật
        </Link>
        .
      </p>
      <Link className="inline-block text-primary underline" href="/sign-up">
        Quay lại đăng ký
      </Link>
    </article>
  )
}
