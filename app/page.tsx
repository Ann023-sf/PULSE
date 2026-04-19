import { loadAllData } from "@/lib/data"
import { PulseDashboard } from "@/components/pulse-dashboard"

export default async function Home() {
  const { tasks, calendar, metrics } = await loadAllData()

  // Serialize dates for client components
  const serializedTasks = tasks.map((t) => ({
    ...t,
    deadline: t.deadline.toISOString(),
  }))

  const serializedCalendar = calendar.map((e) => ({
    ...e,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
  }))

  return (
    <main>
      <PulseDashboard
        initialTasks={serializedTasks.map((t) => ({
          ...t,
          deadline: new Date(t.deadline),
        }))}
        initialCalendar={serializedCalendar.map((e) => ({
          ...e,
          startTime: new Date(e.startTime),
          endTime: new Date(e.endTime),
        }))}
        initialMetrics={metrics}
      />
    </main>
  )
}
