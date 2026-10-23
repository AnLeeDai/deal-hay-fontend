import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"
const url = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function module(path, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  return url(
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, specifier) => {
      assert.ok(imports[specifier], `Unmocked import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}
const validation = module("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const profileSchema = module("../src/modules/profile/schemas/profile.ts", {
  zod: import.meta.resolve("zod"),
  "@/lib/validation": validation,
})
const reviewSchema = module("../src/modules/public/schemas/reviews.ts", {
  zod: import.meta.resolve("zod"),
  "@/lib/validation": validation,
})
const { avatarSchema, preparedAvatarSchema } = await import(profileSchema)
const { reviewProductSchema, preparedReviewProductSchema } = await import(
  reviewSchema
)
const api = url(`
export class ApiError extends Error {}
export const calls=[]
export const revalidatePath=()=>{}
export const updateAvatar=async(...args)=>{calls.push(args);return{message:'Saved'}}
export const updatePassword=()=>{}; export const updateProfile=()=>{}; export const updateShop=()=>{}; export const createShopOwnerUpgrade=()=>{}
export const profileRoutes={avatar:'/private/me/avatar',shopAvatar:'/private/shop/avatar'}
export async function apiFetch(request){calls.push(request);return{uploads:request.body.uploads.map((_,i)=>({token:'token-'+i}))}}
`)
const { calls } = await import(api)
const actions = await import(
  module("../src/modules/profile/actions.ts", {
    "next/cache": api,
    "@/api/client": api,
    "@/api/profile/mutations": api,
    "@/api/profile/routes": api,
    "@/modules/profile/schemas/profile": profileSchema,
  })
)
const { requestProductImageUploadsAction } = await import(
  module("../src/modules/media/actions.ts", {
    zod: import.meta.resolve("zod"),
    "@/api/client": api,
    "@/lib/validation": validation,
  })
)
const finalImage = () =>
  new File([new Uint8Array(20 * 1024)], "final.webp", { type: "image/webp" })
const rawImage = () =>
  new File([new Uint8Array(1024 * 1024)], "camera.jpg", { type: "image/jpeg" })
test.beforeEach(() => {
  calls.length = 0
})
test("avatar/review draft forms accept camera images while final action schemas require prepared files", () => {
  assert.equal(avatarSchema.safeParse({ avatar: rawImage() }).success, true)
  assert.equal(
    preparedAvatarSchema.safeParse({ avatar: rawImage() }).success,
    false
  )
  assert.equal(
    preparedAvatarSchema.safeParse({ avatar: finalImage() }).success,
    true
  )
  const review = {
    reaction: "like",
    content: "Sản phẩm tốt",
    image: rawImage(),
  }
  assert.equal(reviewProductSchema.safeParse(review).success, true)
  assert.equal(preparedReviewProductSchema.safeParse(review).success, false)
  assert.equal(
    preparedReviewProductSchema.safeParse({ ...review, image: finalImage() })
      .success,
    true
  )
  assert.equal(
    preparedReviewProductSchema.safeParse({ ...review, image: undefined })
      .success,
    true
  )
})
test("profile and shop avatar actions forward final bytes unchanged and reject raw sources before the API", async () => {
  for (const action of [
    actions.updateAvatarAction,
    actions.updateShopAvatarAction,
  ]) {
    const form = new FormData()
    form.set("avatar", rawImage())
    const rejected = await action(form)
    assert.equal(rejected.success, false)
    assert.match(rejected.errors.avatar[0], /nén trên thiết bị/)
    assert.equal(calls.length, 0)
    const image = finalImage()
    form.set("avatar", image)
    assert.equal((await action(form)).success, true)
    assert.equal(calls[0][1].get("avatar"), image)
    calls.length = 0
  }
})
test("product staged grants preserve the 512 KiB final WebP budget before reserving API capacity", async () => {
  for (const request of [
    { size: 12000, content_type: "image/png" },
    { size: 512 * 1024 + 1, content_type: "image/webp" },
    { size: 0, content_type: "image/webp" },
  ]) {
    assert.equal(
      (await requestProductImageUploadsAction([request])).success,
      false
    )
  }
  assert.equal(calls.length, 0)
  const result = await requestProductImageUploadsAction([
    { size: 512 * 1024, content_type: "image/webp" },
  ])
  assert.equal(result.success, true)
  assert.deepEqual(result.data.tokens, ["token-0"])
  assert.deepEqual(calls[0].body.uploads, [
    { size: 512 * 1024, content_type: "image/webp" },
  ])
})
