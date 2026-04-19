import { NextResponse } from "next/server"

export async function GET() {
  const clientId = process.env.SALESFORCE_CLIENT_ID
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET

  return NextResponse.json({
    configured: !!(clientId && clientSecret)
  })
}
