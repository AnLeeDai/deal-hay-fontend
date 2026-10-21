import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const scriptUrl = "https://securepubads.g.doubleclick.net/tag/js/gpt.js"
const configUrl = moduleUrl(
  `export const GOOGLE_PUBLISHER_TAG_SCRIPT_URL = ${JSON.stringify(scriptUrl)}`
)
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL("../src/lib/google-rewarded-ads.ts", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const source = outputText.replace(
  /from (["'])([^"']+)\1/g,
  (_match, quote, specifier) => {
    assert.equal(
      specifier,
      "@/config/advertising",
      `Unmocked import: ${specifier}`
    )
    return `from ${quote}${configUrl}${quote}`
  }
)
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document")
let moduleNumber = 0

test.afterEach(() => {
  for (const [name, descriptor] of [
    ["window", originalWindow],
    ["document", originalDocument],
  ]) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

async function setup(options = {}) {
  const calls = []
  const callbacks = []
  const listeners = new Map()
  const timers = new Map()
  const queued = []
  const scripts = new Map()
  let timerId = 0
  const service = {
    addEventListener(name, listener) {
      calls.push(["addListener", name, listener])
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(listener)
    },
    removeEventListener(name, listener) {
      calls.push(["removeListener", name, listener])
      listeners.get(name)?.delete(listener)
    },
  }
  const slot = {
    addService(value) {
      assert.equal(value, service)
      calls.push(["addService", value])
      return slot
    },
  }
  const tag = {
    cmd: {
      push(callback) {
        if (options.queued) queued.push(callback)
        else callback()
      },
    },
    enums: { OutOfPageFormat: { REWARDED: Symbol("rewarded") } },
    defineOutOfPageSlot(path, format) {
      calls.push(["define", path, format])
      if (options.defineThrows) throw new Error("GPT setup failed")
      return options.unsupported ? null : slot
    },
    pubads: () => service,
    enableServices() {
      calls.push(["enable"])
    },
    display(value) {
      assert.equal(value, slot)
      calls.push(["display", value])
      if (options.displayThrows) throw new Error("GPT display failed")
    },
    destroySlots(values) {
      calls.push(["destroySlots", values])
    },
  }
  function createScript() {
    const handlers = new Map()
    return {
      handlers,
      addEventListener(name, listener) {
        if (!handlers.has(name)) handlers.set(name, new Set())
        handlers.get(name).add(listener)
      },
      removeEventListener(name, listener) {
        handlers.get(name)?.delete(listener)
      },
      remove() {
        calls.push(["removeScript"])
        scripts.delete(this.id)
      },
      emit(name) {
        for (const listener of [...(handlers.get(name) ?? [])]) listener()
      },
    }
  }
  if (options.existingScript) {
    const script = createScript()
    script.id = "google-publisher-tag"
    scripts.set(script.id, script)
  }
  globalThis.window = {
    ...(options.bootstrap ? {} : { googletag: tag }),
    setTimeout(callback, delay) {
      timers.set(++timerId, { callback, delay })
      return timerId
    },
    clearTimeout(id) {
      timers.delete(id)
    },
  }
  globalThis.document = {
    getElementById: (id) => scripts.get(id) ?? null,
    createElement(name) {
      assert.equal(name, "script")
      calls.push(["createScript"])
      return createScript()
    },
    head: {
      appendChild(script) {
        calls.push(["appendScript", script])
        scripts.set(script.id, script)
      },
    },
  }
  const { requestGoogleRewardedAd } = await import(
    moduleUrl(`${source}\n// Isolated request state ${++moduleNumber}`)
  )
  const handlers = {
    onVisibleChange: (visible) => callbacks.push(["visible", visible]),
    onGranted: () => callbacks.push(["granted"]),
    onClosed: (granted) => callbacks.push(["closed", granted]),
    onError: (message) => callbacks.push(["error", message]),
  }
  const request = (path = "/1234567/free_shipping", overrides = {}) =>
    requestGoogleRewardedAd(path, { ...handlers, ...overrides })
  function emit(name, event = {}) {
    for (const listener of [...(listeners.get(name) ?? [])]) {
      listener({ slot, ...event })
    }
  }
  function ready(result = true, event = {}) {
    emit("rewardedSlotReady", {
      makeRewardedVisible() {
        calls.push(["show"])
        if (result instanceof Error) throw result
        return result
      },
      ...event,
    })
  }
  return {
    calls,
    callbacks,
    listeners,
    timers,
    scripts,
    slot,
    tag,
    request,
    emit,
    ready,
    flush() {
      if (Array.isArray(window.googletag?.cmd)) {
        queued.push(...window.googletag.cmd)
        window.googletag = tag
      }
      while (queued.length) queued.shift()()
    },
    expire() {
      for (const { callback } of [...timers.values()]) callback()
    },
  }
}

function assertCleanedUp(fixture) {
  assert.equal(fixture.timers.size, 0)
  assert.ok([...fixture.listeners.values()].every((set) => set.size === 0))
  const additions = fixture.calls.filter(([name]) => name === "addListener")
  for (const [, name, listener] of fixture.calls.filter(
    ([name]) => name === "removeListener"
  )) {
    assert.ok(
      additions.some(
        ([, addedName, added]) => addedName === name && added === listener
      ),
      `Cleanup must remove the registered ${name} listener`
    )
  }
  for (const script of fixture.scripts.values()) {
    assert.equal(script.handlers.get("error")?.size ?? 0, 0)
  }
}

test("invalid or missing GAM paths fail synchronously without requesting an ad", async () => {
  const f = await setup()
  for (const path of [
    "",
    "ca-pub-7303400269186048",
    "/network/reward",
    "/123/",
    "/123/ad?x=1",
    "/123/ad#x",
    "/123/ad name",
  ]) {
    let reported = false
    const controller = f.request(path, {
      onError: () => {
        reported = true
      },
    })
    assert.equal(reported, true)
    controller.destroy()
  }
  assert.deepEqual(f.calls, [])
  assert.equal(f.timers.size, 0)
})

test("listeners are installed before enabling and displaying the rewarded slot", async () => {
  const f = await setup()
  const controller = f.request()
  assert.deepEqual(
    f.calls
      .filter(([name]) => name !== "createScript" && name !== "appendScript")
      .map(([name]) => name),
    [
      "define",
      "addService",
      "addListener",
      "addListener",
      "addListener",
      "addListener",
      "enable",
      "display",
    ]
  )
  assert.deepEqual(f.calls[0], [
    "define",
    "/1234567/free_shipping",
    f.tag.enums.OutOfPageFormat.REWARDED,
  ])
  assert.deepEqual(f.callbacks, [])
  assert.equal(
    f.calls.some(([name]) => name === "show"),
    false
  )
  controller.destroy()
  assertCleanedUp(f)
})

test("the GPT script is loaded once with the official URL and anonymous CORS", async () => {
  const f = await setup()
  const first = f.request()
  const script = f.scripts.get("google-publisher-tag")
  assert.equal(script.src, scriptUrl)
  assert.equal(script.async, true)
  assert.equal(script.crossOrigin, "anonymous")
  first.destroy()
  const second = f.request()
  assert.equal(f.calls.filter(([name]) => name === "appendScript").length, 1)
  assert.equal(f.scripts.get("google-publisher-tag"), script)
  second.destroy()
  assertCleanedUp(f)
})

test("an existing GPT script is reused and its error listener is removed", async () => {
  const f = await setup({ existingScript: true })
  const controller = f.request()
  assert.equal(
    f.calls.some(([name]) => name === "createScript"),
    false
  )
  assert.equal(
    f.scripts.get("google-publisher-tag").handlers.get("error").size,
    1
  )
  controller.destroy()
  assertCleanedUp(f)
})

test("a second concurrent request fails synchronously and leaves the first active", async () => {
  const f = await setup()
  const first = f.request()
  const second = f.request()
  assert.equal(f.callbacks.length, 1)
  assert.equal(f.callbacks[0][0], "error")
  assert.equal(f.calls.filter(([name]) => name === "define").length, 1)
  second.destroy()
  f.ready()
  assert.deepEqual(f.callbacks.at(-1), ["visible", true])
  first.destroy()
  assertCleanedUp(f)
})

test("a ready event opens the opted-in ad once and disables the load timeout", async () => {
  const f = await setup()
  const controller = f.request()
  f.ready()
  f.ready()
  assert.equal(f.calls.filter(([name]) => name === "show").length, 1)
  assert.deepEqual(f.callbacks, [["visible", true]])
  assert.equal(f.timers.size, 0)
  controller.destroy()
  assert.deepEqual(f.callbacks.at(-1), ["visible", false])
  assertCleanedUp(f)
})

test("initial GPT loading queues initialization until the official library is ready", async () => {
  const f = await setup({ bootstrap: true })
  const controller = f.request()
  assert.equal(Array.isArray(window.googletag.cmd), true)
  assert.equal(window.googletag.cmd.length, 1)
  assert.equal(
    f.calls.some(([name]) => name === "define"),
    false
  )
  f.flush()
  assert.equal(f.calls.filter(([name]) => name === "define").length, 1)
  f.ready()
  assert.deepEqual(f.callbacks, [["visible", true]])
  controller.destroy()
  assertCleanedUp(f)
})

test("events for other ad slots cannot open, grant, close, or fail this attempt", async () => {
  const f = await setup()
  const controller = f.request()
  const otherSlot = {}
  f.ready(true, { slot: otherSlot })
  f.emit("rewardedSlotGranted", { slot: otherSlot })
  f.emit("rewardedSlotClosed", { slot: otherSlot })
  f.emit("slotRenderEnded", { slot: otherSlot, isEmpty: true })
  assert.deepEqual(f.callbacks, [])
  assert.equal(
    f.calls.some(([name]) => name === "show" || name === "destroySlots"),
    false
  )
  controller.destroy()
  assertCleanedUp(f)
})

test("only a grant after opening awards the reward and duplicate grants are ignored", async () => {
  const f = await setup()
  const controller = f.request()
  f.emit("rewardedSlotGranted")
  f.emit("rewardedSlotVideoCompleted")
  f.emit("slotRenderEnded", { isEmpty: false })
  assert.deepEqual(f.callbacks, [])
  f.ready()
  f.emit("rewardedSlotVideoCompleted")
  assert.deepEqual(f.callbacks, [["visible", true]])
  f.emit("rewardedSlotGranted")
  f.emit("rewardedSlotGranted")
  f.emit("rewardedSlotClosed")
  assert.deepEqual(f.callbacks, [
    ["visible", true],
    ["granted"],
    ["visible", false],
    ["closed", true],
  ])
  controller.destroy()
  assertCleanedUp(f)
})

test("closing without a grant leaves the reward unearned and destroys only this slot", async () => {
  const f = await setup()
  const controller = f.request()
  f.ready()
  f.emit("rewardedSlotClosed")
  f.emit("rewardedSlotClosed")
  assert.deepEqual(f.callbacks, [
    ["visible", true],
    ["visible", false],
    ["closed", false],
  ])
  assert.deepEqual(
    f.calls.filter(([name]) => name === "destroySlots"),
    [["destroySlots", [f.slot]]]
  )
  controller.destroy()
  controller.destroy()
  assert.equal(f.calls.filter(([name]) => name === "destroySlots").length, 1)
  assertCleanedUp(f)
})

test("a grant delivered after close is retained until the caller disposes the attempt", async () => {
  const f = await setup()
  const controller = f.request()
  f.ready()
  f.emit("rewardedSlotClosed")
  f.emit("rewardedSlotGranted")
  f.emit("rewardedSlotGranted")
  assert.deepEqual(f.callbacks.at(-1), ["granted"])
  assert.equal(f.callbacks.filter(([name]) => name === "granted").length, 1)
  controller.destroy()
  f.emit("rewardedSlotGranted")
  assert.equal(f.callbacks.filter(([name]) => name === "granted").length, 1)
  assertCleanedUp(f)
})

test("unsupported pages fail without enabling, displaying, or fabricating a reward", async () => {
  const f = await setup({ unsupported: true })
  f.request().destroy()
  assert.equal(f.callbacks.length, 1)
  assert.equal(f.callbacks[0][0], "error")
  assert.deepEqual(
    f.calls.map(([name]) => name),
    ["define"]
  )
  assertCleanedUp(f)
})

test("no-fill ends the request without awarding a reward", async () => {
  const f = await setup()
  f.request()
  f.emit("slotRenderEnded", { isEmpty: true })
  f.ready()
  f.emit("rewardedSlotGranted")
  assert.equal(f.callbacks.length, 1)
  assert.equal(f.callbacks[0][0], "error")
  assert.equal(
    f.calls.some(([name]) => name === "show"),
    false
  )
  assertCleanedUp(f)
})

test("a failed or throwing visibility operation cleans up without awarding a reward", async () => {
  for (const failure of [false, new Error("Blocked")]) {
    const f = await setup()
    f.request()
    f.ready(failure)
    f.emit("rewardedSlotGranted")
    assert.deepEqual(
      f.callbacks.map(([name]) => name),
      ["visible", "visible", "error"]
    )
    assert.deepEqual(f.callbacks.slice(0, 2), [
      ["visible", true],
      ["visible", false],
    ])
    assertCleanedUp(f)
  }
})

test("load timeout clears a queued request and late initialization cannot create a slot", async () => {
  const f = await setup({ bootstrap: true })
  f.request()
  assert.equal([...f.timers.values()][0].delay, 20_000)
  f.expire()
  f.flush()
  assert.equal(f.callbacks.length, 1)
  assert.equal(f.callbacks[0][0], "error")
  assert.equal(
    f.calls.some(([name]) => name === "define"),
    false
  )
  assertCleanedUp(f)
})

test("canceling before GPT initialization prevents stale slots and callbacks", async () => {
  const f = await setup({ bootstrap: true })
  const controller = f.request()
  controller.destroy()
  f.flush()
  f.expire()
  assert.deepEqual(f.callbacks, [])
  assert.equal(
    f.calls.some(([name]) => name === "define"),
    false
  )
  assertCleanedUp(f)
})

test("timing out after requesting a slot destroys it and never grants a reward", async () => {
  const f = await setup()
  f.request()
  f.expire()
  f.ready()
  f.emit("rewardedSlotGranted")
  assert.deepEqual(
    f.callbacks.map(([name]) => name),
    ["error"]
  )
  assert.deepEqual(
    f.calls.filter(([name]) => name === "destroySlots"),
    [["destroySlots", [f.slot]]]
  )
  assertCleanedUp(f)
})

test("script errors remove the failed script and permit a fresh retry", async () => {
  const f = await setup({ bootstrap: true })
  f.request()
  const failedScript = f.scripts.get("google-publisher-tag")
  failedScript.emit("error")
  assert.equal(f.scripts.size, 0)
  assert.equal(failedScript.handlers.get("error").size, 0)
  assert.deepEqual(
    f.callbacks.map(([name]) => name),
    ["error"]
  )
  const retry = f.request()
  assert.notEqual(f.scripts.get("google-publisher-tag"), failedScript)
  f.flush()
  assert.equal(f.calls.filter(([name]) => name === "define").length, 1)
  retry.destroy()
  assertCleanedUp(f)
})

test("setup exceptions clean up any allocated slot and release the active request", async () => {
  for (const options of [{ defineThrows: true }, { displayThrows: true }]) {
    const f = await setup(options)
    f.request()
    assert.deepEqual(
      f.callbacks.map(([name]) => name),
      ["error"]
    )
    assertCleanedUp(f)
    f.request()
    assert.equal(f.calls.filter(([name]) => name === "define").length, 2)
    assertCleanedUp(f)
  }
})

test("destroying an open ad removes handlers, clears visibility, and releases the singleton", async () => {
  const f = await setup()
  const first = f.request()
  f.ready()
  first.destroy()
  f.emit("rewardedSlotGranted")
  f.emit("rewardedSlotClosed")
  assert.deepEqual(f.callbacks, [
    ["visible", true],
    ["visible", false],
  ])
  assertCleanedUp(f)
  const second = f.request()
  assert.equal(f.calls.filter(([name]) => name === "define").length, 2)
  second.destroy()
  assertCleanedUp(f)
})
