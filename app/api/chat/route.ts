import { loadAllData, PulseData, Task, CalendarEvent, Metric, buildAIContext } from "@/lib/data"
import { startOfDay, isBefore, addDays, isSameDay, format, differenceInDays, parse, isWithinInterval, addMinutes, setHours, setMinutes } from "date-fns"
import { createGroq } from "@ai-sdk/groq"
import { streamText, convertToModelMessages } from "ai"

export const maxDuration = 60

const SYSTEM_PROMPT = `You are a careful program/delivery lead assistant for a consulting firm called "Pulse". Your role is to help the user understand their projects, tasks, meetings, and risks.

CRITICAL RULES:
1. You can ONLY answer based on the provided context data (emails, meetings, tasks, metrics).
2. NEVER make up or hallucinate information not present in the data.
3. If information is not available in the context, explicitly say "That information is not available in the current data."
4. For small talk or greetings, give short, natural replies.
5. For project-related questions, provide grounded, data-backed answers only.
6. When discussing risks or issues, cite specific data points from emails or metrics.
7. Always be professional and concise.
8. If asked about deadlines, cross-reference with the tasks data.
9. If asked about revenue at risk, cite specific amounts from emails.
10. Format your responses clearly with bullet points when listing multiple items.
11. When asked about availability or schedule, check the calendar data carefully.`

// Parse date from natural language
function parseNaturalDate(text: string): Date | null {
  const today = new Date()
  const lowerText = text.toLowerCase()
  
  // "today"
  if (lowerText.includes("today")) return today
  
  // "tomorrow"
  if (lowerText.includes("tomorrow")) return addDays(today, 1)
  
  // "next week"
  if (lowerText.includes("next week")) return addDays(today, 7)
  
  // Try to parse specific dates like "18 april", "april 18", "18th april", "apr 18"
  const datePatterns = [
    /(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i,
    /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
  ]
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) {
      try {
        let day: number, month: string | number
        
        if (pattern === datePatterns[0]) {
          day = parseInt(match[1])
          month = match[2]
        } else if (pattern === datePatterns[1]) {
          month = match[1]
          day = parseInt(match[2])
        } else {
          // MM/DD format
          month = parseInt(match[1]) - 1
          day = parseInt(match[2])
          const year = match[3] ? parseInt(match[3]) : today.getFullYear()
          return new Date(year, month as number, day)
        }
        
        const monthMap: { [key: string]: number } = {
          jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
          apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
          aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
          nov: 10, november: 10, dec: 11, december: 11
        }
        
        const monthNum = monthMap[(month as string).toLowerCase().substring(0, 3)]
        if (monthNum !== undefined) {
          return new Date(today.getFullYear(), monthNum, day)
        }
      } catch {
        continue
      }
    }
  }
  
  return null
}

// Parse time from natural language
function parseNaturalTime(text: string): { hours: number, minutes: number } | null {
  // Match patterns like "11:15am", "11:15 am", "11am", "2:30pm", "14:00"
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i,
    /(\d{1,2})\s*(am|pm)/i,
    /(\d{1,2}):(\d{2})/,
  ]
  
  for (const pattern of timePatterns) {
    const match = text.match(pattern)
    if (match) {
      let hours = parseInt(match[1])
      let minutes = match[2] && !match[2].match(/am|pm/i) ? parseInt(match[2]) : 0
      const ampm = match[3] || match[2]
      
      if (ampm && ampm.toLowerCase() === 'pm' && hours !== 12) {
        hours += 12
      } else if (ampm && ampm.toLowerCase() === 'am' && hours === 12) {
        hours = 0
      }
      
      return { hours, minutes }
    }
  }
  
  return null
}

// Check availability at a specific date/time
function checkAvailability(date: Date, time: { hours: number, minutes: number } | null, calendar: CalendarEvent[]): { isFree: boolean, conflicts: CalendarEvent[], nearbyMeetings: CalendarEvent[] } {
  const checkDate = startOfDay(date)
  const dayMeetings = calendar.filter(e => isSameDay(e.startTime, checkDate))
  
  if (!time) {
    // Just checking the day
    return {
      isFree: dayMeetings.length === 0,
      conflicts: dayMeetings,
      nearbyMeetings: dayMeetings
    }
  }
  
  // Create the specific datetime to check
  const checkTime = setMinutes(setHours(date, time.hours), time.minutes)
  
  // Check for conflicts (assuming 1 hour meetings)
  const conflicts = dayMeetings.filter(meeting => {
    const meetingEnd = addMinutes(meeting.startTime, 60)
    return isWithinInterval(checkTime, { start: meeting.startTime, end: meetingEnd }) ||
           isWithinInterval(meeting.startTime, { start: checkTime, end: addMinutes(checkTime, 30) })
  })
  
  // Find nearby meetings (within 2 hours)
  const nearbyMeetings = dayMeetings.filter(meeting => {
    const timeDiff = Math.abs(meeting.startTime.getTime() - checkTime.getTime())
    return timeDiff <= 2 * 60 * 60 * 1000 // 2 hours
  })
  
  return {
    isFree: conflicts.length === 0,
    conflicts,
    nearbyMeetings
  }
}

// Find L&D/training/course items
function findLearningItems(tasks: Task[], query: string): Task[] {
  const lowerQuery = query.toLowerCase()
  
  // Get all personal/learning tasks (those with type field)
  const learningTasks = tasks.filter(t => t.type)
  
  // Search by task name
  return learningTasks.filter(t => {
    const taskLower = t.task.toLowerCase()
    const typeLower = (t.type || "").toLowerCase()
    
    // Check if query terms are in the task name or type
    const queryWords = lowerQuery.split(/\s+/).filter(w => 
      w.length > 2 && !["the", "did", "have", "has", "start", "started", "begin", "begun", "finish", "finished", "complete", "completed", "course", "training", "l&d"].includes(w)
    )
    
    return queryWords.some(word => taskLower.includes(word) || typeLower.includes(word))
  })
}

// Smart response generator based on actual data
function generateResponse(query: string, data: PulseData): string {
  const q = query.toLowerCase()
  const today = startOfDay(new Date())
  
  // Separate project tasks from personal/learning tasks
  const projectTasks = data.tasks.filter(t => t.project && !t.type)
  const learningTasks = data.tasks.filter(t => t.type)
  
  // Get task categories (only project tasks)
  const overdueTasks = projectTasks.filter(t => 
    t.status !== "completed" && isBefore(startOfDay(t.deadline), today)
  )
  const urgentTasks = projectTasks.filter(t => {
    if (t.status === "completed") return false
    const deadline = startOfDay(t.deadline)
    return (isSameDay(deadline, today) || (isBefore(today, deadline) && isBefore(deadline, addDays(today, 4))))
  })
  const todayMeetings = data.calendar.filter(e => isSameDay(e.startTime, today))
  
  // Extract unique projects
  const projects = [...new Set([
    ...projectTasks.map(t => t.project).filter(Boolean),
    ...data.calendar.map(c => c.project).filter(Boolean),
    ...data.metrics.map(m => m.project).filter(Boolean),
  ])] as string[]

  // L&D / Training / Course queries
  if (q.includes("l&d") || q.includes("training") || q.includes("course") || q.includes("certification") || q.includes("learning") || q.includes("workshop") || q.includes("module")) {
    // Check if asking about a specific course
    const matchedItems = findLearningItems(data.tasks, query)
    
    if (matchedItems.length > 0) {
      const item = matchedItems[0]
      let response = `**${item.task}:**\n\n`
      response += `- **Type:** ${item.type}\n`
      response += `- **Status:** ${item.status}\n`
      response += `- **Deadline:** ${format(item.deadline, "MMMM d, yyyy 'at' h:mm a")}\n\n`
      
      if (item.status.toLowerCase() === "completed") {
        response += `You have already completed this.`
      } else if (item.status.toLowerCase() === "in progress") {
        response += `You have started this and it's currently in progress.`
      } else if (item.status.toLowerCase() === "not started") {
        response += `You have not started this yet. Deadline is ${format(item.deadline, "MMMM d")}.`
      }
      return response
    }
    
    // General L&D overview
    const notStarted = learningTasks.filter(t => t.status.toLowerCase() === "not started")
    const inProgress = learningTasks.filter(t => t.status.toLowerCase() === "in progress")
    const completed = learningTasks.filter(t => t.status.toLowerCase() === "completed")
    
    let response = "**Learning & Development Status:**\n\n"
    response += `**Summary:** ${completed.length} completed, ${inProgress.length} in progress, ${notStarted.length} not started\n\n`
    
    if (inProgress.length > 0) {
      response += `**In Progress:**\n`
      inProgress.slice(0, 5).forEach(t => {
        response += `- ${t.task} (Due: ${format(t.deadline, "MMM d")})\n`
      })
      response += "\n"
    }
    
    if (notStarted.length > 0) {
      response += `**Not Started:**\n`
      notStarted.slice(0, 5).forEach(t => {
        response += `- ${t.task} (Due: ${format(t.deadline, "MMM d")})\n`
      })
    }
    
    return response
  }

  // "Did I start/complete X" queries for L&D
  if ((q.includes("did i") || q.includes("have i")) && (q.includes("start") || q.includes("complete") || q.includes("finish") || q.includes("begin"))) {
    const matchedItems = findLearningItems(data.tasks, query)
    
    if (matchedItems.length > 0) {
      const item = matchedItems[0]
      if (item.status.toLowerCase() === "completed") {
        return `**Yes**, you have completed "${item.task}".\n\n- Type: ${item.type}\n- Deadline was: ${format(item.deadline, "MMMM d, yyyy")}`
      } else if (item.status.toLowerCase() === "in progress") {
        return `**Yes**, you have started "${item.task}" and it's currently in progress.\n\n- Type: ${item.type}\n- Deadline: ${format(item.deadline, "MMMM d, yyyy")}`
      } else {
        return `**No**, you have not started "${item.task}" yet.\n\n- Type: ${item.type}\n- Status: ${item.status}\n- Deadline: ${format(item.deadline, "MMMM d, yyyy")}`
      }
    }
    
    // Check project tasks too
    const projectMatch = projectTasks.find(t => {
      const queryWords = q.split(/\s+/).filter(w => w.length > 3)
      return queryWords.some(word => t.task.toLowerCase().includes(word))
    })
    
    if (projectMatch) {
      if (projectMatch.status === "completed") {
        return `**Yes**, "${projectMatch.task}" is completed.`
      } else {
        return `"${projectMatch.task}" is currently **${projectMatch.status}**.${projectMatch.project ? ` (Project: ${projectMatch.project})` : ""}`
      }
    }
    
    return `I couldn't find a specific task matching your query. Try asking about:\n- A specific course or training name\n- "Show my L&D status"\n- A project task by name`
  }

  // FREE / AVAILABLE / BUSY checks
  if (q.includes("free") || q.includes("available") || q.includes("busy") || (q.includes("am i") && !q.includes("start") && !q.includes("complete")) || q.includes("do i have")) {
    const parsedDate = parseNaturalDate(query)
    const parsedTime = parseNaturalTime(query)
    
    if (parsedDate) {
      const { isFree, conflicts, nearbyMeetings } = checkAvailability(parsedDate, parsedTime, data.calendar)
      const dateStr = format(parsedDate, "EEEE, MMMM d")
      const timeStr = parsedTime ? format(setMinutes(setHours(new Date(), parsedTime.hours), parsedTime.minutes), "h:mm a") : null
      
      if (timeStr) {
        if (isFree) {
          let response = `**Yes, you're free on ${dateStr} at ${timeStr}.**\n\n`
          if (nearbyMeetings.length > 0) {
            response += `Nearby meetings that day:\n`
            nearbyMeetings.forEach(m => {
              response += `- ${format(m.startTime, "h:mm a")} - ${m.event}${m.project ? ` (${m.project})` : ""}\n`
            })
          } else {
            response += `You have no meetings close to that time.`
          }
          return response
        } else {
          let response = `**No, you have a conflict on ${dateStr} at ${timeStr}.**\n\n`
          response += `Conflicting meeting(s):\n`
          conflicts.forEach(m => {
            response += `- ${format(m.startTime, "h:mm a")} - ${m.event}${m.project ? ` (${m.project})` : ""}\n`
          })
          return response
        }
      } else {
        // Just checking the day
        const dayMeetings = data.calendar.filter(e => isSameDay(e.startTime, parsedDate))
        if (dayMeetings.length === 0) {
          return `**Yes, you're free on ${dateStr}.** You have no meetings scheduled.`
        } else {
          let response = `**On ${dateStr}, you have ${dayMeetings.length} meeting(s):**\n\n`
          dayMeetings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()).forEach(m => {
            response += `- ${format(m.startTime, "h:mm a")} - ${m.event}${m.project ? ` (${m.project})` : ""}\n`
          })
          return response
        }
      }
    }
  }

  // WHAT'S ON / WHAT DO I HAVE on a specific date
  if (q.includes("what") && (q.includes("on") || q.includes("have") || q.includes("happening"))) {
    const parsedDate = parseNaturalDate(query)
    if (parsedDate) {
      const dateStr = format(parsedDate, "EEEE, MMMM d")
      const dayMeetings = data.calendar.filter(e => isSameDay(e.startTime, parsedDate))
      const dayTasks = projectTasks.filter(t => isSameDay(t.deadline, parsedDate) && t.status !== "completed")
      
      let response = `**Schedule for ${dateStr}:**\n\n`
      
      if (dayMeetings.length > 0) {
        response += `**Meetings (${dayMeetings.length}):**\n`
        dayMeetings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()).forEach(m => {
          response += `- ${format(m.startTime, "h:mm a")} - ${m.event}${m.project ? ` (${m.project})` : ""}\n`
        })
        response += "\n"
      } else {
        response += `**Meetings:** None scheduled.\n\n`
      }
      
      if (dayTasks.length > 0) {
        response += `**Tasks Due (${dayTasks.length}):**\n`
        dayTasks.forEach(t => {
          response += `- ${t.task}${t.project ? ` (${t.project})` : ""}\n`
        })
      } else {
        response += `**Tasks Due:** None.`
      }
      
      return response
    }
  }

  // HOW MANY meetings/tasks
  if (q.includes("how many")) {
    if (q.includes("meeting")) {
      const parsedDate = parseNaturalDate(query)
      if (parsedDate) {
        const dayMeetings = data.calendar.filter(e => isSameDay(e.startTime, parsedDate))
        const dateStr = format(parsedDate, "EEEE, MMMM d")
        if (dayMeetings.length === 0) {
          return `You have **no meetings** on ${dateStr}.`
        }
        let response = `You have **${dayMeetings.length} meeting(s)** on ${dateStr}:\n\n`
        dayMeetings.forEach(m => {
          response += `- ${format(m.startTime, "h:mm a")} - ${m.event}\n`
        })
        return response
      }
      return `You have **${data.calendar.length} total meetings** in your calendar, with **${todayMeetings.length}** scheduled for today.`
    }
    if (q.includes("task") || q.includes("overdue")) {
      return `You have **${projectTasks.length} project tasks**, of which **${overdueTasks.length} are overdue** and **${urgentTasks.length} are due within 3 days**.\n\nPlus **${learningTasks.length} L&D items**.`
    }
    if (q.includes("project")) {
      return `You are working on **${projects.length} projects**: ${projects.join(", ")}.`
    }
  }

  // EMAIL queries
  if (q.includes("email") || q.includes("mail") || q.includes("message") || q.includes("revenue") || q.includes("escalat") || q.includes("blocker")) {
    // Detect project name from query early for email filtering
    const emailProjectMatch = projects.find(p => q.includes(p.toLowerCase()))
    
    // Parse emails into structured format
    const emailBlocks = data.emails.split(/=== Email \d+ ===/i).filter(e => e.trim())
    
    const parsedEmails: { project: string, from: string, subject: string, body: string }[] = []
    for (const block of emailBlocks) {
      const projectMatch = block.match(/Project:\s*(.+)/i)
      const fromMatch = block.match(/From:\s*(.+)/i)
      const subjectMatch = block.match(/Subject:\s*(.+)/i)
      const bodyMatch = block.match(/Body:\s*([\s\S]+)/i)
      
      if (projectMatch || fromMatch || subjectMatch) {
        parsedEmails.push({
          project: projectMatch?.[1]?.trim() || "Unknown",
          from: fromMatch?.[1]?.trim() || "Unknown",
          subject: subjectMatch?.[1]?.trim() || "No subject",
          body: bodyMatch?.[1]?.trim() || ""
        })
      }
    }
    
    // Revenue at risk query
    if (q.includes("revenue") || q.includes("money") || q.includes("financial") || q.includes("$")) {
      const revenueMatches = data.emails.match(/\$[\d,]+k?|\d+k/gi) || []
      const revenueEmails = parsedEmails.filter(e => 
        e.body.toLowerCase().includes("revenue") || 
        e.body.match(/\$[\d,]+/) ||
        e.body.toLowerCase().includes("financial")
      )
      
      let response = "**Revenue at Risk Mentioned in Emails:**\n\n"
      if (revenueEmails.length > 0) {
        revenueEmails.slice(0, 5).forEach(e => {
          const amounts = e.body.match(/\$[\d,]+k?/gi) || []
          response += `- **${e.project}**: ${e.subject}\n`
          if (amounts.length > 0) {
            response += `  - Amounts mentioned: ${amounts.join(", ")}\n`
          }
        })
      } else {
        response += "No specific revenue-at-risk mentions found in recent emails."
      }
      return response
    }
    
    // Escalation query
    if (q.includes("escalat")) {
      const escalationEmails = parsedEmails.filter(e => 
        e.body.toLowerCase().includes("escalat") || 
        e.subject.toLowerCase().includes("escalat")
      )
      
      let response = "**Escalations in Emails:**\n\n"
      if (escalationEmails.length > 0) {
        escalationEmails.slice(0, 5).forEach(e => {
          response += `- **${e.project}**: ${e.subject}\n`
          response += `  - From: ${e.from.split("<")[0].trim()}\n`
        })
      } else {
        response += "No escalations found in recent emails."
      }
      return response
    }
    
    // Blocker query
    if (q.includes("blocker") || q.includes("blocked")) {
      const blockerEmails = parsedEmails.filter(e => 
        e.body.toLowerCase().includes("blocker") || 
        e.body.toLowerCase().includes("blocked")
      )
      
      let response = "**Blockers Mentioned in Emails:**\n\n"
      if (blockerEmails.length > 0) {
        blockerEmails.forEach(e => {
          response += `- **${e.project}**: ${e.subject}\n`
          // Extract blocker context
          const blockerMatch = e.body.match(/blocker[:\s]+([^.]+)/i)
          if (blockerMatch) {
            response += `  - "${blockerMatch[1].trim()}"\n`
          }
        })
      } else {
        response += "No blockers mentioned in recent emails."
      }
      return response
    }
    
    // Project-specific emails
    if (emailProjectMatch) {
      const projectEmails = parsedEmails.filter(e => 
        e.project.toLowerCase() === emailProjectMatch.toLowerCase()
      )
      
      let response = `**Emails for ${emailProjectMatch}:**\n\n`
      if (projectEmails.length > 0) {
        projectEmails.slice(0, 5).forEach(e => {
          response += `- **${e.subject}**\n`
          response += `  - From: ${e.from.split("<")[0].trim()}\n`
          // Show first 100 chars of body
          const preview = e.body.substring(0, 150).replace(/\n/g, " ")
          response += `  - ${preview}...\n\n`
        })
      } else {
        response += `No emails found for ${emailProjectMatch}.`
      }
      return response
    }
    
    // General email summary
    let response = `**Email Summary (${parsedEmails.length} emails):**\n\n`
    const projectGroups: { [key: string]: number } = {}
    parsedEmails.forEach(e => {
      projectGroups[e.project] = (projectGroups[e.project] || 0) + 1
    })
    
    response += "**Emails by Project:**\n"
    Object.entries(projectGroups).forEach(([project, count]) => {
      response += `- ${project}: ${count} email(s)\n`
    })
    
    response += "\n**Recent Subjects:**\n"
    parsedEmails.slice(0, 5).forEach(e => {
      response += `- [${e.project}] ${e.subject}\n`
    })
    
    return response
  }

  // Check for greetings
  if (q.match(/^(hi|hello|hey|good morning|good afternoon|good evening|yo|sup)/i)) {
    return `Hello! I'm your project assistant. I can help you understand your tasks, meetings, and project risks.\n\nQuick stats:\n- ${overdueTasks.length} overdue tasks\n- ${todayMeetings.length} meetings today\n- ${projects.length} active projects\n- ${learningTasks.length} L&D items\n\nWhat would you like to know?`
  }

  // Check if a project is mentioned for filtering
  const mentionedProject = projects.find(p => q.includes(p.toLowerCase()))

  // "What could blow up?" / Risk analysis - NOW PROJECT AWARE
  if (q.includes("blow up") || q.includes("risk") || q.includes("problem") || q.includes("issue") || q.includes("concern") || q.includes("worried") || q.includes("trouble")) {
    // If a specific project is mentioned, filter to just that project
    if (mentionedProject) {
      const projectOverdue = overdueTasks.filter(t => t.project?.toLowerCase() === mentionedProject.toLowerCase())
      const projectMetrics = data.metrics.filter(m => m.project?.toLowerCase() === mentionedProject.toLowerCase())
      const projectIssues = projectMetrics.filter(m => m.issues && m.issues.toLowerCase() !== "none" && m.issues.trim() !== "")
      
      let response = `**${mentionedProject} - Risk Analysis:**\n\n`
      
      if (projectOverdue.length > 0) {
        response += `**Overdue Tasks (${projectOverdue.length}):**\n`
        projectOverdue.forEach(t => {
          const daysLate = differenceInDays(today, t.deadline)
          response += `- ${t.task} - ${daysLate} days late\n`
        })
        response += "\n"
      } else {
        response += `**Overdue Tasks:** None\n\n`
      }
      
      if (projectIssues.length > 0) {
        response += `**Reported Issues:**\n`
        projectIssues.forEach(m => {
          response += `- ${m.issues} (Week: ${m.week})\n`
        })
      } else {
        response += `**Reported Issues:** None in recent metrics\n`
      }
      
      if (projectOverdue.length === 0 && projectIssues.length === 0) {
        response += `\n${mentionedProject} appears to be on track with no major issues.`
      }
      
      return response
    }
    
    // General risk analysis (all projects)
    let response = "**Potential Risk Areas:**\n\n"
    
    if (overdueTasks.length > 0) {
      response += `**Overdue Tasks (${overdueTasks.length}):**\n`
      overdueTasks.slice(0, 5).forEach(t => {
        const daysLate = differenceInDays(today, t.deadline)
        response += `- ${t.task}${t.project ? ` (${t.project})` : ""} - ${daysLate} days late\n`
      })
      if (overdueTasks.length > 5) response += `- ...and ${overdueTasks.length - 5} more\n`
      response += "\n"
    }
    
    // Check metrics for issues
    const issueMetrics = data.metrics.filter(m => m.issues && m.issues.toLowerCase() !== "none" && m.issues.trim() !== "")
    if (issueMetrics.length > 0) {
      response += "**Project Issues:**\n"
      issueMetrics.slice(0, 3).forEach(m => {
        response += `- ${m.project}: ${m.issues}\n`
      })
      response += "\n"
    }
    
    // Check emails for keywords
    const emailLower = data.emails.toLowerCase()
    if (emailLower.includes("risk") || emailLower.includes("delay") || emailLower.includes("blocked") || emailLower.includes("escalat")) {
      response += "**Email Alerts:** There are mentions of risks, delays, or escalations in recent emails.\n"
    }
    
    if (response === "**Potential Risk Areas:**\n\n") {
      response = "Based on current data, no major risks identified. All projects appear to be on track."
    }
    
    return response
  }

  // "Where are we?" - Status overview (but NOT if asking about a specific project)
  if ((q.includes("where are we") || q.includes("status") || q.includes("overview") || q.includes("summary") || q.includes("how are we doing")) && !mentionedProject) {
    let response = "**Current Status Overview:**\n\n"
    
    response += `**Tasks:**\n`
    response += `- Total: ${projectTasks.length}\n`
    response += `- Overdue: ${overdueTasks.length}\n`
    response += `- Due within 3 days: ${urgentTasks.length}\n`
    response += `- Completed: ${projectTasks.filter(t => t.status === "completed").length}\n\n`
    
    response += `**Today's Schedule:**\n`
    if (todayMeetings.length > 0) {
      todayMeetings.forEach(m => {
        response += `- ${format(m.startTime, "h:mm a")} - ${m.event}\n`
      })
    } else {
      response += `- No meetings today\n`
    }
    response += "\n"
    
    response += `**Active Projects:** ${projects.slice(0, 5).join(", ")}${projects.length > 5 ? ` (+${projects.length - 5} more)` : ""}\n`
    
    return response
  }

  // "Next two weeks" - Upcoming schedule
  if (q.includes("next two weeks") || q.includes("next 2 weeks") || q.includes("upcoming") || q.includes("coming up") || q.includes("what's ahead")) {
    const twoWeeksLater = addDays(today, 14)
    const upcomingTasks = projectTasks.filter(t => {
      const deadline = startOfDay(t.deadline)
      return t.status !== "completed" && !isBefore(deadline, today) && isBefore(deadline, twoWeeksLater)
    }).sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
    
    const upcomingMeetings = data.calendar.filter(e => {
      return !isBefore(e.startTime, today) && isBefore(e.startTime, twoWeeksLater)
    }).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    
    let response = "**Next Two Weeks:**\n\n"
    
    response += `**Upcoming Deadlines (${upcomingTasks.length}):**\n`
    upcomingTasks.slice(0, 7).forEach(t => {
      response += `- ${format(t.deadline, "MMM d")} - ${t.task}${t.project ? ` (${t.project})` : ""}\n`
    })
    if (upcomingTasks.length > 7) response += `- ...and ${upcomingTasks.length - 7} more\n`
    response += "\n"
    
    response += `**Upcoming Meetings (${upcomingMeetings.length}):**\n`
    upcomingMeetings.slice(0, 7).forEach(m => {
      response += `- ${format(m.startTime, "MMM d, h:mm a")} - ${m.event}\n`
    })
    if (upcomingMeetings.length > 7) response += `- ...and ${upcomingMeetings.length - 7} more\n`
    
    return response
  }

  // Project-specific queries (general info, not just risks)
  if (mentionedProject) {
    const projectTasksList = projectTasks.filter(t => t.project?.toLowerCase() === mentionedProject.toLowerCase())
    const projectMeetings = data.calendar.filter(c => c.project?.toLowerCase() === mentionedProject.toLowerCase())
    const projectMetrics = data.metrics.filter(m => m.project?.toLowerCase() === mentionedProject.toLowerCase())
    
    let response = `**${mentionedProject} Status:**\n\n`
    
    const pendingTasks = projectTasksList.filter(t => t.status !== "completed")
    const completedTasks = projectTasksList.filter(t => t.status === "completed")
    const projectOverdue = pendingTasks.filter(t => isBefore(t.deadline, today))
    
    response += `**Tasks:** ${pendingTasks.length} pending, ${completedTasks.length} completed\n`
    if (projectOverdue.length > 0) {
      response += `**Overdue:** ${projectOverdue.length}\n`
    }
    if (pendingTasks.length > 0) {
      response += "\n**Pending Tasks:**\n"
      pendingTasks.slice(0, 5).forEach(t => {
        const isOverdue = isBefore(t.deadline, today)
        response += `- ${t.task} | Due: ${format(t.deadline, "MMM d")}${isOverdue ? " (OVERDUE)" : ""}\n`
      })
      if (pendingTasks.length > 5) response += `- ...and ${pendingTasks.length - 5} more\n`
    }
    response += "\n"
    
    if (projectMeetings.length > 0) {
      const upcomingProjectMeetings = projectMeetings.filter(m => !isBefore(m.startTime, today))
      response += `**Upcoming Meetings (${upcomingProjectMeetings.length}):**\n`
      upcomingProjectMeetings.slice(0, 3).forEach(m => {
        response += `- ${format(m.startTime, "MMM d, h:mm a")} - ${m.event}\n`
      })
      response += "\n"
    }
    
    if (projectMetrics.length > 0) {
      const latest = projectMetrics[projectMetrics.length - 1]
      response += `**Latest Metrics:**\n`
      response += `- Progress: ${latest.progress}\n`
      if (latest.issues && latest.issues !== "None") {
        response += `- Issues: ${latest.issues}\n`
      }
    }
    
    return response
  }

  // Meetings query
  if (q.includes("meeting") || q.includes("calendar") || q.includes("schedule")) {
    let response = "**Meetings:**\n\n"
    
    response += `**Today (${todayMeetings.length}):**\n`
    if (todayMeetings.length > 0) {
      todayMeetings.forEach(m => {
        response += `- ${format(m.startTime, "h:mm a")} - ${m.event}${m.project ? ` (${m.project})` : ""}\n`
      })
    } else {
      response += "No meetings today.\n"
    }
    
    const tomorrowMeetings = data.calendar.filter(e => isSameDay(e.startTime, addDays(today, 1)))
    response += `\n**Tomorrow (${tomorrowMeetings.length}):**\n`
    if (tomorrowMeetings.length > 0) {
      tomorrowMeetings.forEach(m => {
        response += `- ${format(m.startTime, "h:mm a")} - ${m.event}${m.project ? ` (${m.project})` : ""}\n`
      })
    } else {
      response += "No meetings tomorrow.\n"
    }
    
    return response
  }

  // Tasks query
  if (q.includes("task") || q.includes("deadline") || q.includes("due") || q.includes("to do") || q.includes("todo")) {
    let response = "**Task Summary:**\n\n"
    
    if (overdueTasks.length > 0) {
      response += `**Overdue (${overdueTasks.length}):**\n`
      overdueTasks.slice(0, 5).forEach(t => {
        response += `- ${t.task}${t.project ? ` (${t.project})` : ""}\n`
      })
      if (overdueTasks.length > 5) response += `- ...and ${overdueTasks.length - 5} more\n`
      response += "\n"
    }
    
    response += `**Due Soon (${urgentTasks.length}):**\n`
    urgentTasks.slice(0, 5).forEach(t => {
      response += `- ${t.task} - Due ${format(t.deadline, "MMM d")}${t.project ? ` (${t.project})` : ""}\n`
    })
    if (urgentTasks.length > 5) response += `- ...and ${urgentTasks.length - 5} more\n`
    
    return response
  }

  // Thank you / appreciation
  if (q.match(/thank|thanks|appreciate|great|awesome|perfect/i)) {
    return "You're welcome! Let me know if you need anything else."
  }

  // Help
  if (q.includes("help") || q.includes("what can you")) {
    return `I can help you with:\n\n**Availability:**\n- "Am I free on April 18 at 11:15am?"\n- "What's on tomorrow?"\n- "How many meetings do I have today?"\n\n**Projects & Tasks:**\n- "What's the status of [Project Name]?"\n- "Are there issues in Retail Analytics?"\n- "Show me overdue tasks"\n\n**L&D / Training:**\n- "Did I start the Time management course?"\n- "Show my L&D status"\n- "What certifications are pending?"\n\n**Risks & Planning:**\n- "What could blow up?"\n- "Where are we?"\n- "Next two weeks"\n\nJust ask naturally!`
  }

  // Default - try to be helpful
  return `I'm not sure I understood that. Here are some things I can help with:\n\n- **Availability:** "Am I free on [date] at [time]?"\n- **Schedule:** "What's on tomorrow?" or "How many meetings today?"\n- **Projects:** Ask about a specific project by name\n- **L&D:** "Did I start [course name]?" or "Show my training status"\n- **Risks:** "What could blow up?" or "Any issues in [project]?"\n- **Overview:** "Where are we?" or "Status update"\n\nTry asking in a different way!`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const messages = body.messages || []
    const apiKey = body.apiKey // API key passed from client
    
    // Get the last user message
    const lastMessage = messages[messages.length - 1]
    let userQuery = ""
    
    if (lastMessage?.parts) {
      const textPart = lastMessage.parts.find((p: { type: string }) => p.type === "text")
      userQuery = textPart?.text || ""
    } else if (lastMessage?.content) {
      userQuery = lastMessage.content
    }

    if (!userQuery) {
      return new Response(
        JSON.stringify({ error: "No message provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Load data
    const data = await loadAllData()
    const contextData = buildAIContext(data)

    // If API key provided, use real Groq AI
    if (apiKey) {
      try {
        const groq = createGroq({ apiKey })
        
        const systemMessage = `${SYSTEM_PROMPT}\n\n=== PROJECT DATA ===\n${contextData}`
        
        // Convert messages to proper format
        const formattedMessages = messages.map((m: { role: string; parts?: { type: string; text: string }[]; content?: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.parts?.find((p: { type: string }) => p.type === "text")?.text || m.content || ""
        }))
        
        const result = streamText({
          model: groq("llama-3.3-70b-versatile"),
          system: systemMessage,
          messages: formattedMessages,
        })
        
        return result.toTextStreamResponse()
      } catch (aiError) {
        console.error("Groq AI Error:", aiError)
        // Fall back to simulated AI if Groq fails
      }
    }

    // Fallback: Use simulated AI
    const response = generateResponse(userQuery, data)

    // Stream the response for a typing effect
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const words = response.split(/(\s+)/)
        for (const word of words) {
          controller.enqueue(encoder.encode(word))
          await new Promise(resolve => setTimeout(resolve, 15))
        }
        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      }
    })
  } catch (error) {
    console.error("Chat API Error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
