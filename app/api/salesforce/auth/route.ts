import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const clientId = process.env.SALESFORCE_CLIENT_ID
  
  if (!clientId) {
    return NextResponse.json(
      { error: "Salesforce not configured" },
      { status: 500 }
    )
  }

  const { origin } = new URL(request.url)
  const redirectUri = `${origin}/api/salesforce/callback`

  // Build OAuth URL
  const authUrl = new URL("https://login.salesforce.com/services/oauth2/authorize")
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("scope", "full refresh_token")

  return NextResponse.redirect(authUrl.toString())
}
