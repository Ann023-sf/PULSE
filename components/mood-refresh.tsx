"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Gamepad2, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

type GameType = "bubbles" | "memory" | "reaction" | "clicker"

const GAMES = [
  { id: "bubbles" as GameType, name: "Bubble Pop" },
  { id: "memory" as GameType, name: "Memory Match" },
  { id: "reaction" as GameType, name: "Reaction Test" },
  { id: "clicker" as GameType, name: "Click Counter" },
]

// Bubble Pop Game
function BubblePopGame() {
  const [bubbles, setBubbles] = useState<{ id: number; x: number; y: number; size: number; color: string }[]>([])
  const [score, setScore] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      if (bubbles.length < 8) {
        const colors = ["#60a5fa", "#34d399", "#f472b6", "#a78bfa", "#fbbf24"]
        setBubbles((prev) => [
          ...prev,
          {
            id: Date.now(),
            x: Math.random() * 80 + 10,
            y: Math.random() * 60 + 20,
            size: Math.random() * 20 + 25,
            color: colors[Math.floor(Math.random() * colors.length)],
          },
        ])
      }
    }, 800)
    return () => clearInterval(interval)
  }, [bubbles.length])

  const popBubble = (id: number) => {
    setBubbles((prev) => prev.filter((b) => b.id !== id))
    setScore((s) => s + 1)
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <div className="absolute top-2 right-2 text-xs text-primary font-semibold">Score: {score}</div>
      {bubbles.map((bubble) => (
        <button
          key={bubble.id}
          onClick={() => popBubble(bubble.id)}
          className="absolute rounded-full cursor-pointer transition-transform hover:scale-110 active:scale-90 animate-pulse"
          style={{
            left: `${bubble.x}%`,
            top: `${bubble.y}%`,
            width: bubble.size,
            height: bubble.size,
            background: `radial-gradient(circle at 30% 30%, white, ${bubble.color})`,
            boxShadow: `0 4px 15px ${bubble.color}60`,
          }}
        />
      ))}
      <p className="absolute bottom-2 left-2 text-xs text-muted-foreground">Pop the bubbles!</p>
    </div>
  )
}

// Memory Match Game
function MemoryGame() {
  const emojis = ["🌟", "🌙", "⚡", "🔥", "💎", "🌸"]
  const [cards, setCards] = useState<{ id: number; emoji: string; flipped: boolean; matched: boolean }[]>([])
  const [flippedIds, setFlippedIds] = useState<number[]>([])
  const [moves, setMoves] = useState(0)

  useEffect(() => {
    const shuffled = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }))
    setCards(shuffled)
  }, [])

  const flipCard = (id: number) => {
    if (flippedIds.length === 2) return
    const card = cards.find((c) => c.id === id)
    if (!card || card.flipped || card.matched) return

    const newCards = cards.map((c) => (c.id === id ? { ...c, flipped: true } : c))
    setCards(newCards)
    const newFlipped = [...flippedIds, id]
    setFlippedIds(newFlipped)

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1)
      const [first, second] = newFlipped.map((fid) => newCards.find((c) => c.id === fid)!)
      if (first.emoji === second.emoji) {
        setCards((prev) => prev.map((c) => (c.id === first.id || c.id === second.id ? { ...c, matched: true } : c)))
        setFlippedIds([])
      } else {
        setTimeout(() => {
          setCards((prev) => prev.map((c) => (c.id === first.id || c.id === second.id ? { ...c, flipped: false } : c)))
          setFlippedIds([])
        }, 800)
      }
    }
  }

  const resetGame = () => {
    const shuffled = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }))
    setCards(shuffled)
    setFlippedIds([])
    setMoves(0)
  }

  const allMatched = cards.length > 0 && cards.every((c) => c.matched)

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-muted-foreground">Moves: {moves}</span>
        <button onClick={resetGame} className="text-xs text-primary hover:underline">Reset</button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 flex-1">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => flipCard(card.id)}
            className={`rounded-md flex items-center justify-center text-lg transition-all duration-300 ${
              card.flipped || card.matched
                ? "bg-primary/20 rotate-0"
                : "bg-muted/50 hover:bg-muted/70"
            } ${card.matched ? "opacity-60" : ""}`}
            style={{ minHeight: 36 }}
          >
            {(card.flipped || card.matched) ? card.emoji : "?"}
          </button>
        ))}
      </div>
      {allMatched && (
        <p className="text-center text-xs text-primary mt-2">You won in {moves} moves!</p>
      )}
    </div>
  )
}

// Reaction Test Game
function ReactionGame() {
  const [state, setState] = useState<"waiting" | "ready" | "go" | "result">("waiting")
  const [startTime, setStartTime] = useState(0)
  const [reactionTime, setReactionTime] = useState(0)
  const [bestTime, setBestTime] = useState<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const startGame = () => {
    setState("ready")
    const delay = Math.random() * 3000 + 1500
    timeoutRef.current = setTimeout(() => {
      setState("go")
      setStartTime(Date.now())
    }, delay)
  }

  const handleClick = () => {
    if (state === "waiting" || state === "result") {
      startGame()
    } else if (state === "ready") {
      clearTimeout(timeoutRef.current)
      setState("waiting")
    } else if (state === "go") {
      const time = Date.now() - startTime
      setReactionTime(time)
      if (!bestTime || time < bestTime) setBestTime(time)
      setState("result")
    }
  }

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current)
  }, [])

  const colors = {
    waiting: "bg-blue-500/20 hover:bg-blue-500/30",
    ready: "bg-red-500/30",
    go: "bg-green-500/40",
    result: "bg-primary/20 hover:bg-primary/30",
  }

  return (
    <button
      onClick={handleClick}
      className={`h-full w-full rounded-lg flex flex-col items-center justify-center transition-colors ${colors[state]}`}
    >
      {state === "waiting" && (
        <>
          <span className="text-lg font-semibold text-foreground">Click to Start</span>
          <span className="text-xs text-muted-foreground mt-1">Test your reflexes</span>
        </>
      )}
      {state === "ready" && (
        <>
          <span className="text-lg font-semibold text-red-400">Wait...</span>
          <span className="text-xs text-muted-foreground mt-1">Click when green!</span>
        </>
      )}
      {state === "go" && (
        <span className="text-2xl font-bold text-green-400">CLICK!</span>
      )}
      {state === "result" && (
        <>
          <span className="text-2xl font-bold text-primary">{reactionTime}ms</span>
          <span className="text-xs text-muted-foreground mt-1">
            Best: {bestTime}ms | Click to retry
          </span>
        </>
      )}
    </button>
  )
}

// Click Counter Game
function ClickerGame() {
  const [count, setCount] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([])

  const handleClick = (e: React.MouseEvent) => {
    setCount((c) => c + 1)
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 100)

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const newParticle = { id: Date.now(), x, y }
    setParticles((prev) => [...prev, newParticle])
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== newParticle.id))
    }, 500)
  }

  return (
    <div className="h-full flex flex-col items-center justify-center relative overflow-hidden">
      <button
        onClick={handleClick}
        className={`w-24 h-24 rounded-full bg-gradient-to-br from-primary/60 to-primary/30 border-2 border-primary/50 flex items-center justify-center transition-transform ${
          isAnimating ? "scale-95" : "scale-100 hover:scale-105"
        }`}
        style={{ boxShadow: "0 0 30px rgba(100,200,160,0.3)" }}
      >
        <span className="text-3xl font-bold text-foreground">{count}</span>
      </button>
      <p className="text-xs text-muted-foreground mt-3">Tap to count!</p>
      <button
        onClick={() => setCount(0)}
        className="text-xs text-primary hover:underline mt-1"
      >
        Reset
      </button>
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute text-lg pointer-events-none animate-ping"
          style={{ left: p.x, top: p.y }}
        >
          +1
        </span>
      ))}
    </div>
  )
}

export function MoodRefresh() {
  const [selectedGame, setSelectedGame] = useState<GameType>("bubbles")

  const renderGame = () => {
    switch (selectedGame) {
      case "bubbles":
        return <BubblePopGame />
      case "memory":
        return <MemoryGame />
      case "reaction":
        return <ReactionGame />
      case "clicker":
        return <ClickerGame />
    }
  }

  return (
    <div className="glass rounded-2xl p-5 h-full min-h-[340px] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="font-semibold flex items-center gap-2 text-foreground">
          <Gamepad2 className="w-4 h-4 text-muted-foreground" />
          Mood Refresh
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
              {GAMES.find((g) => g.id === selectedGame)?.name}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            {GAMES.map((game) => (
              <DropdownMenuItem
                key={game.id}
                onClick={() => setSelectedGame(game.id)}
                className={selectedGame === game.id ? "bg-primary/10" : ""}
              >
                {game.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="flex-1 rounded-xl bg-gradient-to-br from-teal-900/20 to-blue-900/20 p-3 overflow-hidden">
        {renderGame()}
      </div>
    </div>
  )
}
