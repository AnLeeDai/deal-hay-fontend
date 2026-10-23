import type { Stocktake } from "@/types/inventory"

function csvCell(value: string | number | null | undefined): string {
  let text = String(value ?? "")
  if (typeof value === "string" && /^\s*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function stocktakeCsv(session: Stocktake): string {
  if (
    session.items.some(
      (item) => (item.units_total ?? 0) > (item.units?.length ?? 0)
    )
  ) {
    throw new Error("Chưa tải đủ mã đơn vị để xuất biên bản kiểm kê.")
  }
  const rows: (string | number | null | undefined)[][] = [
    ["Phiên kiểm kê", session.name],
    [
      "Trạng thái",
      session.status === "completed" ? "Đã xác nhận chốt" : "Đang kiểm kê",
    ],
    [
      "Cơ sở giá",
      session.counting_mode === "serialized"
        ? session.status === "completed"
          ? "Giá bán tại lúc xác nhận chốt"
          : "Giá bán hiện tại (dự tính)"
        : "Phiên cũ, không xác định công nợ",
    ],
    ["Thời điểm chốt", session.confirmed_at],
    ["Người xác nhận", session.confirmed_by],
    [
      "Sản phẩm",
      "Biến thể",
      "SKU đơn vị",
      "QR",
      "Tồn đầu phiên",
      "Thực đếm",
      "Giá bán / đơn vị",
      "Tiền thiếu",
      "Tiền thừa",
      "Kết quả",
    ],
  ]
  for (const item of session.items) {
    const price = item.unit_price
    if (item.units?.length) {
      for (const unit of item.units) {
        const missing = unit.expected && !unit.counted
        const surplus = !unit.expected && unit.counted
        rows.push([
          item.product_name,
          item.variant_name,
          unit.sku,
          unit.code,
          Number(unit.expected),
          Number(unit.counted),
          price,
          price == null ? null : missing ? price : 0,
          price == null ? null : surplus ? price : 0,
          missing
            ? "Thiếu"
            : surplus
              ? "Thừa"
              : unit.counted
                ? "Đủ"
                : "Đã bỏ ghi nhận",
        ])
      }
    } else {
      rows.push([
        item.product_name,
        item.variant_name,
        item.sku,
        item.code,
        item.expected_quantity,
        item.counted_quantity,
        price,
        item.values?.shortage_value,
        item.values?.surplus_value,
        item.is_unknown ? "Mã lạ, không tính công nợ" : item.result,
      ])
    }
  }
  if (session.financial_summary) {
    rows.push(
      [],
      ["Tổng giá trị thiếu", session.financial_summary.shortage_value],
      ["Tổng giá trị thừa", session.financial_summary.surplus_value],
      [
        "Chênh lệch ròng (thừa - thiếu)",
        session.financial_summary.net_difference_value,
      ],
      [
        "Công nợ thiếu hàng cần đối soát",
        session.financial_summary.debt_amount,
      ],
      [
        "Ghi chú",
        "Hàng thừa theo dõi riêng; không tự bù trừ công nợ thiếu hàng. Mã lạ không định giá.",
      ]
    )
  }
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
}
