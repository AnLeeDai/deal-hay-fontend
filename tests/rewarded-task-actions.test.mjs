import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(path, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  )
  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, specifier) => {
      assert.ok(imports[specifier], `Unexpected import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}

const apiUrl = moduleUrl(`
  export class ApiError extends Error {
    constructor(status, payload) { super(payload.message); this.status = status }
  }
  export const state = { response: undefined, error: undefined, calls: [], revalidated: [] }
  export async function apiFetch(options) {
    state.calls.push(options)
    if (state.error) throw state.error
    return state.response
  }
  export function revalidatePath(path) { state.revalidated.push(path) }
`)
const { ApiError, state } = await import(apiUrl)
const actions = await import(
  transpile("../src/modules/public/rewarded-task-actions.ts", {
    "next/cache": apiUrl,
    "@/api/client": apiUrl,
  })
)
const { RewardedTasks } = await import(
  transpile("../src/modules/public/components/rewarded-tasks.tsx", {
    react: import.meta.resolve("react"),
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "next/link": moduleUrl("export default function Link() {}"),
    "lucide-react": moduleUrl(
      "export function ExternalLinkIcon() {}; export function GiftIcon() {}"
    ),
    "@/components/ui/button": moduleUrl(
      "export function Button() {}; export function buttonVariants() { return '' }"
    ),
    "@/lib/auth-redirect": moduleUrl("export function getAuthPageHref() {}"),
    "@/lib/format": moduleUrl("export function formatCurrency() {}"),
    "@/modules/public/rewarded-task-actions": moduleUrl(
      "export async function checkRewardedTaskAction() {}; export async function loadRewardedTaskConfigAction() {}; export async function startRewardedTaskAction() {}"
    ),
  })
)
const task = {
  id: "task-id",
  status: "pending",
  reward_amount: 1000,
  expires_at: "2026-11-15T00:00:00Z",
  offerwall_url:
    "https://api.adgem.com/v1/wall?appid=123&playerid=customer-id&c1=task-id",
  discount_codes: [],
}

test.beforeEach(() => {
  state.response = undefined
  state.error = undefined
  state.calls.length = 0
  state.revalidated.length = 0
})

test("switching product identity remounts task state, while closing and reopening preserves it", () => {
  const props = {
    active: true,
    disabled: false,
    shopCode: "SHOP-1",
    productSlug: "ao-thun",
    onCodesConfirmed() {},
    onUseCodes() {},
  }
  const initial = RewardedTasks(props)
  assert.equal(RewardedTasks({ ...props, active: false }).key, initial.key)
  assert.equal(RewardedTasks({ ...props, active: true }).key, initial.key)
  assert.notEqual(
    RewardedTasks({ ...props, productSlug: "ao-khoac" }).key,
    initial.key
  )
  assert.notEqual(
    RewardedTasks({ ...props, shopCode: "SHOP-2" }).key,
    initial.key
  )
  assert.notEqual(
    RewardedTasks({ ...props, shopCode: "shop:a", productSlug: "b" }).key,
    RewardedTasks({ ...props, shopCode: "shop", productSlug: "a:b" }).key
  )
})

test("config reads Laravel directly without caching and preserves a disabled provider", async () => {
  state.response = {
    enabled: false,
    reward_amount: 1000,
    reason: "unconfigured",
  }
  const result = await actions.loadRewardedTaskConfigAction(
    "SHOP /1",
    "áo/thun"
  )
  assert.equal(result.success, true)
  assert.equal(result.data.enabled, false)
  assert.equal(result.data.reward_amount, 1000)
  assert.deepEqual(state.calls, [
    {
      path: "/shops/SHOP%20%2F1/products/%C3%A1o%2Fthun/rewarded-tasks",
      cache: "no-store",
    },
  ])
})

test("starting a task only creates a server session, with no client-selected reward or completion", async () => {
  state.response = { task }
  const result = await actions.startRewardedTaskAction("SHOP-1", "ao-thun", {
    completed: true,
    reward_amount: 999999,
  })
  assert.equal(result.success, true)
  assert.deepEqual(result.data.discount_codes, [])
  assert.equal(state.calls[0].method, "POST")
  assert.equal(
    state.calls[0].path,
    "/shops/SHOP-1/products/ao-thun/rewarded-tasks"
  )
  assert.equal(state.calls[0].body, undefined)
  assert.equal(state.calls[0].token, undefined)
  assert.deepEqual(state.revalidated, [])
  assert.equal(actions.completeRewardedTaskAction, undefined)
})

test("pending status never returns a locally generated coupon or refreshes the wallet as rewarded", async () => {
  state.response = { task }
  const result = await actions.checkRewardedTaskAction(
    "SHOP 1",
    "áo/thun",
    "id/1"
  )
  assert.equal(result.success, true)
  assert.equal(result.data.status, "pending")
  assert.deepEqual(result.data.discount_codes, [])
  assert.equal(
    state.calls[0].path,
    "/shops/SHOP%201/products/%C3%A1o%2Fthun/rewarded-tasks/id%2F1"
  )
  assert.equal(state.calls[0].method, undefined)
  assert.equal(state.calls[0].body, undefined)
  assert.deepEqual(state.revalidated, [])
})

test("confirmed status returns every provider-confirmed coupon and refreshes the account wallet", async () => {
  const codes = [
    { id: "code-1", code: "DH-ONE", fixed_amount: 1000 },
    { id: "code-2", code: "DH-TWO", fixed_amount: 1000 },
  ]
  state.response = {
    task: { ...task, status: "rewarded", discount_codes: codes },
  }
  const result = await actions.checkRewardedTaskAction(
    "SHOP-1",
    "ao-thun",
    task.id
  )
  assert.deepEqual(result.data.discount_codes, codes)
  assert.deepEqual(state.revalidated, ["/discount-codes"])
})

test("expired sessions preserve server-returned rewards without creating replacement codes", async () => {
  const codes = [{ id: "code-1", code: "DH-ONE", fixed_amount: 1000 }]
  state.response = {
    task: { ...task, status: "expired", discount_codes: codes },
  }
  const result = await actions.checkRewardedTaskAction(
    "SHOP-1",
    "ao-thun",
    task.id
  )
  assert.equal(result.data.status, "expired")
  assert.deepEqual(result.data.discount_codes, codes)
  assert.equal(state.calls.length, 1)
})

test("authentication failures request sign-in without exposing raw backend errors", async () => {
  state.error = new ApiError(401, {
    message: "SECRET raw authorization failure",
  })
  for (const invoke of [
    () => actions.startRewardedTaskAction("SHOP-1", "ao-thun"),
    () => actions.checkRewardedTaskAction("SHOP-1", "ao-thun", task.id),
  ]) {
    const result = await invoke()
    assert.equal(result.success, false)
    assert.equal(result.requires_sign_in, true)
    assert.equal(result.reset_task, true)
    assert.match(result.message, /đăng nhập/)
    assert.doesNotMatch(result.message, /SECRET/)
    assert.equal(result.data, undefined)
  }
})

test("unavailable, forbidden and throttled sessions fail honestly without exposing provider errors", async () => {
  for (const status of [403, 404, 429, 503, 500]) {
    state.error = new ApiError(status, {
      message: "SECRET provider credentials",
    })
    for (const invoke of [
      () => actions.startRewardedTaskAction("SHOP-1", "ao-thun"),
      () => actions.checkRewardedTaskAction("SHOP-1", "ao-thun", task.id),
    ]) {
      const result = await invoke()
      assert.equal(result.success, false, String(status))
      assert.equal(result.data, undefined, String(status))
      assert.equal(
        result.reset_task,
        status === 403 || status === 404 ? true : undefined
      )
      assert.doesNotMatch(result.message, /SECRET/)
    }
  }
  assert.deepEqual(state.revalidated, [])
})

test("task launch and restore reject unsafe or unrelated offerwall links", async () => {
  for (const url of [
    "javascript:alert(1)",
    "http://api.adgem.com/v1/wall",
    "https://api.adgem.com.evil.test/v1/wall",
    "https://outside.example/v1/wall",
    "https://api.adgem.com/other",
    "https://api.adgem.com:8443/v1/wall",
    "https://username:password@api.adgem.com/v1/wall",
  ]) {
    state.response = { task: { ...task, offerwall_url: url } }
    for (const invoke of [
      () => actions.startRewardedTaskAction("SHOP-1", "ao-thun"),
      () => actions.checkRewardedTaskAction("SHOP-1", "ao-thun", task.id),
    ]) {
      const result = await invoke()
      assert.equal(result.success, false, url)
      assert.equal(result.data, undefined, url)
    }
  }
})

test("explicit HTTPS port 443 remains a valid provider URL", async () => {
  state.response = {
    task: {
      ...task,
      offerwall_url: "https://api.adgem.com:443/v1/wall?appid=123",
    },
  }
  const result = await actions.startRewardedTaskAction("SHOP-1", "ao-thun")
  assert.equal(result.success, true)
})
