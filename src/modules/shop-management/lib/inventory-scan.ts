export function normalizeInventoryScanCode(value: unknown): string {
  if (typeof value !== "string") return ""
  const code = value.replace(/^[\s\x00-\x20\x7f]+|[\s\x00-\x20\x7f]+$/g, "")
  if (/[\x00-\x1f\x7f]/.test(code)) return ""
  return code.toUpperCase()
}

type ScanCrypto = Pick<Crypto, "getRandomValues"> &
  Partial<Pick<Crypto, "randomUUID">>

export function createInventoryScanId(
  source: ScanCrypto = globalThis.crypto
): string {
  if (typeof source?.randomUUID === "function") return source.randomUUID()
  if (typeof source?.getRandomValues !== "function")
    throw new Error(
      "Trình duyệt không hỗ trợ tạo mã lượt quét. Vui lòng cập nhật trình duyệt."
    )
  const bytes = source.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export type InventoryScanJob = { sessionId: string; code: string; id: string }
export type InventoryScanQueueState = {
  queued: number
  running: boolean
  error: string | null
  nextCode: string | null
}
type ScanResult<T> =
  { success: true; data: T } | { success: false; message: string }

export class InventoryScanQueue {
  private jobs: InventoryScanJob[] = []
  private running = false
  private error: string | null = null

  snapshot(): InventoryScanQueueState {
    return {
      queued: this.jobs.length,
      running: this.running,
      error: this.error,
      nextCode: this.jobs[0]?.code ?? null,
    }
  }

  enqueue(
    sessionId: string,
    rawCode: string,
    createId = createInventoryScanId
  ): InventoryScanJob {
    const code = normalizeInventoryScanCode(rawCode)
    if (!code || code.length > 255)
      throw new Error("Quét hoặc nhập một mã SKU hợp lệ, tối đa 255 ký tự.")
    if (this.jobs.length && this.jobs[0].sessionId !== sessionId)
      throw new Error(
        "Hoàn tất hàng đợi của phiên hiện tại trước khi mở phiên khác."
      )
    const existing = this.jobs.find(
      (job) => job.sessionId === sessionId && job.code === code
    )
    if (existing) return existing
    const job = { sessionId, code, id: createId() }
    this.jobs.push(job)
    return job
  }

  skipFailed(): InventoryScanJob | undefined {
    if (this.running || !this.error) return
    this.error = null
    return this.jobs.shift()
  }

  async drain<T>(
    send: (job: InventoryScanJob) => Promise<ScanResult<T>>,
    received: (job: InventoryScanJob, data: T) => void,
    changed: (state: InventoryScanQueueState) => void
  ): Promise<void> {
    if (this.running) return
    this.running = true
    this.error = null
    changed(this.snapshot())
    try {
      while (this.jobs.length) {
        const job = this.jobs[0]
        let result: ScanResult<T>
        try {
          result = await send(job)
        } catch {
          this.error =
            "Kết nối bị gián đoạn. Các mã chưa được xác nhận vẫn nằm trong hàng đợi."
          break
        }
        if (!result.success) {
          this.error = result.message
          break
        }
        this.jobs.shift()
        received(job, result.data)
        changed(this.snapshot())
      }
    } finally {
      this.running = false
      changed(this.snapshot())
    }
  }
}
