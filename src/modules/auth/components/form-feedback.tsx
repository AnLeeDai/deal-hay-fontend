import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { ActionState } from "@/types/forms"

export function FormFeedback({ state }: { state: ActionState }) {
  if (!state.message) return null

  return (
    <Alert variant={state.success ? "default" : "destructive"}>
      <AlertTitle>{state.success ? "Thành công" : "Chưa thể xử lý"}</AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  )
}
