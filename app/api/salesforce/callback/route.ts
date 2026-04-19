import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (error) {
    console.error("Salesforce OAuth error:", error, errorDescription)
    return NextResponse.redirect(
      new URL(`/?sf_error=${encodeURIComponent(errorDescription || error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?sf_error=No authorization code received", request.url)
    )
  }

  // Get credentials from environment variables
  const clientId = process.env.SALESFORCE_CLIENT_ID
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET
  const redirectUri = `${origin}/api/salesforce/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/?sf_error=Salesforce credentials not configured", request.url)
    )
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://login.salesforce.com/services/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      })
    })

    const tokens = await tokenRes.json()

    if (tokens.error) {
      console.error("Token exchange error:", tokens)
      return NextResponse.redirect(
        new URL(`/?sf_error=${encodeURIComponent(tokens.error_description || tokens.error)}`, request.url)
      )
    }

    // Store tokens in HTTP-only cookies
    const cookieStore = await cookies()
    
    cookieStore.set("sf_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 2 // 2 hours
    })

    if (tokens.refresh_token) {
      cookieStore.set("sf_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30 // 30 days
      })
    }

    cookieStore.set("sf_instance_url", tokens.instance_url, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    // Redirect back to app
    return NextResponse.redirect(new URL("/?sf_connected=true", request.url))

  } catch (err) {
    console.error("Salesforce callback error:", err)
    return NextResponse.redirect(
      new URL(`/?sf_error=${encodeURIComponent("Failed to complete authentication")}`, request.url)
    )
  }
}
