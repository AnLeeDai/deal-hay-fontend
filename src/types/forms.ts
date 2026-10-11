import type { ValidationErrors } from "@/types/common"

export type ActionState = {
  success: boolean
  message: string
  errors?: ValidationErrors
}

export const INITIAL_ACTION_STATE: ActionState = {
  success: false,
  message: "",
}
