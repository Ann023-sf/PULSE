import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const { username, password, loginUrl } = await req.json()
    
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 })
    }
    
    // Salesforce SOAP login to get session info
    const soapUrl = `${loginUrl || "https://login.salesforce.com"}/services/Soap/u/59.0`
    
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Body>
    <urn:login>
      <urn:username>${username}</urn:username>
      <urn:password>${password}</urn:password>
    </urn:login>
  </soapenv:Body>
</soapenv:Envelope>`

    const response = await fetch(soapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "SOAPAction": "login"
      },
      body: soapBody
    })
    
    const responseText = await response.text()
    
    // Check for login error
    if (responseText.includes("INVALID_LOGIN") || responseText.includes("LOGIN_MUST_USE_SECURITY_TOKEN")) {
      return NextResponse.json({ 
        error: "Invalid credentials. Make sure to append your Security Token to your password." 
      }, { status: 401 })
    }
    
    if (responseText.includes("faultstring")) {
      const faultMatch = responseText.match(/<faultstring>([^<]+)<\/faultstring>/)
      return NextResponse.json({ 
        error: faultMatch ? faultMatch[1] : "Login failed" 
      }, { status: 401 })
    }
    
    // Extract session info from SOAP response
    const sessionIdMatch = responseText.match(/<sessionId>([^<]+)<\/sessionId>/)
    const serverUrlMatch = responseText.match(/<serverUrl>([^<]+)<\/serverUrl>/)
    const userIdMatch = responseText.match(/<userId>([^<]+)<\/userId>/)
    const userNameMatch = responseText.match(/<userFullName>([^<]+)<\/userFullName>/)
    const userEmailMatch = responseText.match(/<userEmail>([^<]+)<\/userEmail>/)
    
    if (!sessionIdMatch || !serverUrlMatch) {
      return NextResponse.json({ error: "Failed to extract session info" }, { status: 500 })
    }
    
    const sessionId = sessionIdMatch[1]
    const serverUrl = serverUrlMatch[1]
    
    // Extract instance URL from server URL
    const instanceUrlMatch = serverUrl.match(/(https:\/\/[^/]+)/)
    const instanceUrl = instanceUrlMatch ? instanceUrlMatch[1].replace("/services/Soap/u/59.0", "") : ""
    
    // Clean up instance URL - convert from SOAP URL to REST API URL
    const cleanInstanceUrl = instanceUrl.replace("Soap/u/59.0/", "").replace(/\/+$/, "")
    
    // Store session in cookies (HTTP-only for security)
    const cookieStore = await cookies()
    
    cookieStore.set("sf_access_token", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 2 // 2 hours (Salesforce session timeout)
    })
    
    cookieStore.set("sf_instance_url", cleanInstanceUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 2
    })
    
    if (userIdMatch) {
      cookieStore.set("sf_user_id", userIdMatch[1], {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 2
      })
    }
    
    return NextResponse.json({
      success: true,
      user: {
        name: userNameMatch ? userNameMatch[1] : username,
        email: userEmailMatch ? userEmailMatch[1] : username
      }
    })
    
  } catch (error) {
    console.error("Salesforce login error:", error)
    return NextResponse.json({ error: "Failed to connect to Salesforce" }, { status: 500 })
  }
}
