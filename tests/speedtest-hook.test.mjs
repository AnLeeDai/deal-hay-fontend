import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(file, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_match, quote, specifier) => {
      assert.ok(imports[specifier], `Unmocked import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}

const engineUrl = transpile("../src/modules/diagnostics/lib/speedtest.ts")
const { initialSpeedtestState } = await import(engineUrl)
const reactUrl = moduleUrl(`
  export function useState(initial) { return globalThis.__speedtestHook.current.useState(initial) }
  export function useRef(initial) { return globalThis.__speedtestHook.current.useRef(initial) }
  export function useEffect(effect, dependencies) { return globalThis.__speedtestHook.current.useEffect(effect, dependencies) }
`)
const actionUrl = moduleUrl(`
  export function startSpeedtestAction() { return globalThis.__speedtestHook.enqueueSession() }
`)
const controlledEngineUrl = moduleUrl(`
  export { initialSpeedtestState } from ${JSON.stringify(engineUrl)}
  export function measureSpeedtest(session, signal, update) { return globalThis.__speedtestHook.beginMeasurement(session, signal, update) }
`)
const { useSpeedtest: renderSpeedtestHook } = await import(
  transpile("../src/modules/diagnostics/hooks/use-speedtest.ts", {
    react: reactUrl,
    "@/modules/diagnostics/speedtest-actions": actionUrl,
    "@/modules/diagnostics/lib/speedtest": controlledEngineUrl,
  })
)

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
function grant(name = "first") {
  return {
    success: true,
    data: {
      token: name,
      endpointUrl: "https://api.example.test/api/diagnostics/speedtest",
    },
  }
}
async function settle() {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve()
}

function mount(t) {
  const sessions = []
  const measurements = []
  const context = {
    current: null,
    enqueueSession() {
      const next = deferred()
      sessions.push(next)
      return next.promise
    },
    beginMeasurement(session, signal, update) {
      const next = { ...deferred(), session, signal, update }
      measurements.push(next)
      return next.promise
    },
  }
  globalThis.__speedtestHook = context
  const screen = {
    slots: [],
    cursor: 0,
    effects: [],
    stateWrites: [],
    unmounted: false,
    useState(initial) {
      const position = this.cursor++
      if (!(position in this.slots))
        this.slots[position] =
          typeof initial === "function" ? initial() : initial
      return [
        this.slots[position],
        (next) => {
          this.slots[position] =
            typeof next === "function" ? next(this.slots[position]) : next
          this.stateWrites.push(this.slots[position])
        },
      ]
    },
    useRef(initial) {
      const position = this.cursor++
      if (!(position in this.slots)) this.slots[position] = { current: initial }
      return this.slots[position]
    },
    useEffect(effect, dependencies) {
      const position = this.cursor++
      const previous = this.effects[position]
      if (
        !previous ||
        dependencies.some(
          (value, index) => !Object.is(value, previous.dependencies[index])
        )
      ) {
        previous?.cleanup?.()
        this.effects[position] = { dependencies, cleanup: effect() }
      }
    },
    render() {
      assert.equal(this.unmounted, false, "cannot render a disposed hook")
      context.current = this
      this.cursor = 0
      return renderSpeedtestHook()
    },
    unmount() {
      if (this.unmounted) return
      this.unmounted = true
      this.effects.forEach((effect) => effect?.cleanup?.())
    },
    get state() {
      return this.slots[0]
    },
    get result() {
      return this.render()
    },
    sessions,
    measurements,
  }
  screen.render()
  t.after(() => screen.unmount())
  return screen
}

test("double clicks issue one session and one measurement across rerenders", async (t) => {
  const screen = mount(t)
  const initialStart = screen.result.start
  initialStart()
  initialStart()
  screen.result.start()
  assert.equal(screen.sessions.length, 1)
  assert.equal(screen.result.running, true)
  assert.equal(screen.state.phase, "connecting")
  screen.sessions[0].resolve(grant())
  await settle()
  assert.equal(screen.measurements.length, 1)
  assert.equal(screen.measurements[0].signal.aborted, false)
  const completed = {
    ...initialSpeedtestState(),
    phase: "complete",
    pingMs: 12,
    downloadMbps: 45,
    uploadMbps: 20,
  }
  screen.measurements[0].update(completed)
  screen.measurements[0].resolve(completed)
  await settle()
  assert.equal(screen.result.running, false)
  assert.equal(screen.state.phase, "complete")
  screen.result.start()
  assert.equal(screen.sessions.length, 2)
})

test("cancel aborts the active measurement and keeps partial results while ignoring late updates", async (t) => {
  const screen = mount(t)
  screen.result.start()
  screen.sessions[0].resolve(grant())
  await settle()
  const run = screen.measurements[0]
  const partial = {
    ...initialSpeedtestState(),
    phase: "upload",
    progress: 72,
    pingMs: 18,
    jitterMs: 2,
    downloadMbps: 84,
    liveMbps: 15,
    transferredBytes: 2097152,
    samples: { download: [{ elapsedMs: 80, mbps: 84 }], upload: [] },
  }
  run.update(partial)
  screen.result.cancel()
  assert.equal(run.signal.aborted, true)
  assert.equal(screen.result.running, false)
  assert.equal(screen.state.phase, "cancelled")
  assert.equal(screen.state.downloadMbps, 84)
  assert.equal(screen.state.pingMs, 18)
  assert.equal(screen.state.liveMbps, null)
  assert.equal(screen.state.error, null)
  assert.deepEqual(screen.state.samples, partial.samples)
  const cancelled = screen.state
  run.update({ ...partial, phase: "complete", progress: 100 })
  run.reject(new DOMException("Stopped", "AbortError"))
  await settle()
  assert.equal(screen.state, cancelled)
})

test("a cancelled pending session cannot start a measurement or clear the restarted run", async (t) => {
  const screen = mount(t)
  screen.result.start()
  const oldController = screen.slots[1].current
  screen.result.cancel()
  screen.result.start()
  assert.equal(oldController.signal.aborted, true)
  assert.equal(screen.sessions.length, 2)
  screen.sessions[0].resolve(grant("cancelled"))
  await settle()
  assert.equal(screen.measurements.length, 0)
  screen.result.start()
  assert.equal(
    screen.sessions.length,
    2,
    "old finally must not unlock the new request"
  )
  screen.sessions[1].resolve(grant("current"))
  await settle()
  assert.equal(screen.measurements.length, 1)
  assert.equal(screen.measurements[0].session.token, "current")
  assert.equal(screen.measurements[0].signal.aborted, false)
})

test("callbacks and finally from an old measurement cannot overwrite or unlock a restarted measurement", async (t) => {
  const screen = mount(t)
  screen.result.start()
  screen.sessions[0].resolve(grant("old"))
  await settle()
  const old = screen.measurements[0]
  screen.result.cancel()
  screen.result.start()
  screen.sessions[1].resolve(grant("new"))
  await settle()
  const current = screen.measurements[1]
  current.update({
    ...initialSpeedtestState(),
    phase: "download",
    pingMs: 7,
    progress: 40,
  })
  const accepted = screen.state
  old.update({ ...initialSpeedtestState(), phase: "complete", pingMs: 999 })
  old.resolve({ ...initialSpeedtestState(), phase: "complete" })
  await settle()
  assert.equal(screen.state, accepted)
  screen.result.start()
  assert.equal(screen.sessions.length, 2)
  assert.equal(current.signal.aborted, false)
  current.update({
    ...initialSpeedtestState(),
    phase: "upload",
    pingMs: 7,
    downloadMbps: 110,
  })
  assert.equal(screen.state.phase, "upload")
  assert.equal(screen.state.downloadMbps, 110)
})

test("unmount aborts a pending grant and prevents late session results from starting work", async (t) => {
  const screen = mount(t)
  screen.result.start()
  const controller = screen.slots[1].current
  const writes = screen.stateWrites.length
  screen.unmount()
  assert.equal(controller.signal.aborted, true)
  assert.equal(screen.slots[1].current, null)
  screen.sessions[0].resolve(grant())
  await settle()
  assert.equal(screen.measurements.length, 0)
  assert.equal(screen.stateWrites.length, writes)
})

test("unmount aborts network work and ignores callbacks and failures after disposal", async (t) => {
  const screen = mount(t)
  screen.result.start()
  screen.sessions[0].resolve(grant())
  await settle()
  const run = screen.measurements[0]
  const writes = screen.stateWrites.length
  screen.unmount()
  assert.equal(run.signal.aborted, true)
  run.update({ ...initialSpeedtestState(), phase: "complete" })
  run.reject(new Error("Late network error"))
  await settle()
  assert.equal(screen.stateWrites.length, writes)
})

for (const kind of ["rejected grant", "transport failure"]) {
  test(`a ${kind} releases the run and permits retry`, async (t) => {
    const screen = mount(t)
    screen.result.start()
    if (kind === "rejected grant")
      screen.sessions[0].resolve({ success: false, message: "Please wait" })
    else screen.sessions[0].reject(new Error("Network unavailable"))
    await settle()
    assert.equal(screen.state.phase, "error")
    assert.match(
      screen.state.error,
      kind === "rejected grant" ? /Please wait/ : /Network unavailable/
    )
    assert.equal(screen.result.running, false)
    assert.equal(screen.measurements.length, 0)
    screen.result.start()
    assert.equal(screen.sessions.length, 2)
    assert.equal(screen.state.phase, "connecting")
    assert.equal(screen.state.error, null)
    screen.sessions[1].resolve(grant("retry"))
    await settle()
    assert.equal(screen.measurements.length, 1)
    assert.equal(screen.measurements[0].session.token, "retry")
  })
}

test("a failed measurement preserves the collected values until a new run begins", async (t) => {
  const screen = mount(t)
  screen.result.start()
  screen.sessions[0].resolve(grant())
  await settle()
  const run = screen.measurements[0]
  run.update({
    ...initialSpeedtestState(),
    phase: "upload",
    downloadMbps: 56,
    pingMs: 11,
  })
  run.reject(new Error("Upload unavailable"))
  await settle()
  assert.equal(screen.state.phase, "error")
  assert.equal(screen.state.downloadMbps, 56)
  assert.equal(screen.state.pingMs, 11)
  screen.result.start()
  assert.equal(screen.state.phase, "connecting")
  assert.equal(screen.state.downloadMbps, null)
  assert.equal(screen.state.pingMs, null)
})
