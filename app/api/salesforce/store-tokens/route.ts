import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { accessToken, refreshToken, instanceUrl } = await req.json()

    if (!accessToken || !refreshToken || !instanceUrl) {
      return NextResponse.json(
        { error: "Missing required tokens" },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()

    cookieStore.set("sf_access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 2, // 2 hours
      path: "/",
    })

    cookieStore.set("sf_refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    })

    cookieStore.set("sf_instance_url", instanceUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Store tokens error:", error)
    return NextResponse.json(
      { error: "Failed to store tokens" },
      { status: 500 }
    )
  }
}
