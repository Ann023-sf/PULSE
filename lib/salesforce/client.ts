import {
  SalesforceTokens,
  SalesforceTask,
  SalesforceCase,
  SalesforceOpportunity,
  SalesforceUser,
  PendingWork,
  UserScope,
} from "./types"
import { addDays, isBefore, differenceInDays, format } from "date-fns"

// Environment variables required:
// SALESFORCE_CLIENT_ID - Connected App Consumer Key
// SALESFORCE_CLIENT_SECRET - Connected App Consumer Secret
// SALESFORCE_REDIRECT_URI - OAuth callback URL (e.g., https://your-app.vercel.app/api/salesforce/callback)

const SF_LOGIN_URL = process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com"
const SF_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID
const SF_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET
const SF_REDIRECT_URI = process.env.SALESFORCE_REDIRECT_URI

export function getAuthorizationUrl(): string {
  if (!SF_CLIENT_ID || !SF_REDIRECT_URI) {
    throw new Error("Salesforce client ID or redirect URI not configured")
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SF_CLIENT_ID,
    redirect_uri: SF_REDIRECT_URI,
    scope: "api refresh_token",
  })

  return `${SF_LOGIN_URL}/services/oauth2/authorize?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<SalesforceTokens> {
  if (!SF_CLIENT_ID || !SF_CLIENT_SECRET || !SF_REDIRECT_URI) {
    throw new Error("Salesforce credentials not configured")
  }

  const response = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
      redirect_uri: SF_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code: ${error}`)
  }

  return response.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<SalesforceTokens> {
  if (!SF_CLIENT_ID || !SF_CLIENT_SECRET) {
    throw new Error("Salesforce credentials not configured")
  }

  const response = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh token: ${error}`)
  }

  return response.json()
}

export class SalesforceClient {
  private accessToken: string
  private instanceUrl: string

  constructor(accessToken: string, instanceUrl: string) {
    this.accessToken = accessToken
    this.instanceUrl = instanceUrl
  }

  private async query<T>(soql: string): Promise<T[]> {
    const url = `${this.instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Salesforce query failed: ${error}`)
    }

    const data = await response.json()
    return data.records as T[]
  }

  async getCurrentUser(): Promise<SalesforceUser> {
    // Try REST API first to get user info
    try {
      const url = `${this.instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent("SELECT Id, Name, Email FROM User WHERE Id = UserInfo.getUserId() LIMIT 1")}`
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.records && data.records.length > 0) {
          return data.records[0] as SalesforceUser
        }
      }
      
      // Fallback - try OAuth userinfo endpoint
      const userinfoUrl = `${this.instanceUrl}/services/oauth2/userinfo`
      const userinfoResponse = await fetch(userinfoUrl, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      if (userinfoResponse.ok) {
        const data = await userinfoResponse.json()
        return {
          Id: data.user_id,
          Name: data.name,
          Email: data.email,
        }
      }
      
      throw new Error("Failed to get current user")
    } catch (error) {
      console.error("getCurrentUser error:", error)
      throw new Error("Failed to get current user")
    }
  }

  async getTeamUserIds(managerId: string): Promise<string[]> {
    // Get direct reports of the manager
    const users = await this.query<{ Id: string }>(
      `SELECT Id FROM User WHERE ManagerId = '${managerId}' AND IsActive = true`
    )
    return [managerId, ...users.map(u => u.Id)]
  }

  async getPendingWork(
    scope: UserScope,
    focusDate: Date,
    staleDays: number = 7
  ): Promise<PendingWork> {
    const user = await this.getCurrentUser()
    
    let ownerFilter: string
    if (scope === "my_team") {
      const teamIds = await this.getTeamUserIds(user.Id)
      ownerFilter = `OwnerId IN ('${teamIds.join("','")}')`
    } else {
      ownerFilter = `OwnerId = '${user.Id}'`
    }

    const today = focusDate
    const threeDaysFromNow = addDays(today, 3)
    const sevenDaysFromNow = addDays(today, 7)
    const staleDate = addDays(today, -staleDays)

    // Fetch Tasks
    const tasks = await this.query<SalesforceTask>(
      `SELECT Id, Subject, Status, Priority, ActivityDate, OwnerId, Owner.Name, WhatId, What.Name, IsClosed 
       FROM Task 
       WHERE ${ownerFilter} AND IsClosed = false 
       ORDER BY ActivityDate ASC NULLS LAST 
       LIMIT 100`
    )

    const overdueTasks = tasks.filter(t => 
      t.ActivityDate && isBefore(new Date(t.ActivityDate), today)
    )
    const urgentTasks = tasks.filter(t => {
      if (!t.ActivityDate) return false
      const dueDate = new Date(t.ActivityDate)
      return !isBefore(dueDate, today) && isBefore(dueDate, threeDaysFromNow)
    })

    // Fetch Cases
    const cases = await this.query<SalesforceCase>(
      `SELECT Id, CaseNumber, Subject, Status, Priority, OwnerId, Owner.Name, LastModifiedDate, CreatedDate, IsClosed, AccountId, Account.Name 
       FROM Case 
       WHERE ${ownerFilter} AND IsClosed = false 
       ORDER BY Priority DESC, LastModifiedDate ASC 
       LIMIT 100`
    )

    const staleCases = cases.filter(c => 
      isBefore(new Date(c.LastModifiedDate), staleDate)
    )

    // Fetch Opportunities
    const opportunities = await this.query<SalesforceOpportunity>(
      `SELECT Id, Name, StageName, Amount, CloseDate, OwnerId, Owner.Name, AccountId, Account.Name, IsClosed, IsWon, Probability 
       FROM Opportunity 
       WHERE ${ownerFilter} AND IsClosed = false 
       ORDER BY CloseDate ASC 
       LIMIT 100`
    )

    const pastDueOpps = opportunities.filter(o => 
      isBefore(new Date(o.CloseDate), today)
    )
    const closingSoonOpps = opportunities.filter(o => {
      const closeDate = new Date(o.CloseDate)
      return !isBefore(closeDate, today) && isBefore(closeDate, sevenDaysFromNow)
    })

    // Generate summary
    const summary = this.generateSummary({
      overdueTasks: overdueTasks.length,
      urgentTasks: urgentTasks.length,
      totalTasks: tasks.length,
      openCases: cases.length,
      staleCases: staleCases.length,
      pastDueOpps: pastDueOpps.length,
      closingSoonOpps: closingSoonOpps.length,
      totalOpps: opportunities.length,
      scope,
      focusDate: format(focusDate, "MMM d, yyyy"),
    })

    return {
      tasks: {
        overdue: overdueTasks,
        urgentNext3Days: urgentTasks,
        total: tasks.length,
      },
      cases: {
        open: cases,
        stale: staleCases,
        total: cases.length,
      },
      opportunities: {
        closingSoon: closingSoonOpps,
        pastDue: pastDueOpps,
        total: opportunities.length,
      },
      summary,
    }
  }

  private generateSummary(data: {
    overdueTasks: number
    urgentTasks: number
    totalTasks: number
    openCases: number
    staleCases: number
    pastDueOpps: number
    closingSoonOpps: number
    totalOpps: number
    scope: UserScope
    focusDate: string
  }): string {
    const scopeLabel = data.scope === "my_team" ? "Your team" : "You"
    let summary = `**Salesforce Summary for ${data.focusDate}:**\n\n`

    // Tasks
    if (data.totalTasks > 0) {
      summary += `**Tasks:** ${scopeLabel} have ${data.totalTasks} open task(s). `
      if (data.overdueTasks > 0) {
        summary += `${data.overdueTasks} are OVERDUE. `
      }
      if (data.urgentTasks > 0) {
        summary += `${data.urgentTasks} due in the next 3 days.`
      }
      summary += "\n\n"
    } else {
      summary += "**Tasks:** No open tasks.\n\n"
    }

    // Cases
    if (data.openCases > 0) {
      summary += `**Cases:** ${data.openCases} open case(s). `
      if (data.staleCases > 0) {
        summary += `${data.staleCases} have not been updated in 7+ days and need attention.`
      }
      summary += "\n\n"
    } else {
      summary += "**Cases:** No open cases.\n\n"
    }

    // Opportunities
    if (data.totalOpps > 0) {
      summary += `**Opportunities:** ${data.totalOpps} open opportunity(-ies). `
      if (data.pastDueOpps > 0) {
        summary += `${data.pastDueOpps} have PAST close dates. `
      }
      if (data.closingSoonOpps > 0) {
        summary += `${data.closingSoonOpps} closing within 7 days.`
      }
      summary += "\n"
    } else {
      summary += "**Opportunities:** No open opportunities.\n"
    }

    return summary
  }
}
