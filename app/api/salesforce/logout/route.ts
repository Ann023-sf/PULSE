import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  try {
    const cookieStore = await cookies()
    
    // Clear all Salesforce cookies
    cookieStore.delete("sf_access_token")
    cookieStore.delete("sf_instance_url")
    cookieStore.delete("sf_user_id")
    cookieStore.delete("sf_refresh_token")
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 })
  }
}
