"use client"

import { useState } from "react"
import {
  CalendarEvent,
  Task,
  Metric,
  getMeetingsForDay,
  getOverdueTasks,
  getUrgentTasks,
  getDueTodayTasks,
} from "@/lib/data-utils"
import { MetricsTile } from "./metrics-tile"
import { ScheduleList } from "./schedule-list"
import { ChatAssistant } from "./chat-assistant"
import { MoodRefresh } from "./mood-refresh"
import { NotesScratchpad } from "./notes-scratchpad"
import { FocusDatePicker } from "./focus-date-picker"
import { AnimatedBackground } from "./animated-background"
import { SalesforcePanel } from "./salesforce-panel"
import {
  MessageSquare,
  AlertCircle,
  Calendar,
  CheckCircle,
} from "lucide-react"

interface PulseDashboardProps {
  initialTasks: Task[]
  initialCalendar: CalendarEvent[]
  initialMetrics: Metric[]
}

export function PulseDashboard({
  initialTasks,
  initialCalendar,
}: PulseDashboardProps) {
  const [focusDate, setFocusDate] = useState(new Date())

  // Compute derived data based on focus date
  const meetings = getMeetingsForDay(initialCalendar, focusDate)
  const overdueTasks = getOverdueTasks(initialTasks, focusDate)
  const urgentTasks = getUrgentTasks(initialTasks, focusDate)
  const dueTodayTasks = getDueTodayTasks(initialTasks, focusDate)

  return (
    <div className="min-h-screen animated-bg relative">
      <AnimatedBackground />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header - Large PULSE title */}
        <header className="text-center mb-8">
          <h1 className="font-serif text-6xl sm:text-7xl font-bold tracking-wide text-foreground">
            PULSE
          </h1>
        </header>

        {/* Focus Day Selector */}
        <section className="mb-8">
          <FocusDatePicker focusDate={focusDate} onDateChange={setFocusDate} />
        </section>

        {/* Metrics Row - 4 cards always in one row */}
        <section className="grid grid-cols-4 gap-3 mb-6">
          <MetricsTile
            title="Meetings Today"
            value={meetings.length}
            variant="blue"
            icon={<MessageSquare className="w-4 h-4" />}
          />
          <MetricsTile
            title="Overdue Tasks"
            value={overdueTasks.length}
            variant="red"
            icon={<AlertCircle className="w-4 h-4" />}
          />
          <MetricsTile
            title="Due Next 3 Days"
            value={urgentTasks.length}
            variant="orange"
            icon={<Calendar className="w-4 h-4" />}
          />
          <MetricsTile
            title="Due Today"
            value={dueTodayTasks.length}
            variant="green"
            icon={<CheckCircle className="w-4 h-4" />}
          />
        </section>

        {/* Schedule & Deadlines - Two columns */}
        <section className="mb-8">
          <ScheduleList
            meetings={meetings}
            overdueTasks={overdueTasks}
            urgentTasks={urgentTasks}
            dueTodayTasks={dueTodayTasks}
          />
        </section>

        {/* AI Assistant - Full width */}
        <section className="mb-8">
          <ChatAssistant />
        </section>

        {/* Salesforce Panel */}
        <section className="mb-8">
          <SalesforcePanel />
        </section>

        {/* Bottom Section - Two columns: Mood Refresh + Notes */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MoodRefresh />
          <NotesScratchpad />
        </section>
      </div>
    </div>
  )
}
