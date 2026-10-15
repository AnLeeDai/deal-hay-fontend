import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

function transpileModule(relativePath, imports) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  const source = outputText.replace(
    /from (["'])([^"']+)\1/g,
    (match, quote, specifier) => {
      assert.ok(imports[specifier], `Unmocked import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    }
  )
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
}

const validationUrl = transpileModule("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const { updateProfileSchema } = await import(
  transpileModule("../src/modules/profile/schemas/profile.ts", {
    zod: import.meta.resolve("zod"),
    "@/lib/validation": validationUrl,
  })
)
const profile = {
  full_name: "Nguyễn An",
  email: "address@example.com",
  phone_number: "",
  province: "",
  ward: "",
  address_detail: "",
}

test("profiles without an address can still be saved", () => {
  assert.equal(updateProfileSchema.safeParse(profile).success, true)
})

test("complete selected addresses can be saved", () => {
  assert.equal(
    updateProfileSchema.safeParse({
      ...profile,
      province: "Thành phố Hà Nội",
      ward: "Phường Hoàn Kiếm",
      address_detail: "12 Hàng Bài",
    }).success,
    true
  )
})

test("changing a province requires choosing its ward again", () => {
  const result = updateProfileSchema.safeParse({
    ...profile,
    province: "Tỉnh Cao Bằng",
  })
  assert.equal(result.success, false)
  assert.deepEqual(result.error.flatten().fieldErrors, {
    ward: ["Vui lòng chọn phường/xã thuộc tỉnh/thành đã chọn."],
  })
})

test("a street alone requires both province and ward selections", () => {
  const result = updateProfileSchema.safeParse({
    ...profile,
    address_detail: "12 Hàng Bài",
  })
  assert.equal(result.success, false)
  assert.deepEqual(result.error.flatten().fieldErrors, {
    province: ["Vui lòng chọn tỉnh/thành từ danh sách."],
    ward: ["Vui lòng chọn phường/xã thuộc tỉnh/thành đã chọn."],
  })
})

test("a saved ward without a province requires selecting the province", () => {
  const result = updateProfileSchema.safeParse({
    ...profile,
    ward: "Phường Hoàn Kiếm",
  })
  assert.equal(result.success, false)
  assert.deepEqual(result.error.flatten().fieldErrors, {
    province: ["Vui lòng chọn tỉnh/thành từ danh sách."],
  })
})
