import { promises as fs } from "fs"
import path from "path"
import {
  parseISO,
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

export interface PulseData {
  tasks: Task[]
  calendar: CalendarEvent[]
  metrics: Metric[]
  emails: string
}

const DATA_DIR = path.join(process.cwd(), "data")

function parseFlexibleDate(dateStr: string): Date {
  try {
    // Try ISO format first
    const parsed = parseISO(dateStr)
    if (!isNaN(parsed.getTime())) return parsed

    // Try other common formats
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) return date

    return new Date()
  } catch {
    return new Date()
  }
}

function normalizeStatus(status: string): string {
  const lower = status.toLowerCase().trim()
  if (lower === "done" || lower === "completed" || lower === "complete") {
    return "completed"
  }
  if (lower === "in progress" || lower === "in-progress") {
    return "in progress"
  }
  if (lower === "not started" || lower === "not-started") {
    return "not started"
  }
  if (lower === "delayed") {
    return "delayed"
  }
  return lower
}

export async function loadTasks(): Promise<Task[]> {
  const tasks: Task[] = []

  // Load tasks.csv
  try {
    const tasksContent = await fs.readFile(
      path.join(DATA_DIR, "tasks.csv"),
      "utf-8"
    )
    const lines = tasksContent.trim().split("\n")
    const headers = lines[0].split(",")

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",")
      const task: Task = {
        task: values[0] || "",
        project: values[1] || "",
        owner: values[2] || "",
        status: normalizeStatus(values[3] || ""),
        deadline: parseFlexibleDate(values[4] || ""),
        priority: values[5] || "",
      }
      tasks.push(task)
    }
  } catch (e) {
    console.log("tasks.csv not found or error reading")
  }

  // Load personal.csv and merge
  try {
    const personalContent = await fs.readFile(
      path.join(DATA_DIR, "personal.csv"),
      "utf-8"
    )
    const lines = personalContent.trim().split("\n")

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",")
      const task: Task = {
        task: values[0] || "",
        type: values[1] || "",
        status: normalizeStatus(values[3] || ""),
        deadline: parseFlexibleDate(values[2] || ""),
      }
      tasks.push(task)
    }
  } catch (e) {
    console.log("personal.csv not found or error reading")
  }

  return tasks
}

export async function loadCalendar(): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = []

  try {
    const content = await fs.readFile(
      path.join(DATA_DIR, "calendar.csv"),
      "utf-8"
    )
    const lines = content.trim().split("\n")

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",")
      events.push({
        event: values[0] || "",
        project: values[1] || "",
        startTime: parseFlexibleDate(values[2] || ""),
        endTime: parseFlexibleDate(values[3] || ""),
        participants: values[4] || "",
      })
    }
  } catch (e) {
    console.log("calendar.csv not found or error reading")
  }

  return events
}

export async function loadMetrics(): Promise<Metric[]> {
  const metrics: Metric[] = []

  try {
    const content = await fs.readFile(
      path.join(DATA_DIR, "metrics.csv"),
      "utf-8"
    )
    const lines = content.trim().split("\n")

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",")
      metrics.push({
        week: values[0] || "",
        project: values[1] || "",
        progress: values[2] || "",
        issues: values[3] || "",
      })
    }
  } catch (e) {
    console.log("metrics.csv not found or error reading")
  }

  return metrics
}

export async function loadEmails(): Promise<string> {
  try {
    return await fs.readFile(path.join(DATA_DIR, "emails.txt"), "utf-8")
  } catch (e) {
    return ""
  }
}

export async function loadAllData(): Promise<PulseData> {
  const [tasks, calendar, metrics, emails] = await Promise.all([
    loadTasks(),
    loadCalendar(),
    loadMetrics(),
    loadEmails(),
  ])

  return { tasks, calendar, metrics, emails }
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

export function buildAIContext(data: PulseData): string {
  let context = ""
  const today = startOfDay(new Date())
  const nextWeek = addDays(today, 7)

  // Condensed emails - only recent/important summaries (limit to 2000 chars)
  context += "=== RECENT EMAIL HIGHLIGHTS ===\n"
  const emailSummary = data.emails.substring(0, 2000)
  context += emailSummary || "No emails available."
  context += "\n\n"

  // Only upcoming 7 days of meetings
  context += "=== UPCOMING MEETINGS (Next 7 Days) ===\n"
  const upcomingMeetings = data.calendar.filter(e => 
    (isAfter(e.startTime, today) || isSameDay(e.startTime, today)) && 
    isBefore(e.startTime, nextWeek)
  ).slice(0, 15)
  
  if (upcomingMeetings.length > 0) {
    upcomingMeetings.forEach((e) => {
      context += `- ${e.event} (${e.project}) | ${e.startTime.toLocaleDateString()} ${e.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n`
    })
  } else {
    context += "No meetings in next 7 days.\n"
  }
  context += "\n"

  // Only incomplete tasks, prioritized
  context += "=== OPEN TASKS ===\n"
  const openTasks = data.tasks
    .filter(t => t.status !== "completed")
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
    .slice(0, 20)
    
  if (openTasks.length > 0) {
    openTasks.forEach((t) => {
      const daysUntil = Math.ceil((t.deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const urgency = daysUntil < 0 ? "OVERDUE" : daysUntil <= 3 ? "URGENT" : ""
      context += `- ${t.task} | ${t.project || t.type || "Personal"} | Due: ${t.deadline.toLocaleDateString()} ${urgency}\n`
    })
  } else {
    context += "No open tasks.\n"
  }
  context += "\n"

  // Only latest metrics
  context += "=== LATEST PROJECT METRICS ===\n"
  const latestMetrics = data.metrics.slice(-8)
  if (latestMetrics.length > 0) {
    latestMetrics.forEach((m) => {
      context += `- ${m.project}: ${m.progress} | Issues: ${m.issues}\n`
    })
  } else {
    context += "No metrics available.\n"
  }

  return context
}
