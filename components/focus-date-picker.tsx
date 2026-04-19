"use client"

import { useState } from "react"
import { format, addDays, subDays } from "date-fns"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"

interface FocusDatePickerProps {
  focusDate: Date
  onDateChange: (date: Date) => void
}

export function FocusDatePicker({
  focusDate,
  onDateChange,
}: FocusDatePickerProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onDateChange(date)
      setOpen(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground font-medium">Focus Date:</span>
        <span className="text-xl font-serif font-semibold text-foreground" suppressHydrationWarning>
          {format(focusDate, "MMMM d, yyyy")}
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8 bg-white/10 border-white/20 hover:bg-white/20"
            >
              <CalendarIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-card/95 backdrop-blur-xl border-white/10" align="center">
            <Calendar
              mode="single"
              selected={focusDate}
              onSelect={handleSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <p className="text-sm text-muted-foreground italic">
        Review your meetings and tasks based on this focus day.
      </p>
    </div>
  )
}
