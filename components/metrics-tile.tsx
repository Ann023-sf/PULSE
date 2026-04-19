"use client"

import { cn } from "@/lib/utils"

interface MetricsTileProps {
  title: string
  value: number
  variant: "blue" | "red" | "orange" | "green"
  icon: React.ReactNode
}

export function MetricsTile({
  title,
  value,
  variant,
  icon,
}: MetricsTileProps) {
  const glowStyles = {
    blue: "glow-blue bg-gradient-to-br from-blue-900/50 to-blue-950/70",
    red: "glow-red bg-gradient-to-br from-red-900/50 to-red-950/70",
    orange: "glow-orange bg-gradient-to-br from-orange-900/50 to-orange-950/70",
    green: "glow-green bg-gradient-to-br from-green-900/50 to-green-950/70",
  }

  const iconBgStyles = {
    blue: "bg-blue-500/30",
    red: "bg-red-500/30",
    orange: "bg-orange-500/30",
    green: "bg-green-500/30",
  }

  const iconColorStyles = {
    blue: "text-blue-300",
    red: "text-red-300",
    orange: "text-orange-300",
    green: "text-green-300",
  }

  return (
    <div
      className={cn(
        "rounded-lg p-2 sm:p-2.5 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02]",
        glowStyles[variant]
      )}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className={cn("p-1 rounded-full", iconBgStyles[variant])}>
          <span className={cn("w-3 h-3 block", iconColorStyles[variant])}>{icon}</span>
        </div>
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground leading-tight truncate">{title}</span>
      </div>
      <p className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground text-center">
        {value}
      </p>
    </div>
  )
}
