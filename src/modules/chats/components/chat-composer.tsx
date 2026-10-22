"use client"

import { useEffect, useRef, useTransition, type ClipboardEvent } from "react"
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
import {
  CHAT_ATTACHMENT_ACCEPT,
  chatAttachmentFileSchema,
} from "@/lib/validation"
import { ImageUploadProgress } from "@/components/image-upload-progress"
import { useImageUpload } from "@/hooks/use-image-upload"
import { sendMessageAction } from "@/modules/chats/actions"
import { ChatEmojiPicker } from "@/modules/chats/components/chat-emoji-picker"
import { ChatReplyPreview } from "@/modules/chats/components/chat-reply-preview"
import {
  sendMessageSchema,
  type SendMessageValues,
} from "@/modules/chats/schemas/chats"
import type { ChatMessage, ChatReply } from "@/types/chat"

export function ChatComposer({
  conversationSlug,
  socketId,
  replyTo,
  onCancelReply,
  onSent,
}: {
  conversationSlug: string
  socketId?: string
  replyTo?: ChatReply | null
  onCancelReply?: () => void
  onSent: (message: ChatMessage, replyToId?: string | null) => void
}) {
  const [isPending, startTransition] = useTransition()
  const { prepareUploads, uploadProgress } = useImageUpload()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const form = useForm<SendMessageValues>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { body: "", attachment: undefined },
  })
  const attachment = useWatch({ control: form.control, name: "attachment" })

  useEffect(() => {
    if (replyTo?.id) textareaRef.current?.focus()
    form.clearErrors("reply_to_id")
  }, [form, replyTo?.id])

  const pasteImage = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (isPending) return

    const image =
      Array.from(event.clipboardData.items ?? [])
        .filter(
          (item) => item.kind === "file" && item.type.startsWith("image/")
        )
        .map((item) => item.getAsFile())
        .find((file) => file !== null) ??
      Array.from(event.clipboardData.files ?? []).find((file) =>
        file.type.startsWith("image/")
      )

    if (!image) return
    event.preventDefault()

    const parsed = chatAttachmentFileSchema("Ảnh dán không hợp lệ.").safeParse(
      image
    )
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Không thể dán ảnh này.")
      return
    }

    form.setValue("attachment", parsed.data, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const insertEmoji = (emoji: string) => {
    if (isPending) return

    const textarea = textareaRef.current
    const body = form.getValues("body") ?? ""
    const start = textarea?.selectionStart ?? body.length
    const end = textarea?.selectionEnd ?? body.length
    const nextBody = body.slice(0, start) + emoji + body.slice(end)

    form.setValue("body", nextBody, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })

    requestAnimationFrame(() => {
      if (!textarea?.isConnected) return
      textarea.focus()
      textarea.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData()
    appendOptionalString(formData, "body", values.body)
    appendOptionalFile(formData, "attachment", values.attachment)
    if (replyTo) formData.set("reply_to_id", replyTo.id)
    if (socketId) formData.set("socket_id", socketId)

    startTransition(async () => {
      const state = await runUploadAction(async () =>
        sendMessageAction(
          conversationSlug,
          await prepareUploads(formData, "chat")
        )
      )
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success && state.data) {
        onSent(state.data, replyTo?.id ?? null)
        form.reset({ body: "", attachment: undefined })
        return
      }

      if (!hasFieldErrors && state.message) toast.error(state.message)
    })
  })

  return (
    <Form {...form}>
      <form
        className="shrink-0 border-t border-border/60 bg-card px-3 py-3 sm:px-4"
        noValidate
        onSubmit={onSubmit}
      >
        {replyTo ? (
          <ChatReplyPreview
            className="mb-2 max-w-none"
            reply={replyTo}
            onCancel={isPending ? undefined : onCancelReply}
          />
        ) : null}
        {form.formState.errors.reply_to_id?.message ? (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {form.formState.errors.reply_to_id.message}
          </p>
        ) : null}
        {attachment instanceof File ? (
          <SelectedFilePreview
            compact
            className="mb-2 max-w-full sm:max-w-sm"
            file={attachment}
            onRemove={
              isPending
                ? undefined
                : () => {
                    form.setValue("attachment", undefined, {
                      shouldValidate: true,
                    })
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }
            }
          />
        ) : null}
        <ImageUploadProgress progress={isPending ? uploadProgress : null} />
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Nội dung tin nhắn</FormLabel>
              <FormControl>
                <InputGroup className="h-auto items-end rounded-2xl bg-muted/30 p-1 shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/15">
                  <InputGroupAddon
                    align="inline-start"
                    className="gap-0 self-end py-1 pl-1 has-[>button]:ml-0"
                  >
                    <InputGroupButton
                      aria-label="Đính kèm tệp"
                      className="rounded-full"
                      disabled={isPending}
                      size="icon-sm"
                      title="Đính kèm tệp"
                      onClick={() => {
                        if (!fileInputRef.current) return
                        fileInputRef.current.value = ""
                        fileInputRef.current.click()
                      }}
                    >
                      <PaperclipIcon />
                    </InputGroupButton>
                    <ChatEmojiPicker
                      disabled={isPending}
                      focusTarget={textareaRef}
                      onSelect={insertEmoji}
                    />
                  </InputGroupAddon>
                  <InputGroupTextarea
                    aria-label="Nội dung tin nhắn"
                    className="max-h-32 min-h-10 min-w-0 px-2 py-2.5"
                    disabled={isPending}
                    placeholder="Nhắn tin..."
                    rows={1}
                    title="Enter để gửi · Shift + Enter để xuống dòng · Dán ảnh bằng Ctrl/⌘ + V"
                    {...field}
                    ref={(node) => {
                      field.ref(node)
                      textareaRef.current = node
                    }}
                    value={field.value ?? ""}
                    onPaste={pasteImage}
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
                    align="inline-end"
                    className="self-end py-1 pr-1 has-[>button]:mr-0"
                  >
                    <InputGroupButton
                      aria-label="Gửi tin nhắn"
                      className="rounded-full"
                      disabled={isPending}
                      size="icon-sm"
                      title="Gửi tin nhắn"
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
