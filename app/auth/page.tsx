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
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore"

// Extend window to store reCAPTCHA instance
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier
  }
}

export default function AuthPage() {
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    // Initialize recaptcha once on client
    if (typeof window !== "undefined" && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: (response: string) => {
          console.log("✅ reCAPTCHA solved:", response)
        },
        'expired-callback': () => {
          console.warn("⚠️ reCAPTCHA expired. Please try again.")
        },
      })
    }
  }, [])

  const handleSendCode = async () => {
    if (!phone.trim()) {
      setError("Please enter a valid phone number")
      return
    }

    setError("")
    setLoading(true)

    try {
      const appVerifier = window.recaptchaVerifier as ApplicationVerifier
      const result = await signInWithPhoneNumber(auth, phone, appVerifier)
      setConfirmResult(result)
      console.log("✅ Verification code sent")
    } catch (err) {
      console.error("❌ Error sending code:", err)
      setError("Failed to send verification code. Ensure you're on HTTPS and your domain is whitelisted.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError("Please enter the verification code")
      return
    }

    setLoading(true)
    setError("")

    try {
      const result = await confirmResult?.confirm(code)
      if (!result) throw new Error("Invalid confirmation result")

      const signedUser = result.user
      setUser(signedUser)
      console.log("✅ User signed in:", signedUser)

      const userRef = doc(db, "users", signedUser.uid)
      const snapshot = await getDoc(userRef)

      if (!snapshot.exists()) {
        await setDoc(userRef, {
          uid: signedUser.uid,
          phoneNumber: signedUser.phoneNumber,
          name: name || "Anonymous",
          createdAt: serverTimestamp(),
        })
        console.log("📦 User added to Firestore")
      } else {
        console.log("ℹ️ User already exists")
      }

      router.push("/chat")
    } catch (err) {
      console.error("❌ Verification failed:", err)
      setError("Invalid verification code. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white px-4 py-10">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-green-400">📱 Register to Chat</h1>
          <p className="text-sm sm:text-base text-gray-400">Secure sign-in with phone number</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {!user ? (
          !confirmResult ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-300">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-3 mt-1 border border-gray-600 bg-gray-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-400 mt-1">Include country code (e.g., +1)</p>
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                  Your Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 mt-1 border border-gray-600 bg-gray-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <button
                onClick={handleSendCode}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-300">
                  Verification Code
                </label>
                <input
                  id="code"
                  type="text"
                  placeholder="Enter verification code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full p-3 mt-1 border border-gray-600 bg-gray-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setConfirmResult(null)}
                  className="sm:flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition"
                >
                  Back
                </button>
                <button
                  onClick={handleVerifyCode}
                  disabled={loading}
                  className="sm:flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/30 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-green-400 mb-2">Authentication Successful</h2>
            <p className="text-gray-300">Signed in as {user.phoneNumber}</p>
            <p className="text-sm text-gray-400 mt-4">Redirecting to chat...</p>
          </div>
        )}
      </div>

      {/* Required for invisible reCAPTCHA */}
      <div id="recaptcha-container" className="mt-2" />
    </div>
  )
}
