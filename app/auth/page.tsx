"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import { db } from "@/lib/firestore"
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type User,
  type ApplicationVerifier,
} from "firebase/auth"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import toast from "react-hot-toast"

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier
  }
}

export default function AuthPage() {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [user, setUser] = useState<User | null>(null)
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [,setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // Init reCAPTCHA on client
    if (typeof window !== "undefined" && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth,
        "recaptcha-container",
        {
          size: "invisible", // or "normal" for visible box
          callback: (response: unknown) => {
            console.log("✅ reCAPTCHA solved:", response)
          },
/**
          * Logs a warning message to the console indicating that reCAPTCHA has expired.
          * @example
          * logReCaptchaExpired()
          * // ⚠️ reCAPTCHA expired. Resetting...
          * @returns {void} No return value.
          * @description
          *   - This function is useful for debugging purposes, informing developers of reCAPTCHA expirations.
          */
          expiredCallback: () => {
            console.warn("⚠️ reCAPTCHA expired. Resetting...")
          },
        },
        
      )

      window.recaptchaVerifier
        .render()
        .then((widgetId) => {
          console.log("reCAPTCHA widget ID:", widgetId)
        })
        .catch((err) => {
          console.error("reCAPTCHA render error:", err)
        })
    }
  }, [])

  const handleSendCode = async () => {
    if (!phone.trim()) {
      setError("Please enter your phone number")
      return
    }

    setError("")
    setLoading(true)

    try {
      const appVerifier = window.recaptchaVerifier as ApplicationVerifier
      const result = await signInWithPhoneNumber(auth, phone, appVerifier)
      setConfirmResult(result)
      toast.success("Verification code sent!")
      console.log("✅ Code sent to:", phone)
    } catch (err) {
      console.error("❌ Error sending code:", err)
      toast.error("Failed to send verification code. Check domain/reCAPTCHA setup.")
      setError("Failed to send verification code.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError("Please enter the verification code")
      return
    }

    setError("")
    setLoading(true)

    try {
      const result = await confirmResult?.confirm(code)
      if (result?.user) {
        setUser(result.user)

        const userRef = doc(db, "users", result.user.uid)
        const snapshot = await getDoc(userRef)

        if (!snapshot.exists()) {
          await setDoc(userRef, {
            uid: result.user.uid,
            phoneNumber: result.user.phoneNumber,
            name: name || "Anonymous",
            createdAt: serverTimestamp(),
          })
          toast.success("🎉 New user created")
        } else {
          toast.success("✅ Welcome back!")
        }

        router.push("/chat")
      }
    } catch (err) {
      console.error("❌ Invalid verification code:", err)
      setError("Invalid code. Please try again.")
      toast.error("Verification failed. Check the code.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-6">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-lg">
        <h1 className="text-center text-2xl font-bold mb-4 text-green-400">📱 Register to chat</h1>
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {!user ? (
          !confirmResult ? (
            <>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
                className="w-full bg-gray-700 p-3 rounded-lg mb-4 text-white border border-gray-600"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-gray-700 p-3 rounded-lg mb-6 text-white border border-gray-600"
              />
              <button
                onClick={handleSendCode}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter verification code"
                className="w-full bg-gray-700 p-3 rounded-lg mb-6 text-white border border-gray-600"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmResult(null)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={handleVerifyCode}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg"
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </button>
              </div>
            </>
          )
        ) : (
          <div className="text-center">
            <p className="text-green-400 text-xl mb-2">Authentication Successful</p>
            <p className="text-sm text-gray-300 mb-4">Signed in as {user.phoneNumber}</p>
            <p className="text-sm text-gray-400">Redirecting to chat...</p>
          </div>
        )}
      </div>

      {/* reCAPTCHA */}
      <div id="recaptcha-container" className="mt-6" />
    </div>
  )
}
