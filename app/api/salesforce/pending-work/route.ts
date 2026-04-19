import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SalesforceClient, refreshAccessToken } from "@/lib/salesforce/client"
import { UserScope } from "@/lib/salesforce/types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scope = (searchParams.get("scope") as UserScope) || "me"
  const focusDateStr = searchParams.get("focusDate")
  const staleDays = parseInt(searchParams.get("staleDays") || "7", 10)

  const focusDate = focusDateStr ? new Date(focusDateStr) : new Date()

  const cookieStore = await cookies()
  let accessToken = cookieStore.get("sf_access_token")?.value
  const refreshToken = cookieStore.get("sf_refresh_token")?.value
  const instanceUrl = cookieStore.get("sf_instance_url")?.value

  if (!accessToken || !instanceUrl) {
    if (refreshToken) {
      try {
        const tokens = await refreshAccessToken(refreshToken)
        accessToken = tokens.access_token
        
        // Update cookies with new access token
        cookieStore.set("sf_access_token", tokens.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 2,
          path: "/",
        })
      } catch {
        return NextResponse.json(
          { error: "Session expired. Please reconnect to Salesforce.", needsAuth: true },
          { status: 401 }
        )
      }
    } else {
      return NextResponse.json(
        { error: "Not connected to Salesforce", needsAuth: true },
        { status: 401 }
      )
    }
  }

  try {
    const client = new SalesforceClient(accessToken, instanceUrl!)
    const pendingWork = await client.getPendingWork(scope, focusDate, staleDays)

    return NextResponse.json(pendingWork)
  } catch (err) {
    console.error("Salesforce API error:", err)
    return NextResponse.json(
      { error: "Failed to fetch Salesforce data", details: String(err) },
      { status: 500 }
    )
  }
}
