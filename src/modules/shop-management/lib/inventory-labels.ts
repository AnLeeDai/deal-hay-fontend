import type { ShopProduct } from "@/types/shop"

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

export function inventoryLabels(products: ShopProduct[]): InventoryLabel[] {
  return products.flatMap((product) =>
    product.has_variants
      ? product.variants
          .filter((variant) => !variant.retired_at)
          .map((variant) => ({
            id: variant.id,
            code: `DH:V:${variant.id}`,
            sku: variant.sku,
            name: product.name,
            variant:
              variant.variant_label ||
              Object.entries(variant.option_values ?? {})
                .map(([name, value]) => `${name}: ${value}`)
                .join(" / "),
            stock: variant.stock,
            active: product.is_active && variant.is_active,
            price: variant.price ?? product.price,
          }))
      : [
          {
            id: product.id,
            code: `DH:P:${product.id}`,
            sku: product.sku ?? "",
            name: product.name,
            variant: "",
            stock: product.stock,
            active: product.is_active,
            price: product.price,
          },
        ]
  )
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
  copies: number
): Promise<void> {
  if (
    !labels.length ||
    !Number.isInteger(copies) ||
    copies < 1 ||
    copies > 100 ||
    labels.length * copies > 1000
  )
    throw new Error(
      "Chọn sản phẩm và số tem từ 1–100, tối đa 1000 tem mỗi lần in."
    )
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
        const image = await QRCode.toDataURL(label.code, {
          width: 240,
          margin: 4,
          errorCorrectionLevel: "M",
        })
        const card = `<article><img src="${image}" alt="QR"><div><strong>${escapeHtml(label.name)}</strong><p>${escapeHtml(label.variant)}</p><p>${escapeHtml(label.sku || label.code)}</p></div></article>`
        return Array.from({ length: copies }, () => card).join("")
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
