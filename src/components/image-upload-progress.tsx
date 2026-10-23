import type {
  ImageUploadProgress as UploadProgress,
  ImageUploadStage,
} from "@/lib/image-upload"

const stageLabels: Record<ImageUploadStage, string> = {
  queued: "Đang chờ",
  preparing: "Đang nén ảnh trên thiết bị",
  uploading: "Đang gửi ảnh",
  processing: "Đang xác nhận lưu ảnh",
  complete: "Ảnh đã sẵn sàng",
  error: "Không tải được ảnh",
}

export function ImageUploadProgress({
  progress,
}: {
  progress: UploadProgress | null
}) {
  if (!progress || progress.files.length === 0) return null
  // The final content save still needs its own server acknowledgement.
  const percent = Math.min(99, progress.percent)

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
      <div
        className="flex justify-between gap-3"
        role="status"
        aria-live="polite"
      >
        <span>
          {progress.completed === progress.files.length
            ? "Ảnh đã sẵn sàng. Đang lưu nội dung..."
            : `Chuẩn bị và tải ảnh (${progress.completed}/${progress.files.length})`}
        </span>
        <span className="shrink-0 tabular-nums">{percent}%</span>
      </div>
      <progress
        aria-label="Tiến độ chuẩn bị và tải ảnh"
        className="h-2 w-full accent-primary"
        max={100}
        value={percent}
      />
      <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-muted-foreground">
        {progress.files.map((file) => (
          <li key={file.index} className="flex justify-between gap-3">
            <span className="min-w-0 truncate" title={file.name}>
              {file.name}
            </span>
            <span className="shrink-0">
              {stageLabels[file.stage]} · {file.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
