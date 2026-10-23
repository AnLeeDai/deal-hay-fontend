import type { InventoryUnit } from "@/types/inventory-unit"

export type InventoryLabel = {
  id: string
  code: string
  sku: string
  name: string
  variant: string
  stock: number
  active: boolean
  price: number
}

export function inventoryLabels(units: InventoryUnit[]): InventoryLabel[] {
  return units.map((unit) => ({
    id: unit.id,
    code: unit.sku,
    sku: unit.sku,
    name: unit.product_name,
    variant: unit.variant_name ?? "",
    stock: unit.stock,
    active: unit.is_active && unit.status === "available",
    price: unit.price,
  }))
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!
  )
}

export async function printInventoryLabels(
  labels: InventoryLabel[],
  copies = 1
): Promise<void> {
  if (!labels.length || labels.length > 1000 || copies !== 1) {
    throw new Error("Mỗi đơn vị chỉ được in một tem mỗi lần, tối đa 1000 tem.")
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (
    labels.some(
      (label) =>
        !uuid.test(label.id) ||
        label.code !== label.sku ||
        label.stock !== 1 ||
        !label.sku.trim() ||
        label.sku !== label.sku.trim() ||
        label.sku.length > 100
    )
  ) {
    throw new Error(
      "Chỉ in tem có SKU và QR riêng từng đơn vị hàng hóa; không dùng mã sản phẩm hoặc biến thể gộp."
    )
  }
  if (
    new Set(labels.map(({ code }) => code)).size !== labels.length ||
    new Set(labels.map(({ id }) => id.toLowerCase())).size !== labels.length ||
    new Set(labels.map(({ sku }) => sku.trim().toUpperCase())).size !==
      labels.length
  ) {
    throw new Error(
      "Danh sách có SKU hoặc mã QR trùng. Mỗi đơn vị chỉ được chọn một lần."
    )
  }
  const popup = window.open("", "_blank", "width=900,height=700")
  if (!popup)
    throw new Error(
      "Trình duyệt đang chặn cửa sổ in. Hãy cho phép mở cửa sổ để in tem."
    )
  popup.document.title = "Tem sản phẩm Deal Hay"
  popup.document.body.textContent = "Đang tạo tem QR…"
  try {
    const { default: QRCode } = await import("qrcode")
    const cards = await Promise.all(
      labels.map(async (label) => {
        const image = await QRCode.toDataURL(label.sku, {
          width: 240,
          margin: 4,
          errorCorrectionLevel: "M",
        })
        const card = `<article><img src="${image}" alt="QR SKU"><div><strong>${escapeHtml(label.name)}</strong><p>${escapeHtml(label.variant)}</p><p>${escapeHtml(label.sku)}</p></div></article>`
        return card
      })
    )
    popup.document.open()
    popup.document.write(
      `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Tem sản phẩm Deal Hay</title><style>@page{size:A4;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#000;background:#fff}.labels{display:grid;grid-template-columns:repeat(3,60mm);gap:3mm;justify-content:center}article{width:60mm;min-height:32mm;display:flex;align-items:center;border:1px dashed #888;padding:1mm;break-inside:avoid;overflow-wrap:anywhere}img{width:28mm;height:28mm;flex-shrink:0}strong{font-size:10px}p{font-size:9px;margin:4px 0}@media screen{body{padding:20px}}</style></head><body><main class="labels">${cards.join("")}</main></body></html>`
    )
    popup.document.close()
    await Promise.all(
      Array.from(popup.document.images).map((image) => image.decode())
    )
    popup.focus()
    popup.print()
  } catch (error) {
    popup.close()
    throw error
  }
}
