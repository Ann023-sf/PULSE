import {
  isBefore,
  isAfter,
  addDays,
  isSameDay,
  startOfDay,
} from "date-fns"

export interface Task {
  task: string
  project?: string
  owner?: string
  status: string
  deadline: Date
  priority?: string
  type?: string
}

export interface CalendarEvent {
  event: string
  project: string
  startTime: Date
  endTime: Date
  participants: string
}

export interface Metric {
  week: string
  project: string
  progress: string
  issues: string
}

export const DEADLINE_URGENT_DAYS = 3

export function getMeetingsForDay(
  events: CalendarEvent[],
  focusDate: Date
): CalendarEvent[] {
  const focusStart = startOfDay(focusDate)
  return events.filter((e) => isSameDay(e.startTime, focusStart))
}

export function getOverdueTasks(tasks: Task[], focusDate: Date): Task[] {
  const focusStart = startOfDay(focusDate)
  return tasks.filter(
    (t) =>
      t.status !== "completed" && isBefore(startOfDay(t.deadline), focusStart)
  )
}

export function getUrgentTasks(tasks: Task[], focusDate: Date): Task[] {
  const focusStart = startOfDay(focusDate)
  const urgentEnd = addDays(focusStart, DEADLINE_URGENT_DAYS)

  return tasks.filter((t) => {
    if (t.status === "completed") return false
    const deadlineStart = startOfDay(t.deadline)
    return (
      (isAfter(deadlineStart, focusStart) ||
        isSameDay(deadlineStart, focusStart)) &&
      (isBefore(deadlineStart, urgentEnd) ||
        isSameDay(deadlineStart, urgentEnd)) &&
      !isSameDay(deadlineStart, focusStart)
    )
  })
}

export function getDueTodayTasks(tasks: Task[], focusDate: Date): Task[] {
  const focusStart = startOfDay(focusDate)
  return tasks.filter(
    (t) => t.status !== "completed" && isSameDay(startOfDay(t.deadline), focusStart)
  )
}
