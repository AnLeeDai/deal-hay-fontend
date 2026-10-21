import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`

function transpile(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, specifier) => {
      assert.ok(imports[specifier], `Unexpected import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}

// Exercise component state transitions without loading Google or making API
// requests. Each mocked transition remains pending until its action settles.
const hooksUrl = moduleUrl(`
  let slots, cursor, effects, pending
  export let dirty = false
  export function reset() { slots = []; pending = new Set(); dirty = false }
  export function beginRender() { cursor = 0; effects = []; dirty = false }
  export function flushEffects() { for (const effect of effects) effect() }
  export function cleanupEffects() { for (const slot of slots) slot?.cleanup?.() }
  export async function settle() {
    await Promise.all([...pending])
    await Promise.resolve()
  }
  export function useState(initial) {
    const index = cursor++
    if (!(index in slots)) {
      const slot = { value: typeof initial === "function" ? initial() : initial }
      slot.set = next => {
        const value = typeof next === "function" ? next(slot.value) : next
        if (!Object.is(value, slot.value)) { slot.value = value; dirty = true }
      }
      slots[index] = slot
    }
    return [slots[index].value, slots[index].set]
  }
  export function useRef(initial) {
    const index = cursor++
    if (!(index in slots)) slots[index] = { current: initial }
    return slots[index]
  }
  export function useEffect(effect, dependencies) {
    const index = cursor++
    const previous = slots[index]
    if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
      effects.push(() => {
        previous?.cleanup?.()
        slots[index] = { dependencies, cleanup: effect() }
      })
    }
  }
  export function useCallback(callback, dependencies) {
    const index = cursor++
    const previous = slots[index]
    if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
      slots[index] = { dependencies, callback }
    }
    return slots[index].callback
  }
  export function useTransition() {
    const index = cursor++
    if (!(index in slots)) {
      const slot = { pending: false }
      slot.start = action => {
        slot.pending = true
        dirty = true
        let task
        task = Promise.resolve(action()).finally(() => {
          slot.pending = false
          dirty = true
          pending.delete(task)
        })
        pending.add(task)
      }
      slots[index] = slot
    }
    return [slots[index].pending, slots[index].start]
  }
`)
const hooks = await import(hooksUrl)
const consentUrl = transpile("../src/lib/advertising-consent.ts")
const consent = await import(consentUrl)
const actionsUrl = moduleUrl(`
  export let state
  export function configure(next) { state = next }
  export function loadShippingOfferAction(...args) {
    state.loads.push(args)
    return state.load()
  }
  export function startShippingRewardViewAction(...args) {
    state.starts.push(args)
    return state.start()
  }
  export function redeemShippingRewardAction(...args) {
    state.redeems.push(args)
    return state.redeem()
  }
`)
const actions = await import(actionsUrl)
const adsUrl = moduleUrl(`
  export let requests
  export function reset() { requests = [] }
  export function requestGoogleRewardedAd(path, callbacks) {
    const request = { path, callbacks, destroyed: false }
    requests.push(request)
    return { destroy() { request.destroyed = true } }
  }
`)
const ads = await import(adsUrl)
const { ShippingRewardOffer } = await import(
  transpile("../src/modules/public/components/shipping-reward-offer.tsx", {
    react: hooksUrl,
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "next/link": moduleUrl('export default "a"'),
    "lucide-react": moduleUrl(
      'export const PlayIcon = "play", RefreshCwIcon = "refresh", TicketPercentIcon = "ticket"'
    ),
    "@/components/ui/button": moduleUrl('export const Button = "button"'),
    "@/lib/auth-redirect": moduleUrl(
      'export const getAuthPageHref = (path, next) => path + "?next=" + encodeURIComponent(next)'
    ),
    "@/lib/advertising-consent": consentUrl,
    "@/lib/google-rewarded-ads": adsUrl,
    "@/modules/public/components/shipping-advertisement": moduleUrl(
      'export const ShippingAdvertisement = "shipping-advertisement"'
    ),
    "@/modules/public/shipping-reward-actions": actionsUrl,
  })
)

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== "object") return []
  return [node, ...elements(node.props?.children)]
}

function textContent(node) {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textContent).join("")
  return node?.props ? textContent(node.props.children) : ""
}

const success = (data) => ({ success: true, message: "", data })
const offer = {
  available: true,
  unavailable_reason: null,
  rewarded_ad_unit_path: "/1234567/deal_hay_shipping_rewarded",
}
const view = () => ({
  id: "view-1",
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  rewarded_ad_unit_path: "/7654321/current_shipping_rewarded",
})
const code = () => ({
  id: "code-1",
  code: "SHIP-ABC",
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  used_at: null,
  is_available: true,
  product_id: "product-1",
  discount_percent: 100,
})

function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function component(options = {}) {
  hooks.reset()
  ads.reset()
  const state = {
    loads: [],
    starts: [],
    redeems: [],
    load: async () => success(offer),
    start: async () => success(view()),
    redeem: async () => success(code()),
    ...options.actions,
  }
  actions.configure(state)
  const document = {
    cookie: options.accepted
      ? consent.serializeAdvertisingConsent("accepted", true)
      : "",
  }
  const received = []
  const redeemingChanges = []
  const visibilityChanges = []
  const props = {
    shopCode: "shop-1",
    productSlug: "product-one",
    code: options.code ?? null,
    disabled: options.disabled ?? false,
    onCodeReceived: (value) => received.push(value),
    onRedeemingChange: (value) => redeemingChanges.push(value),
    onAdVisibleChange: (value) => visibilityChanges.push(value),
  }
  let tree
  let mounted = true

  function inBrowser(callback) {
    // Keep the document available while asynchronous action continuations run.
    // Node isolates this test file in its own process; cases run sequentially.
    globalThis.document = document
    return callback()
  }

  function render() {
    if (!mounted) return
    inBrowser(() => {
      let attempts = 0
      do {
        assert.ok(attempts++ < 20, "component render settles")
        hooks.beginRender()
        tree = ShippingRewardOffer(props)
        hooks.flushEffects()
      } while (hooks.dirty)
    })
  }

  render()
  return {
    state,
    document,
    received,
    redeemingChanges,
    visibilityChanges,
    get tree() {
      return tree
    },
    get text() {
      return textContent(tree)
    },
    get buttons() {
      return elements(tree).filter((element) => element.type === "button")
    },
    get request() {
      return ads.requests.at(-1)
    },
    async settle() {
      await hooks.settle()
      render()
    },
    chooseConsent(accepted) {
      document.cookie = consent.serializeAdvertisingConsent(
        accepted ? "accepted" : "declined",
        true
      )
      const child = elements(tree).find(
        (element) => element.type === "shipping-advertisement"
      )
      assert.ok(child, "consent panel is available")
      inBrowser(() => child.props.onConsentChange(accepted))
      render()
    },
    click(label) {
      const button = this.buttons.find((element) =>
        textContent(element).includes(label)
      )
      assert.ok(button, `Button is available: ${label}`)
      assert.ok(!button.props.disabled, `Button is enabled: ${label}`)
      inBrowser(() => button.props.onClick())
      render()
    },
    async watch() {
      this.click("Xem quảng cáo để nhận mã miễn ship")
      await Promise.resolve()
      render()
    },
    emit(callback, ...args) {
      assert.ok(this.request, "a rewarded ad request exists")
      inBrowser(() => this.request.callbacks[callback](...args))
      render()
    },
    unmount() {
      inBrowser(() => hooks.cleanupEffects())
      mounted = false
    },
  }
}

test("mount and cookie consent do not start a rewarded session or redeem a code", async () => {
  const panel = component()
  await panel.settle()
  assert.deepEqual(panel.state.loads, [["shop-1", "product-one"]])
  assert.equal(panel.state.starts.length, 0)
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(ads.requests.length, 0)

  panel.chooseConsent(true)
  await panel.settle()
  assert.equal(panel.state.starts.length, 0)
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(ads.requests.length, 0)
})

test("explicit watch creates one session and uses its current rewarded unit", async () => {
  const currentView = view()
  const panel = component({
    actions: { start: async () => success(currentView) },
  })
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  assert.deepEqual(panel.state.starts, [["shop-1", "product-one"]])
  assert.equal(ads.requests.length, 1)
  assert.equal(panel.request.path, currentView.rewarded_ad_unit_path)
  assert.notEqual(panel.request.path, offer.rewarded_ad_unit_path)
  assert.equal(panel.state.redeems.length, 0)
  assert.ok(panel.buttons[0].props.disabled)
})

test("only the rewarded grant callback redeems the earned session", async () => {
  const earned = view()
  const panel = component({ actions: { start: async () => success(earned) } })
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  panel.emit("onVisibleChange", true)
  assert.equal(panel.state.redeems.length, 0)
  assert.deepEqual(panel.visibilityChanges.at(-1), true)

  panel.emit("onGranted")
  await panel.settle()
  assert.deepEqual(panel.state.redeems, [["shop-1", "product-one", earned.id]])
  assert.equal(panel.received.length, 1)
  assert.equal(panel.received[0].code, "SHIP-ABC")
})

test("closing without a grant awards nothing and permits another voluntary attempt", async () => {
  const panel = component()
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  const first = panel.request
  panel.emit("onClosed", false)
  await panel.settle()
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(panel.received.length, 0)
  assert.match(panel.text, /đóng quảng cáo khi chưa nhận/)
  await panel.watch()
  assert.equal(panel.state.starts.length, 2)
  assert.equal(ads.requests.length, 2)
  assert.equal(first.destroyed, true)
})

test("no-fill or an unavailable ad cannot award a shipping code", async () => {
  const panel = component()
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  panel.emit("onError", "Hiện chưa có quảng cáo phù hợp.")
  await panel.settle()
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(panel.received.length, 0)
  assert.match(panel.text, /Hiện chưa có quảng cáo phù hợp/)
  assert.ok(!panel.buttons[0].props.disabled)
})

test("cancelling a pending session releases checkout and ignores its late response", async () => {
  const session = deferred()
  const panel = component({ actions: { start: () => session.promise } })
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  assert.equal(panel.state.starts.length, 1)
  assert.equal(panel.redeemingChanges.at(-1), true)
  panel.click("Hủy xem quảng cáo")
  assert.equal(panel.redeemingChanges.at(-1), false)
  assert.equal(panel.visibilityChanges.at(-1), false)
  assert.ok(!panel.buttons[0].props.disabled)

  session.resolve(success(view()))
  await Promise.resolve()
  await panel.settle()
  assert.equal(ads.requests.length, 0)
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(panel.received.length, 0)
})

test("cancelling an active ad destroys it, releases checkout, and ignores a late grant", async () => {
  const panel = component()
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  const request = panel.request
  assert.equal(request.destroyed, false)
  assert.equal(panel.redeemingChanges.at(-1), true)

  panel.click("Hủy xem quảng cáo")
  assert.equal(request.destroyed, true)
  assert.equal(panel.redeemingChanges.at(-1), false)
  assert.equal(panel.visibilityChanges.at(-1), false)
  assert.ok(!panel.buttons[0].props.disabled)
  request.callbacks.onGranted()
  request.callbacks.onClosed(true)
  await panel.settle()
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(panel.received.length, 0)
  assert.equal(panel.redeemingChanges.at(-1), false)
})

test("failed redemption retries the same earned session without another advertisement", async () => {
  const earned = view()
  let attempts = 0
  const panel = component({
    actions: {
      start: async () => success(earned),
      redeem: async () =>
        ++attempts === 1
          ? { success: false, message: "Lỗi kết nối. Vui lòng thử lại." }
          : success(code()),
    },
  })
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  panel.emit("onGranted")
  panel.emit("onClosed", true)
  await panel.settle()
  assert.equal(panel.received.length, 0)
  assert.match(panel.text, /Lỗi kết nối/)
  panel.click("Nhận lại mã miễn ship")
  await panel.settle()
  assert.deepEqual(panel.state.redeems, [
    ["shop-1", "product-one", earned.id],
    ["shop-1", "product-one", earned.id],
  ])
  assert.equal(panel.state.starts.length, 1)
  assert.equal(ads.requests.length, 1)
  assert.equal(panel.received.length, 1)
})

test("a thrown redemption action preserves the earned session for retry", async () => {
  let attempts = 0
  const panel = component({
    actions: {
      redeem: async () => {
        if (++attempts === 1) throw new Error("temporary connection failure")
        return success(code())
      },
    },
  })
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  panel.emit("onGranted")
  panel.emit("onClosed", true)
  await panel.settle()
  assert.match(panel.text, /Chưa nhận được mã vận chuyển/)
  panel.click("Nhận lại mã miễn ship")
  await panel.settle()
  assert.equal(panel.state.starts.length, 1)
  assert.equal(ads.requests.length, 1)
  assert.equal(panel.state.redeems.length, 2)
  assert.equal(panel.received.length, 1)
})

test("unmount ignores a late session response before any Google request", async () => {
  const session = deferred()
  const panel = component({ actions: { start: () => session.promise } })
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  assert.equal(panel.state.starts.length, 1)
  assert.equal(ads.requests.length, 0)
  panel.unmount()
  session.resolve(success(view()))
  await Promise.resolve()
  await panel.settle()
  assert.equal(ads.requests.length, 0)
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(panel.redeemingChanges.at(-1), false)
  assert.equal(panel.visibilityChanges.at(-1), false)
})

test("unmount destroys the ad and ignores callbacks from its former session", async () => {
  const panel = component()
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  const request = panel.request
  panel.unmount()
  assert.equal(request.destroyed, true)
  request.callbacks.onGranted()
  request.callbacks.onClosed(true)
  await panel.settle()
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(panel.received.length, 0)
})

test("revoking cookies while the session starts prevents the Google request", async () => {
  const session = deferred()
  const panel = component({ actions: { start: () => session.promise } })
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  panel.chooseConsent(false)
  session.resolve(success(view()))
  await Promise.resolve()
  await panel.settle()
  assert.equal(ads.requests.length, 0)
  assert.equal(panel.state.redeems.length, 0)
})

test("withdrawing consent destroys an active ad and invalidates its late grant", async () => {
  const panel = component()
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  const request = panel.request
  panel.chooseConsent(false)
  assert.equal(request.destroyed, true)
  request.callbacks.onGranted()
  await panel.settle()
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(panel.received.length, 0)
  assert.equal(panel.visibilityChanges.at(-1), false)
})

test("an available code removes the watch action and never requests an advertisement", async () => {
  const panel = component({ accepted: true, code: code() })
  await panel.settle()
  assert.match(panel.text, /Đã lưu mã SHIP-ABC/)
  assert.equal(panel.buttons.length, 0)
  assert.equal(panel.state.starts.length, 0)
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(ads.requests.length, 0)
})

test("an expired session response cannot request Google or redeem a code", async () => {
  const expired = {
    id: "expired-view",
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  }
  const panel = component({ actions: { start: async () => success(expired) } })
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  await panel.settle()
  assert.equal(ads.requests.length, 0)
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(panel.received.length, 0)
  assert.match(panel.text, /Phiên quảng cáo đã hết hạn/)
})

test("a session that expires while the ad is shown cannot be redeemed", async () => {
  const earned = view()
  const panel = component({ actions: { start: async () => success(earned) } })
  await panel.settle()
  panel.chooseConsent(true)
  await panel.watch()
  const originalNow = Date.now
  try {
    Date.now = () => Date.parse(earned.expires_at) + 1
    panel.emit("onGranted")
    panel.emit("onClosed", true)
    await panel.settle()
  } finally {
    Date.now = originalNow
  }
  assert.equal(panel.state.redeems.length, 0)
  assert.equal(panel.received.length, 0)
  assert.match(panel.text, /Phiên quảng cáo đã hết hạn/)
})

test("an expired or used code returned from redemption is never applied", async () => {
  for (const invalid of [
    { ...code(), expires_at: new Date(Date.now() - 60_000).toISOString() },
    { ...code(), used_at: new Date().toISOString(), is_available: false },
  ]) {
    const panel = component({
      actions: { redeem: async () => success(invalid) },
    })
    await panel.settle()
    panel.chooseConsent(true)
    await panel.watch()
    panel.emit("onGranted")
    panel.emit("onClosed", true)
    await panel.settle()
    assert.equal(panel.state.redeems.length, 1)
    assert.equal(panel.received.length, 0)
    assert.match(panel.text, /Mã của phiên này đã hết hạn hoặc đã được dùng/)
    panel.unmount()
  }
})

test("a configured unavailable offer cannot start a rewarded session", async () => {
  const panel = component({
    actions: {
      load: async () =>
        success({
          available: false,
          unavailable_reason: "rewarded_ads_not_configured",
          rewarded_ad_unit_path: null,
        }),
    },
  })
  await panel.settle()
  assert.equal(panel.buttons.length, 0)
  assert.match(panel.text, /hiện chưa khả dụng/)
  assert.equal(panel.state.starts.length, 0)
  assert.equal(ads.requests.length, 0)
})
