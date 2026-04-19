"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Send, AlertTriangle, MapPin, Play, MessageSquare, Bot, User, Loader2, Settings, X, Key } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const QUICK_PROMPTS = [
  { label: "What could blow up?", icon: AlertTriangle, prompt: "What are the biggest risks or issues that could blow up across all projects right now?" },
  { label: "Where are we?", icon: MapPin, prompt: "Give me a quick status summary of all projects." },
  { label: "Next two weeks", icon: Play, prompt: "What are the key deadlines and meetings in the next two weeks?" },
  { label: "Clear Chat", icon: MessageSquare, prompt: "" },
]

export function ChatAssistant() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load API key from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("pulse_groq_api_key")
    if (stored) {
      setSavedApiKey(stored)
      setApiKey(stored)
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem("pulse_groq_api_key", apiKey.trim())
      setSavedApiKey(apiKey.trim())
      setShowSettings(false)
      setError(null)
    }
  }

  const clearApiKey = () => {
    localStorage.removeItem("pulse_groq_api_key")
    setSavedApiKey(null)
    setApiKey("")
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    
    setError(null)
    setIsLoading(true)
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text
    }
    
    setMessages(prev => [...prev, userMessage])
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
          apiKey: savedApiKey // Send API key with request
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Request failed" }))
        throw new Error(errorData.error || "Request failed")
      }
      
      // Read the plain text stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ""
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          fullContent += chunk
        }
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: fullContent || "I couldn't generate a response. Please try again."
      }
      
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput("")
  }

  const handleQuickPrompt = (prompt: string) => {
    if (!prompt) {
      setMessages([])
      setError(null)
      return
    }
    sendMessage(prompt)
  }

  return (
    <div className="glass rounded-2xl p-5">
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-[#0a1a1f] border border-white/20 rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                AI API Settings
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Enter your Groq API key to enable real AI responses. Get a free key at{" "}
              <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                console.groq.com/keys
              </a>
            </p>
            
            <div className="space-y-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_xxxxxxxxxxxxx"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              
              <div className="flex gap-2">
                <Button onClick={saveApiKey} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                  Save Key
                </Button>
                {savedApiKey && (
                  <Button variant="outline" onClick={clearApiKey} className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                    Clear
                  </Button>
                )}
              </div>
              
              {savedApiKey && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  API key saved (stored in your browser)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2 text-foreground">
          <span className="text-primary">{"✨"}</span>
          AI Assistant
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(true)}
            className={cn(
              "h-7 w-7 p-0",
              savedApiKey ? "text-green-400" : "text-muted-foreground"
            )}
            title={savedApiKey ? "API key configured" : "Configure API key"}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full",
                  i <= messages.length ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Greeting line */}
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <span className="text-foreground">
          Hi there! How can I help you today?
        </span>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_PROMPTS.map((qp) => (
          <Button
            key={qp.label}
            variant="outline"
            size="sm"
            onClick={() => handleQuickPrompt(qp.prompt)}
            disabled={isLoading && qp.prompt !== ""}
            className="text-xs bg-white/5 border-white/20 hover:bg-white/10 gap-1.5"
          >
            <qp.icon className="w-3 h-3" />
            {qp.label}
          </Button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      {messages.length > 0 && (
        <div className="h-[200px] overflow-y-auto mb-4 space-y-3 pr-2 scrollbar-thin">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/10 text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
              </div>
              {message.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary animate-pulse" />
              </div>
              <div className="bg-white/10 rounded-xl px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          className="flex-1 bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          disabled={isLoading}
        />
        <Button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
        </Button>
      </form>
    </div>
  )
}
