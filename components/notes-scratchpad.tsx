"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { FileText, Check } from "lucide-react"

const STORAGE_KEY = "pulse-notes"

export function NotesScratchpad() {
  const [notes, setNotes] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const savedNotes = localStorage.getItem(STORAGE_KEY)
    if (savedNotes) {
      setNotes(savedNotes)
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, notes)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="glass rounded-2xl p-5 h-full min-h-[340px] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="font-semibold flex items-center gap-2 text-foreground">
          <FileText className="w-4 h-4 text-primary" />
          Notes
        </h3>
        <Button
          onClick={handleSave}
          variant="ghost"
          size="sm"
          className={`h-7 text-xs gap-1 ${
            saved
              ? "text-green-400 hover:text-green-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {saved ? (
            <>
              <Check className="w-3 h-3" />
              Saved
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
      
      <div className="flex-1 rounded-xl overflow-hidden">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Scratchpad Notes"
          className="w-full h-full paper-texture rounded-xl px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none border-0"
          style={{ 
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: "#1a1a1a",
            caretColor: "#1a1a1a",
            minHeight: "100%",
          }}
        />
      </div>
    </div>
  )
}
