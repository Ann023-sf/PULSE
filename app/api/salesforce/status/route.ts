import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SalesforceClient } from "@/lib/salesforce/client"

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("sf_access_token")?.value
  const instanceUrl = cookieStore.get("sf_instance_url")?.value

  if (!accessToken || !instanceUrl) {
    return NextResponse.json({ connected: false })
  }

  try {
    const client = new SalesforceClient(accessToken, instanceUrl)
    const user = await client.getCurrentUser()
    
    return NextResponse.json({
      connected: true,
      user: {
        name: user.Name,
        email: user.Email,
      },
    })
  } catch {
    return NextResponse.json({ connected: false })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  
  cookieStore.delete("sf_access_token")
  cookieStore.delete("sf_refresh_token")
  cookieStore.delete("sf_instance_url")

  return NextResponse.json({ disconnected: true })
}
