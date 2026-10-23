import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
globalThis.__notificationVisibility = { cleanups: [] }
Object.defineProperties(globalThis, {
  document: { value: null, writable: true, configurable: true },
  window: { value: null, writable: true, configurable: true },
  IntersectionObserver: { value: null, writable: true, configurable: true },
})
const react = moduleUrl(
  `export function useRef(current) { return { current } } export function useEffect(effect) { const cleanup = effect(); if (cleanup) globalThis.__notificationVisibility.cleanups.push(cleanup) }`
)
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      "../src/modules/notifications/hooks/use-visible-notifications.ts",
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
const { useVisibleNotifications: observeNotifications } = await import(
  moduleUrl(outputText.replace('from "react"', `from "${react}"`))
)

function mount(t, onRead) {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const document = new EventTarget()
  document.visibilityState = "visible"
  document.focused = true
  document.hasFocus = () => document.focused
  const window = new EventTarget()
  t.mock.property(globalThis, "document", document)
  t.mock.property(globalThis, "window", window)
  let onIntersection
  t.mock.property(
    globalThis,
    "IntersectionObserver",
    class {
      constructor(callback) {
        onIntersection = callback
      }
      observe() {}
      disconnect() {}
    }
  )
  const elements = ["visible", "below-fold"].map((id) => ({
    dataset: { notificationId: id },
  }))
  const container = { current: { querySelectorAll: () => elements } }
  globalThis.__notificationVisibility.cleanups = []
  observeNotifications(container, ["visible", "below-fold"], onRead)
  t.after(() => {
    globalThis.__notificationVisibility.cleanups.forEach((cleanup) => cleanup())
  })
  return {
    document,
    window,
    enter(id, ratio = 1) {
      onIntersection([
        {
          target: elements.find(
            (element) => element.dataset.notificationId === id
          ),
          isIntersecting: ratio > 0,
          intersectionRatio: ratio,
        },
      ])
    },
  }
}

test("only notifications actually visible for a moment are marked read in a batch", async (t) => {
  const read = []
  const screen = mount(t, async (ids) => read.push(ids))
  screen.enter("visible")
  t.mock.timers.tick(899)
  assert.equal(read.length, 0)
  t.mock.timers.tick(1)
  t.mock.timers.tick(100)
  assert.deepEqual(read, [["visible"]])
})

test("scrolling past a notification cancels its pending read", async (t) => {
  const read = []
  const screen = mount(t, async (ids) => read.push(ids))
  screen.enter("visible")
  t.mock.timers.tick(500)
  screen.enter("visible", 0)
  t.mock.timers.tick(2000)
  assert.equal(read.length, 0)
})

test("hidden or unfocused windows retain unread notifications until the user returns", async (t) => {
  const read = []
  const screen = mount(t, async (ids) => read.push(ids))
  screen.document.focused = false
  screen.enter("visible")
  t.mock.timers.tick(2000)
  assert.equal(read.length, 0)
  screen.document.focused = true
  screen.window.dispatchEvent(new Event("focus"))
  t.mock.timers.tick(500)
  screen.document.visibilityState = "hidden"
  screen.document.dispatchEvent(new Event("visibilitychange"))
  t.mock.timers.tick(2000)
  assert.equal(read.length, 0)
  screen.document.visibilityState = "visible"
  screen.document.dispatchEvent(new Event("visibilitychange"))
  t.mock.timers.tick(900)
  t.mock.timers.tick(100)
  assert.deepEqual(read, [["visible"]])
})
