import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      "../src/modules/shop-management/lib/stocktake-report.ts",
      import.meta.url
    ),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const { stocktakeCsv } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
)

// Read complete CSV records, including quotes and CRLF embedded inside fields.
function records(csv) {
  const rows = []
  let row = [],
    value = "",
    quoted = false
  const input = csv.replace(/^\ufeff/, "")
  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        value += '"'
        index++
      } else quoted = !quoted
    } else if (char === "," && !quoted) {
      row.push(value)
      value = ""
    } else if (char === "\r" && input[index + 1] === "\n" && !quoted) {
      row.push(value)
      rows.push(row)
      row = []
      value = ""
      index++
    } else value += char
  }
  row.push(value)
  rows.push(row)
  return rows
}

const physicalUnit = (id, expected, counted) => ({
  id: `entry-${id}`,
  inventory_unit_id: id,
  sku: `DHU-${id}`,
  code: `DH:U:${id}`,
  expected,
  counted,
})
function line(overrides = {}) {
  return {
    id: "item",
    code: "DH:P:catalog-id",
    sku: "CATALOG-SKU",
    product_name: "Áo thun",
    variant_name: "Đỏ / M",
    expected_quantity: 2,
    counted_quantity: 1,
    difference: -1,
    is_unknown: false,
    result: "shortage",
    shortage_quantity: 1,
    surplus_quantity: 0,
    unit_price: 100000,
    values: {
      expected_value: 200000,
      counted_value: 100000,
      shortage_value: 100000,
      surplus_value: 0,
    },
    units: [physicalUnit("one", true, true), physicalUnit("two", true, false)],
    ...overrides,
  }
}
function session(overrides = {}) {
  return {
    id: "session",
    name: "Kiểm kê tháng 10",
    status: "completed",
    counting_mode: "serialized",
    stock_adjusted: true,
    created_at: "2026-10-24T00:00:00Z",
    saved_at: "2026-10-24T01:00:00Z",
    completed_at: "2026-10-24T01:00:00Z",
    confirmed_at: "2026-10-24T01:00:00Z",
    confirmed_by: "shop-owner",
    confirmation_token: null,
    valuation_basis: "sale_price",
    summary: { expected: 2, counted: 1, shortage: 1, surplus: 0, unknown: 0 },
    financial_summary: {
      expected_value: 200000,
      counted_value: 100000,
      shortage_value: 100000,
      surplus_value: 0,
      net_difference_value: -100000,
      debt_amount: 100000,
    },
    items: [line()],
    ...overrides,
  }
}
function detailRows(csv) {
  const rows = records(csv)
  const start = rows.findIndex((row) => row[0] === "Sản phẩm") + 1
  const end = rows.findIndex(
    (row, index) => index >= start && row.length === 1 && row[0] === ""
  )
  return rows.slice(start, end < 0 ? undefined : end)
}

test("CSV exports each issued physical SKU and QR exactly once with confirmed report metadata", () => {
  const csv = stocktakeCsv(session())
  assert.ok(csv.startsWith("\ufeff"))
  const rows = records(csv)
  assert.deepEqual(rows.slice(0, 5), [
    ["Phiên kiểm kê", "Kiểm kê tháng 10"],
    ["Trạng thái", "Đã xác nhận chốt"],
    ["Cơ sở giá", "Giá bán tại lúc xác nhận chốt"],
    ["Thời điểm chốt", "2026-10-24T01:00:00Z"],
    ["Người xác nhận", "shop-owner"],
  ])
  assert.deepEqual(detailRows(csv), [
    [
      "Áo thun",
      "Đỏ / M",
      "DHU-one",
      "DH:U:one",
      "1",
      "1",
      "100000",
      "0",
      "0",
      "Đủ",
    ],
    [
      "Áo thun",
      "Đỏ / M",
      "DHU-two",
      "DH:U:two",
      "1",
      "0",
      "100000",
      "100000",
      "0",
      "Thiếu",
    ],
  ])
  assert.ok(!csv.includes("CATALOG-SKU"))
  assert.ok(!csv.includes("DH:P:catalog-id"))
})

test("a missing serial and a surplus serial remain separate discrepancies at equal total quantities", () => {
  const csv = stocktakeCsv(
    session({
      items: [
        line({
          expected_quantity: 1,
          counted_quantity: 1,
          difference: 0,
          shortage_quantity: 1,
          surplus_quantity: 1,
          units: [
            physicalUnit("missing", true, false),
            physicalUnit("found", false, true),
            physicalUnit("undone", false, false),
          ],
        }),
      ],
      financial_summary: {
        expected_value: 100000,
        counted_value: 100000,
        shortage_value: 100000,
        surplus_value: 100000,
        net_difference_value: 0,
        debt_amount: 100000,
      },
    })
  )
  const details = detailRows(csv)
  assert.deepEqual(
    details.map((row) => [row[2], row[7], row[8], row[9]]),
    [
      ["DHU-missing", "100000", "0", "Thiếu"],
      ["DHU-found", "0", "100000", "Thừa"],
      ["DHU-undone", "0", "0", "Đã bỏ ghi nhận"],
    ]
  )
  assert.ok(
    records(csv).some(
      (row) =>
        row[0] === "Công nợ thiếu hàng cần đối soát" && row[1] === "100000"
    )
  )
  assert.ok(
    records(csv).some(
      (row) => row[0] === "Chênh lệch ròng (thừa - thiếu)" && row[1] === "0"
    )
  )
})

test("a zero sale price stays an explicit zero and is distinct from unvalued unknown stock", () => {
  const zero = line({
    unit_price: 0,
    units: [physicalUnit("free", true, false)],
  })
  const unknown = line({
    id: "unknown",
    product_name: "Mã không thuộc kho",
    variant_name: null,
    sku: null,
    code: "UNKNOWN-QR",
    is_unknown: true,
    result: "unknown",
    expected_quantity: 0,
    counted_quantity: 1,
    unit_price: null,
    values: null,
    units: [],
  })
  const rows = detailRows(
    stocktakeCsv(session({ items: [zero, unknown], financial_summary: null }))
  )
  assert.deepEqual(rows[0].slice(6, 10), ["0", "0", "0", "Thiếu"])
  assert.deepEqual(rows[1].slice(6, 10), [
    "",
    "",
    "",
    "Mã lạ, không tính công nợ",
  ])
  assert.equal(rows[1][5], "1")
})

test("CSV retains server-frozen financial totals without deriving liability from display rows or netting surplus", () => {
  const financial = {
    expected_value: 300000,
    counted_value: 125000,
    shortage_value: 200000,
    surplus_value: 25000,
    net_difference_value: -175000,
    debt_amount: 200000,
  }
  const csv = stocktakeCsv(
    session({
      financial_summary: financial,
      items: [line({ current_catalog_price: 999999 })],
    })
  )
  const rows = records(csv)
  assert.ok(
    rows.some((row) => row[0] === "Tổng giá trị thiếu" && row[1] === "200000")
  )
  assert.ok(
    rows.some((row) => row[0] === "Tổng giá trị thừa" && row[1] === "25000")
  )
  assert.ok(
    rows.some(
      (row) =>
        row[0] === "Công nợ thiếu hàng cần đối soát" && row[1] === "200000"
    )
  )
  assert.ok(
    rows.some(
      (row) =>
        row[0] === "Chênh lệch ròng (thừa - thiếu)" && row[1] === "-175000"
    )
  )
  assert.equal(detailRows(csv)[0][6], "100000")
  assert.ok(!csv.includes("999999"))
})

test("unknown codes never contribute money and legacy finalized reports do not invent a debt total", () => {
  const unknown = line({
    is_unknown: true,
    result: "unknown",
    product_name: "Mã không thuộc kho",
    variant_name: null,
    sku: null,
    code: "FOREIGN-QR",
    expected_quantity: 0,
    counted_quantity: 1,
    unit_price: null,
    values: null,
    units: [],
  })
  const csv = stocktakeCsv(session({ items: [line(), unknown] }))
  assert.deepEqual(detailRows(csv)[2].slice(6, 9), ["", "", ""])
  assert.ok(
    records(csv).some(
      (row) =>
        row[0] === "Công nợ thiếu hàng cần đối soát" && row[1] === "100000"
    )
  )
  const legacy = stocktakeCsv(
    session({
      counting_mode: "legacy",
      financial_summary: null,
      items: [
        line({ units: undefined, unit_price: undefined, values: undefined }),
      ],
    })
  )
  assert.ok(
    records(legacy).some(
      (row) =>
        row[0] === "Cơ sở giá" && row[1] === "Phiên cũ, không xác định công nợ"
    )
  )
  assert.ok(!legacy.includes("Công nợ thiếu hàng cần đối soát"))
  assert.deepEqual(detailRows(legacy)[0].slice(6, 9), ["", "", ""])
})

test("formula-looking text is neutralized while signed numeric accounting values remain numbers", () => {
  const csv = stocktakeCsv(
    session({
      name: ' \t=HYPERLINK("https://example.test")',
      confirmed_by: "@malicious",
      items: [
        line({
          product_name: "=1+1",
          variant_name: "+CMD",
          units: [physicalUnit("one", true, false)].map((unit) => ({
            ...unit,
            sku: "-1+1",
            code: "@SUM(A1:A9)",
          })),
        }),
      ],
    })
  )
  const rows = records(csv)
  assert.equal(rows[0][1], '\' \t=HYPERLINK("https://example.test")')
  assert.equal(rows[4][1], "'@malicious")
  assert.deepEqual(detailRows(csv)[0].slice(0, 4), [
    "'=1+1",
    "'+CMD",
    "'-1+1",
    "'@SUM(A1:A9)",
  ])
  assert.ok(
    rows.some(
      (row) =>
        row[0] === "Chênh lệch ròng (thừa - thiếu)" && row[1] === "-100000"
    )
  )
})

test("CSV quoting round trips commas, double quotes, Vietnamese and embedded record separators", () => {
  const name = 'Kiểm kê "A,B"\r\nChi nhánh Đà Nẵng'
  const productName = 'Áo "đẹp", dòng 1\r\ndòng 2'
  const csv = stocktakeCsv(
    session({ name, items: [line({ product_name: productName })] })
  )
  assert.equal(records(csv)[0][1], name)
  assert.equal(detailRows(csv)[0][0], productName)
  assert.ok(csv.includes('"Kiểm kê ""A,B""\r\nChi nhánh Đà Nẵng"'))
  assert.ok(!csv.includes("undefined"))
})

test("CSV rejects truncated physical-unit pages rather than exporting incomplete rows beside full totals", () => {
  const partial = session({ items: [line({ units_total: 3 })] })
  assert.throws(() => stocktakeCsv(partial), Error)
  const complete = session({ items: [line({ units_total: 2 })] })
  assert.equal(detailRows(stocktakeCsv(complete)).length, 2)
})

test("draft exports label sale prices as current estimates while finalized reports retain confirmed pricing", () => {
  const csv = stocktakeCsv(
    session({ status: "counting", confirmed_at: null, confirmed_by: null })
  )
  const rows = records(csv)
  assert.deepEqual(
    rows.find((row) => row[0] === "Trạng thái"),
    ["Trạng thái", "Đang kiểm kê"]
  )
  const basis = rows.find((row) => row[0] === "Cơ sở giá")[1]
  assert.match(basis, /Giá bán hiện tại/)
  assert.ok(!basis.includes("lúc xác nhận chốt"))
})
