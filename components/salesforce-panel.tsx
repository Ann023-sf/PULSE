"use client"

import { useState, useEffect } from "react"
import { Cloud, RefreshCw, User, AlertCircle, CheckCircle, Clock, DollarSign, Briefcase, LogOut, Play, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PendingWork, UserScope } from "@/lib/salesforce/types"

// Realistic mock data for demo
const MOCK_PENDING_WORK: PendingWork = {
  tasks: {
    overdue: [
      { Id: "00T1", Subject: "Follow up with Acme Corp on contract renewal", ActivityDate: "2026-04-15", Status: "In Progress", Priority: "High", OwnerId: "005x", OwnerName: "You" },
      { Id: "00T2", Subject: "Prepare Q2 sales forecast presentation", ActivityDate: "2026-04-16", Status: "Not Started", Priority: "High", OwnerId: "005x", OwnerName: "You" },
    ],
    urgentNext3Days: [
      { Id: "00T3", Subject: "Call TechStart Inc - demo follow up", ActivityDate: "2026-04-19", Status: "Not Started", Priority: "Normal", OwnerId: "005x", OwnerName: "You" },
      { Id: "00T4", Subject: "Send proposal to GlobalTech Solutions", ActivityDate: "2026-04-20", Status: "In Progress", Priority: "High", OwnerId: "005x", OwnerName: "You" },
      { Id: "00T5", Subject: "Review partner agreement draft", ActivityDate: "2026-04-21", Status: "Not Started", Priority: "Normal", OwnerId: "005x", OwnerName: "You" },
    ],
    total: 12
  },
  cases: {
    open: [
      { Id: "500A", CaseNumber: "00001027", Subject: "Laptop breakdown issue", Status: "In Progress", Priority: "High", LastModifiedDate: "2026-04-17", OwnerId: "005x", OwnerName: "You" },
      { Id: "500B", CaseNumber: "00001028", Subject: "Software license renewal query", Status: "New", Priority: "Medium", LastModifiedDate: "2026-04-10", OwnerId: "005x", OwnerName: "You" },
      { Id: "500C", CaseNumber: "00001029", Subject: "Network connectivity issues", Status: "Escalated", Priority: "High", LastModifiedDate: "2026-04-18", OwnerId: "005x", OwnerName: "You" },
    ],
    stale: [
      { Id: "500B", CaseNumber: "00001028", Subject: "Software license renewal query", Status: "New", Priority: "Medium", LastModifiedDate: "2026-04-10", OwnerId: "005x", OwnerName: "You", daysSinceUpdate: 8 },
    ],
    total: 5
  },
  opportunities: {
    open: [
      { Id: "006A", Name: "Acme Corp - Enterprise License", StageName: "Negotiation", CloseDate: "2026-04-25", Amount: 150000, OwnerId: "005x", OwnerName: "You" },
      { Id: "006B", Name: "TechStart Inc - Platform Upgrade", StageName: "Proposal", CloseDate: "2026-04-30", Amount: 85000, OwnerId: "005x", OwnerName: "You" },
      { Id: "006C", Name: "GlobalTech - Annual Contract", StageName: "Qualification", CloseDate: "2026-05-15", Amount: 220000, OwnerId: "005x", OwnerName: "You" },
    ],
    closingSoon: [
      { Id: "006A", Name: "Acme Corp - Enterprise License", StageName: "Negotiation", CloseDate: "2026-04-25", Amount: 150000, OwnerId: "005x", OwnerName: "You" },
    ],
    pastDue: [
      { Id: "006D", Name: "Beta Systems - Renewal", StageName: "Negotiation", CloseDate: "2026-04-12", Amount: 45000, OwnerId: "005x", OwnerName: "You" },
    ],
    total: 8
  },
  aiSummary: "You have 2 overdue tasks requiring immediate attention, 1 stale case with no updates in 8 days, and 1 opportunity past its close date. The Acme Corp deal ($150K) is closing in 6 days - prioritize the contract follow-up task."
}

const MOCK_TEAM_WORK: PendingWork = {
  tasks: {
    overdue: [
      { Id: "00T1", Subject: "Follow up with Acme Corp", ActivityDate: "2026-04-15", Status: "In Progress", Priority: "High", OwnerId: "005x", OwnerName: "You" },
      { Id: "00T6", Subject: "Complete security audit report", ActivityDate: "2026-04-14", Status: "Not Started", Priority: "High", OwnerId: "005y", OwnerName: "Ria Khanna" },
      { Id: "00T7", Subject: "Update CRM data for Q1", ActivityDate: "2026-04-16", Status: "In Progress", Priority: "Normal", OwnerId: "005z", OwnerName: "Vasavi Kalyani" },
    ],
    urgentNext3Days: [
      { Id: "00T3", Subject: "Call TechStart Inc - demo follow up", ActivityDate: "2026-04-19", Status: "Not Started", Priority: "Normal", OwnerId: "005x", OwnerName: "You" },
      { Id: "00T8", Subject: "Finalize budget proposal", ActivityDate: "2026-04-20", Status: "In Progress", Priority: "High", OwnerId: "005y", OwnerName: "Ria Khanna" },
    ],
    total: 28
  },
  cases: {
    open: [
      { Id: "500A", CaseNumber: "00001027", Subject: "Laptop breakdown issue", Status: "In Progress", Priority: "High", LastModifiedDate: "2026-04-17", OwnerId: "005x", OwnerName: "You" },
      { Id: "500D", CaseNumber: "00001030", Subject: "Account access request", Status: "New", Priority: "Medium", LastModifiedDate: "2026-04-08", OwnerId: "005y", OwnerName: "Ria Khanna" },
    ],
    stale: [
      { Id: "500D", CaseNumber: "00001030", Subject: "Account access request", Status: "New", Priority: "Medium", LastModifiedDate: "2026-04-08", OwnerId: "005y", OwnerName: "Ria Khanna", daysSinceUpdate: 10 },
    ],
    total: 12
  },
  opportunities: {
    open: [
      { Id: "006A", Name: "Acme Corp - Enterprise License", StageName: "Negotiation", CloseDate: "2026-04-25", Amount: 150000, OwnerId: "005x", OwnerName: "You" },
      { Id: "006E", Name: "MegaCorp - New Implementation", StageName: "Discovery", CloseDate: "2026-05-30", Amount: 380000, OwnerId: "005y", OwnerName: "Ria Khanna" },
    ],
    closingSoon: [
      { Id: "006A", Name: "Acme Corp - Enterprise License", StageName: "Negotiation", CloseDate: "2026-04-25", Amount: 150000, OwnerId: "005x", OwnerName: "You" },
    ],
    pastDue: [
      { Id: "006D", Name: "Beta Systems - Renewal", StageName: "Negotiation", CloseDate: "2026-04-12", Amount: 45000, OwnerId: "005x", OwnerName: "You" },
      { Id: "006F", Name: "StartupXYZ - Pilot", StageName: "Proposal", CloseDate: "2026-04-10", Amount: 25000, OwnerId: "005z", OwnerName: "Vasavi Kalyani" },
    ],
    total: 15
  },
  aiSummary: "Team has 3 overdue tasks and 2 opportunities past their close dates. Ria's MegaCorp deal ($380K) is the largest in pipeline. The stale case (Account access request) hasn't been updated in 10 days - needs immediate attention."
}

export function SalesforcePanel() {
  const [mode, setMode] = useState<"disconnected" | "demo" | "connected">("disconnected")
  const [pendingWork, setPendingWork] = useState<PendingWork | null>(null)
  const [loading, setLoading] = useState(false)
  const [scope, setScope] = useState<UserScope>("me")
  const [userName, setUserName] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)

  // Check configuration and connection status on mount
  useEffect(() => {
    checkConfig()
    checkConnectionStatus()
    
    // Check for OAuth callback results
    const params = new URLSearchParams(window.location.search)
    if (params.get("sf_connected") === "true") {
      checkConnectionStatus()
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname)
    }
    if (params.get("sf_error")) {
      setError(params.get("sf_error"))
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const checkConfig = async () => {
    try {
      const response = await fetch("/api/salesforce/config")
      if (response.ok) {
        const data = await response.json()
        setIsConfigured(data.configured)
      }
    } catch {
      // Config check failed
    }
  }

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch("/api/salesforce/status")
      if (response.ok) {
        const data = await response.json()
        if (data.connected) {
          setMode("connected")
          setUserName(data.userName || "Salesforce User")
          fetchPendingWork()
        }
      }
    } catch {
      // Not connected
    }
  }

  const connectSalesforce = () => {
    if (!isConfigured) {
      setError("Salesforce not configured. Please add SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET environment variables.")
      return
    }
    // Redirect to server-side auth route
    window.location.href = "/api/salesforce/auth"
  }

  const fetchPendingWork = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/salesforce/pending-work?scope=${scope}`)
      if (response.ok) {
        const data = await response.json()
        setPendingWork(data)
      } else {
        throw new Error("Failed to fetch data")
      }
    } catch {
      setError("Failed to load Salesforce data")
    } finally {
      setLoading(false)
    }
  }

  const startDemo = () => {
    setMode("demo")
    setUserName("Pinnam Tejasri Durga Bhavani")
    setLoading(true)
    setTimeout(() => {
      setPendingWork(MOCK_PENDING_WORK)
      setLoading(false)
    }, 1000)
  }

  const handleScopeChange = (newScope: UserScope) => {
    setScope(newScope)
    setLoading(true)
    
    if (mode === "demo") {
      setTimeout(() => {
        setPendingWork(newScope === "me" ? MOCK_PENDING_WORK : MOCK_TEAM_WORK)
        setLoading(false)
      }, 500)
    } else {
      fetchPendingWork()
    }
  }

  const handleRefresh = () => {
    if (mode === "demo") {
      setLoading(true)
      setTimeout(() => {
        setPendingWork(scope === "me" ? MOCK_PENDING_WORK : MOCK_TEAM_WORK)
        setLoading(false)
      }, 800)
    } else {
      fetchPendingWork()
    }
  }

  const disconnect = async () => {
    if (mode === "connected") {
      await fetch("/api/salesforce/logout", { method: "POST" })
    }
    setMode("disconnected")
    setPendingWork(null)
    setUserName("")
  }

  return (
    <div className="glass rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-foreground">Salesforce</span>
        </div>
        <div className="flex items-center gap-2">
          {mode === "demo" && (
            <>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Demo Mode
              </Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={disconnect}>
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          )}
          {mode === "connected" && (
            <>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Connected
              </Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={disconnect}>
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          )}
          {mode === "disconnected" && (
            <Badge variant="outline" className="text-muted-foreground">Not Connected</Badge>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-sm text-destructive">{error}</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={() => setError(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Disconnected State */}
      {mode === "disconnected" && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Connect to Salesforce to see your pending Tasks, Cases, and Opportunities.
          </p>
          
          <div className="space-y-2">
            <Button onClick={connectSalesforce} size="sm" className="w-full">
              <Cloud className="w-4 h-4 mr-2" />
              Connect Salesforce
            </Button>
            
            <Button onClick={startDemo} variant="outline" size="sm" className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Start Demo Mode
            </Button>
          </div>
          
          {!isConfigured && (
            <p className="text-xs text-yellow-400 mt-3 text-center">
              Environment variables not configured. Use Demo Mode or add SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET.
            </p>
          )}
        </>
      )}

      {/* Connected/Demo State */}
      {(mode === "demo" || mode === "connected") && (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <User className="w-3 h-3" />
            <span>{userName}</span>
          </div>

          {/* Scope Toggle */}
          <div className="flex gap-2 mb-3">
            <Button
              variant={scope === "me" ? "default" : "outline"}
              size="sm"
              onClick={() => handleScopeChange("me")}
              className="flex-1"
            >
              My Work
            </Button>
            <Button
              variant={scope === "my_team" ? "default" : "outline"}
              size="sm"
              onClick={() => handleScopeChange("my_team")}
              className="flex-1"
            >
              My Team
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading Salesforce data...</span>
            </div>
          ) : pendingWork ? (
            <div className="space-y-3">
              {/* Tasks Summary */}
              <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-400" />
                  <span className="text-sm">Tasks</span>
                </div>
                <div className="flex gap-2">
                  {pendingWork.tasks.overdue.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {pendingWork.tasks.overdue.length} overdue
                    </Badge>
                  )}
                  {pendingWork.tasks.urgentNext3Days.length > 0 && (
                    <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/30">
                      {pendingWork.tasks.urgentNext3Days.length} urgent
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {pendingWork.tasks.total} total
                  </Badge>
                </div>
              </div>

              {/* Cases Summary */}
              <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-sm">Cases</span>
                </div>
                <div className="flex gap-2">
                  {pendingWork.cases.stale.length > 0 && (
                    <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/30">
                      {pendingWork.cases.stale.length} stale
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {pendingWork.cases.total} open
                  </Badge>
                </div>
              </div>

              {/* Opportunities Summary */}
              <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm">Opportunities</span>
                </div>
                <div className="flex gap-2">
                  {pendingWork.opportunities.pastDue.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {pendingWork.opportunities.pastDue.length} past due
                    </Badge>
                  )}
                  {pendingWork.opportunities.closingSoon.length > 0 && (
                    <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/30">
                      {pendingWork.opportunities.closingSoon.length} closing soon
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {pendingWork.opportunities.total} open
                  </Badge>
                </div>
              </div>

              {/* AI Summary */}
              {pendingWork.aiSummary && (
                <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm text-foreground">{pendingWork.aiSummary}</p>
                </div>
              )}

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="w-full mt-2"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh Data
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
