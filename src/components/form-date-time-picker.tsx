"use client"

import * as React from "react"
import { format, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { vi } from "react-day-picker/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { useFormField } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const subscribeToTimeZone = () => () => undefined
const getServerTimeZone = () => undefined
const getClientTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

function parseLocalDate(value: string) {
  const datePart = value.split("T", 1)[0]
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart)

  if (!match) {
    return undefined
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  )

  return isValid(date) && format(date, "yyyy-MM-dd") === datePart
    ? date
    : undefined
}

function getTime(value: string) {
  const time = value.split("T", 2)[1]?.slice(0, 5) ?? ""
  return /^\d{2}:\d{2}$/.test(time) ? time : ""
}

type FormDateTimePickerProps = {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
}

export function FormDateTimePicker({
  value,
  onChange,
  onBlur,
  placeholder = "Chọn ngày và giờ",
  disabled,
}: FormDateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const timeZone = React.useSyncExternalStore(
    subscribeToTimeZone,
    getClientTimeZone,
    getServerTimeZone
  )
  const selectedDate = parseLocalDate(value)
  const selectedTime = getTime(value)
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
  const describedBy = error
    ? `${formDescriptionId} ${formMessageId}`
    : formDescriptionId

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      onChange("")
      setOpen(false)
      return
    }

    onChange(`${format(date, "yyyy-MM-dd")}T${selectedTime || "00:00"}`)
    setOpen(false)
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              aria-describedby={describedBy}
              aria-invalid={Boolean(error)}
              className="min-w-0 justify-start overflow-hidden text-left font-normal data-[empty=true]:text-muted-foreground"
              data-empty={!selectedDate}
              disabled={disabled}
              id={formItemId}
              type="button"
              variant="outline"
              onBlur={onBlur}
            />
          }
        >
          <CalendarIcon />
          {selectedDate ? (
            <span className="truncate">
              {format(selectedDate, "PPP", { locale: vi })}
            </span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            timeZone={timeZone}
            locale={vi}
            onSelect={handleDateSelect}
          />
        </PopoverContent>
      </Popover>
      <Input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        aria-label="Giờ"
        className="min-w-0"
        disabled={disabled || !selectedDate}
        step={60}
        type="time"
        value={selectedTime}
        onBlur={onBlur}
        onChange={(event) => {
          if (!selectedDate) {
            return
          }

          onChange(
            `${format(selectedDate, "yyyy-MM-dd")}T${event.target.value}`
          )
        }}
      />
    </div>
  )
}
