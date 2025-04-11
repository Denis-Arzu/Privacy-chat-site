"use client"

import { useState, useEffect } from "react"
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

// Extend window for reCAPTCHA
declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier
  }
}

export default function AuthPage() {
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined" && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {
          console.log("reCAPTCHA verified")
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
    const appVerifier = window.recaptchaVerifier as ApplicationVerifier

    try {
      const result = await signInWithPhoneNumber(auth, phone, appVerifier)
      setConfirmResult(result)
      setError("")
    } catch (error) {
      console.error("Error sending code:", error)
      setError("Failed to send verification code. Please try again.")
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
        console.log("User signed in:", result.user)

        const userRef = doc(db, "users", result.user.uid)
        const snapshot = await getDoc(userRef)

        if (!snapshot.exists()) {
          await setDoc(userRef, {
            phoneNumber: result.user.phoneNumber,
            uid: result.user.uid,
            name: name || "Anonymous",
            createdAt: serverTimestamp(),
          })
          console.log("✅ User added to Firestore")
        } else {
          console.log("ℹ️ User already exists in Firestore")
        }

        if (isClient) {
          router.push("/chat")
        }
      }
    } catch (err) {
      console.error("❌ Invalid code", err)
      setError("Invalid verification code. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 bg-gray-900 text-white">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-green-400">📱 Register to chat</h1>
          <p className="text-gray-400 text-sm sm:text-base">Secure authentication with your phone number</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">{error}</div>
        )}

        {!user ? (
          !confirmResult ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="phone" className="block text-sm font-medium text-gray-300">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-gray-600 bg-gray-700 p-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-white"
                />
                <p className="text-xs text-gray-400">Enter your phone number with country code</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                  Your Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-600 bg-gray-700 p-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-white"
                />
              </div>

              <button
                onClick={handleSendCode}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="code" className="block text-sm font-medium text-gray-300">
                  Verification Code
                </label>
                <input
                  id="code"
                  type="text"
                  placeholder="Enter verification code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full border border-gray-600 bg-gray-700 p-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-white"
                />
                <p className="text-xs text-gray-400">Enter the 6-digit code sent to your phone</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setConfirmResult(null)}
                  className="sm:flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleVerifyCode}
                  disabled={loading}
                  className="sm:flex-1 bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/30 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-green-400 mb-2">Authentication Successful</h2>
            <p className="text-gray-300 mb-6">Signed in as {user.phoneNumber}</p>
            <p className="text-sm text-gray-400">Redirecting to chat...</p>
          </div>
        )}
      </div>

      <div id="recaptcha-container" className="mt-4" />
    </div>
  )
}
