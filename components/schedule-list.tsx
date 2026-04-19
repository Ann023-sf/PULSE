"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { CalendarEvent, Task } from "@/lib/data-utils"
import { cn } from "@/lib/utils"
import {
  Grid3X3,
  SquareCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  Square,
  CheckSquare,
} from "lucide-react"

interface ScheduleListProps {
  meetings: CalendarEvent[]
  overdueTasks: Task[]
  urgentTasks: Task[]
  dueTodayTasks: Task[]
}

export function ScheduleList({
  meetings,
  overdueTasks,
  urgentTasks,
}: ScheduleListProps) {
  // Track completed task IDs (using task name as identifier)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  // Load completed tasks from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("pulse-completed-tasks")
    if (saved) {
      try {
        setCompletedTasks(new Set(JSON.parse(saved)))
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  // Save completed tasks to localStorage
  useEffect(() => {
    localStorage.setItem("pulse-completed-tasks", JSON.stringify([...completedTasks]))
  }, [completedTasks])

  const toggleTaskComplete = (taskId: string) => {
    setCompletedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  // Filter tasks by completion status
  const pendingOverdue = overdueTasks.filter(t => !completedTasks.has(t.task))
  const pendingUrgent = urgentTasks.filter(t => !completedTasks.has(t.task))
  
  // Get completed tasks (from both overdue and urgent)
  const allTasks = [...overdueTasks, ...urgentTasks]
  const doneTasks = allTasks.filter(t => completedTasks.has(t.task))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Meetings Column */}
      <div className="glass rounded-2xl p-5 h-[280px] flex flex-col">
        <h3 className="font-semibold mb-4 flex items-center gap-2 text-foreground flex-shrink-0">
          <Grid3X3 className="w-4 h-4 text-primary" />
          {"Today's Meetings"}
        </h3>
        <div className="space-y-3 overflow-y-auto flex-1 pr-2 scrollbar-thin">
          {meetings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No meetings scheduled for today.
            </p>
          ) : (
            meetings.map((meeting, i) => (
              <div key={i} className="flex items-start gap-3" suppressHydrationWarning>
                <span className="text-sm text-muted-foreground min-w-[70px]" suppressHydrationWarning>
                  {format(meeting.startTime, "h:mm a").toUpperCase()}
                </span>
                <span className="text-sm text-foreground">
                  - {meeting.event}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tasks Column */}
      <div className="glass rounded-2xl p-5 h-[280px] flex flex-col">
        <h3 className="font-semibold mb-4 flex items-center gap-2 text-foreground flex-shrink-0">
          <SquareCheck className="w-4 h-4 text-chart-4" />
          Task Deadlines
        </h3>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2 scrollbar-thin">
          {/* Overdue Section */}
          {pendingOverdue.length > 0 && (
            <div>
              <span className="badge-overdue inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mb-3">
                <AlertCircle className="w-3 h-3" />
                Overdue
              </span>
              <div className="space-y-2 ml-1">
                {pendingOverdue.map((task, i) => (
                  <TaskItem
                    key={i}
                    task={task}
                    variant="overdue"
                    isCompleted={false}
                    onToggle={() => toggleTaskComplete(task.task)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Urgent Section */}
          {pendingUrgent.length > 0 && (
            <div>
              <span className="badge-urgent inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mb-3">
                <Clock className="w-3 h-3" />
                Urgent
              </span>
              <div className="space-y-2 ml-1">
                {pendingUrgent.map((task, i) => (
                  <TaskItem
                    key={i}
                    task={task}
                    variant="urgent"
                    isCompleted={false}
                    onToggle={() => toggleTaskComplete(task.task)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Already Done Section */}
          {doneTasks.length > 0 && (
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mb-3 bg-green-500/20 text-green-400 border border-green-500/30">
                <CheckCircle2 className="w-3 h-3" />
                Already Done
              </span>
              <div className="space-y-2 ml-1">
                {doneTasks.map((task, i) => (
                  <TaskItem
                    key={i}
                    task={task}
                    variant="done"
                    isCompleted={true}
                    onToggle={() => toggleTaskComplete(task.task)}
                  />
                ))}
              </div>
            </div>
          )}

          {pendingOverdue.length === 0 && pendingUrgent.length === 0 && doneTasks.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No urgent tasks or deadlines.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskItem({
  task,
  variant,
  isCompleted,
  onToggle,
}: {
  task: Task
  variant: "overdue" | "urgent" | "done"
  isCompleted: boolean
  onToggle: () => void
}) {
  const labelStyles = {
    overdue: "text-red-400",
    urgent: "text-muted-foreground",
    done: "text-green-400/60",
  }

  // Calculate days difference for display
  const now = new Date()
  const deadline = task.deadline
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  let dateLabel = ""
  if (diffDays < 0) {
    dateLabel = `(${Math.abs(diffDays)} days late)`
  } else {
    dateLabel = `(Due by ${format(deadline, "MMM d")})`
  }

  return (
    <div className={cn(
      "flex items-start gap-2 group",
      isCompleted && "opacity-70"
    )}>
      <button
        onClick={onToggle}
        className="mt-0.5 hover:scale-110 transition-transform"
        aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
      >
        {isCompleted ? (
          <CheckSquare className="w-4 h-4 text-green-400" />
        ) : (
          <Square className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        )}
      </button>
      <div className="flex-1">
        <span className={cn(
          "text-sm text-foreground",
          isCompleted && "line-through text-muted-foreground"
        )}>
          {task.task}
        </span>
        <span className={cn("text-xs ml-2", labelStyles[variant])}>
          {dateLabel}
        </span>
      </div>
    </div>
  )
}
