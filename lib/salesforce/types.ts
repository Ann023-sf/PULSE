// Salesforce API Response Types

export interface SalesforceTask {
  Id: string
  Subject: string
  Status: string
  Priority: string
  ActivityDate: string | null
  OwnerId: string
  Owner?: { Name: string }
  WhatId?: string
  What?: { Name: string }
  IsClosed: boolean
}

export interface SalesforceCase {
  Id: string
  CaseNumber: string
  Subject: string
  Status: string
  Priority: string
  OwnerId: string
  Owner?: { Name: string }
  LastModifiedDate: string
  CreatedDate: string
  IsClosed: boolean
  AccountId?: string
  Account?: { Name: string }
}

export interface SalesforceOpportunity {
  Id: string
  Name: string
  StageName: string
  Amount: number | null
  CloseDate: string
  OwnerId: string
  Owner?: { Name: string }
  AccountId?: string
  Account?: { Name: string }
  IsClosed: boolean
  IsWon: boolean
  Probability: number
}

export interface SalesforceUser {
  Id: string
  Name: string
  Email: string
}

export interface SalesforceTokens {
  access_token: string
  refresh_token: string
  instance_url: string
  id: string
  token_type: string
  issued_at: string
}

export interface PendingWork {
  tasks: {
    overdue: SalesforceTask[]
    urgentNext3Days: SalesforceTask[]
    total: number
  }
  cases: {
    open: SalesforceCase[]
    stale: SalesforceCase[] // No update in X days
    total: number
  }
  opportunities: {
    closingSoon: SalesforceOpportunity[] // Within 7 days
    pastDue: SalesforceOpportunity[] // CloseDate passed but not closed
    total: number
  }
  summary: string
}

export type UserScope = "me" | "my_team"
