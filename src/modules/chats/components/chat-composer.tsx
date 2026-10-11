"use client"

import { useRef, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon, PaperclipIcon, SendIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { SelectedFilePreview } from "@/components/selected-file-preview"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  appendOptionalFile,
  appendOptionalString,
  applyServerErrors,
  runUploadAction,
} from "@/lib/form-utils"
import { CHAT_ATTACHMENT_ACCEPT } from "@/lib/validation"
import { prepareImageUploads } from "@/lib/image-upload"
import { sendMessageAction } from "@/modules/chats/actions"
import {
  sendMessageSchema,
  type SendMessageValues,
} from "@/modules/chats/schemas/chats"
import type { ChatMessage } from "@/types/chat"

export function ChatComposer({
  conversationSlug,
  socketId,
  onSent,
}: {
  conversationSlug: string
  socketId?: string
  onSent: (message: ChatMessage) => void
}) {
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const form = useForm<SendMessageValues>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { body: "", attachment: undefined },
  })
  const attachment = useWatch({ control: form.control, name: "attachment" })

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData()
    appendOptionalString(formData, "body", values.body)
    appendOptionalFile(formData, "attachment", values.attachment)
    if (socketId) formData.set("socket_id", socketId)

    startTransition(async () => {
      const state = await runUploadAction(async () =>
        sendMessageAction(
          conversationSlug,
          await prepareImageUploads(formData, "chat")
        )
      )
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success && state.data) {
        onSent(state.data)
        form.reset({ body: "", attachment: undefined })
        return
      }

      if (!hasFieldErrors && state.message) toast.error(state.message)
    })
  })

  return (
    <Form {...form}>
      <form
        className="shrink-0 border-t bg-card p-3 sm:p-4"
        noValidate
        onSubmit={onSubmit}
      >
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Nội dung tin nhắn</FormLabel>
              <FormControl>
                <InputGroup className="h-auto">
                  <InputGroupTextarea
                    aria-label="Nội dung tin nhắn"
                    className="max-h-36 min-h-12"
                    disabled={isPending}
                    placeholder="Nhập tin nhắn..."
                    rows={1}
                    {...field}
                    value={field.value ?? ""}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault()
                        event.currentTarget.form?.requestSubmit()
                      }
                    }}
                  />
                  <InputGroupAddon
                    align="block-end"
                    className="justify-between border-t"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <InputGroupButton
                        aria-label="Đính kèm tệp"
                        disabled={isPending}
                        size="icon-sm"
                        onClick={() => {
                          if (!fileInputRef.current) return
                          fileInputRef.current.value = ""
                          fileInputRef.current.click()
                        }}
                      >
                        <PaperclipIcon />
                      </InputGroupButton>
                      {attachment instanceof File ? (
                        <SelectedFilePreview
                          compact
                          file={attachment}
                          onRemove={() => {
                            form.setValue("attachment", undefined, {
                              shouldValidate: true,
                            })
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ""
                            }
                          }}
                        />
                      ) : (
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          Enter để gửi · Shift + Enter để xuống dòng
                        </span>
                      )}
                    </div>
                    <InputGroupButton
                      aria-label="Gửi tin nhắn"
                      disabled={isPending}
                      size="icon-sm"
                      type="submit"
                      variant="default"
                    >
                      {isPending ? (
                        <LoaderCircleIcon className="animate-spin" />
                      ) : (
                        <SendIcon />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="attachment"
          render={({ field: { onChange, ref, ...field } }) => (
            <FormItem>
              <FormLabel className="sr-only">Tệp đính kèm</FormLabel>
              <FormControl>
                <input
                  {...field}
                  ref={(node) => {
                    ref(node)
                    fileInputRef.current = node
                  }}
                  accept={CHAT_ATTACHMENT_ACCEPT}
                  className="sr-only"
                  type="file"
                  value={undefined}
                  onChange={(event) =>
                    onChange(event.target.files?.[0] ?? undefined)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
