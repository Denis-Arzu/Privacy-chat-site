'use client'

import type React from "react"
import { useEffect, useState, useRef, Suspense } from "react"
import { auth, db } from "@/lib/firebase"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { v4 as uuidv4 } from "uuid"
import { onAuthStateChanged, signOut } from "firebase/auth"
import dynamic from "next/dynamic"

import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
} from "firebase/firestore"

const storage = getStorage()
const EmojiPicker = dynamic(() => import("emoji-picker-react").then(mod => mod.default), { ssr: false })
import { Theme } from "emoji-picker-react"

interface User {
  uid: string
  name?: string
  phoneNumber?: string
}

interface Message {
  id: string
  text?: string
  fileURL?: string
  sender: string
  uid: string
  createdAt: any
  read: boolean
  type: "text" | "image"
  replyTo?: string
}

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null)
  const [partner, setPartner] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [typing, setTyping] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", authUser.uid))
          const userData = userDoc.exists() ? (userDoc.data() as User) : null
          if (userData) setUser({ ...userData, uid: authUser.uid })

          const usersSnapshot = await getDocs(collection(db, "users"))
          const users = usersSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User))
          const partnerData = users.find(u => u.uid !== authUser.uid)
          if (partnerData) setPartner(partnerData)
        } catch (err) {
          console.error("Error loading user:", err)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, "messages"), orderBy("createdAt"))
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const loadedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[]
        setMessages(loadedMessages)
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })

        const unread = loadedMessages.filter(msg => msg.uid !== user.uid && !msg.read)
        await Promise.all(unread.map(msg => updateDoc(doc(db, "messages", msg.id), { read: true })))
      } catch (err) {
        console.error("Error fetching messages:", err)
      }
    })
    return () => unsubscribe()
  }, [user])

  useEffect(() => {
    if (!user) return
    const typingRef = doc(db, "typing", user.uid)
    const interval = setInterval(async () => {
      try {
        await updateDoc(typingRef, { isTyping: false })
      } catch {}
    }, 4000)
    return () => clearInterval(interval)
  }, [user])

  const handleSendMessage = async () => {
    const cleanMsg = newMessage.trim()
    if (!cleanMsg || !user) return
    try {
      await addDoc(collection(db, "messages"), {
        text: cleanMsg,
        sender: user.name || user.phoneNumber,
        uid: user.uid,
        createdAt: serverTimestamp(),
        read: false,
        type: "text",
        replyTo: replyingTo?.text || null,
      })
      setNewMessage("")
      setReplyingTo(null)
      setShowEmojiPicker(false)
    } catch (err) {
      console.error("Error sending message:", err)
    }
  }

  const handleTyping = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    setTyping(true)
    if (user) {
      const typingRef = doc(db, "typing", user.uid)
      await setDoc(typingRef, { isTyping: true }, { merge: true })
      typingTimeout.current = setTimeout(async () => {
        await updateDoc(typingRef, { isTyping: false }).catch(() => {})
      }, 4000)
    }
  }

  const handleEmojiClick = (emojiObject: { emoji: string }) => {
    setNewMessage(prev => prev + emojiObject.emoji)
  }

  const handleUploadFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    try {
      const fileRef = ref(storage, `uploads/${user.uid}/${uuidv4()}-${file.name}`)
      await uploadBytes(fileRef, file)
      const fileURL = await getDownloadURL(fileRef)
      await addDoc(collection(db, "messages"), {
        fileURL,
        sender: user.name || user.phoneNumber,
        uid: user.uid,
        createdAt: serverTimestamp(),
        read: false,
        type: "image",
      })
    } catch (err) {
      console.error("Error uploading file:", err)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleTouchStart = useRef<number | null>(null)
  const handleTouchEnd = (msg: Message, e: React.TouchEvent<HTMLDivElement>) => {
    if (handleTouchStart.current !== null) {
      const deltaX = e.changedTouches[0].clientX - handleTouchStart.current
      if (deltaX > 70) setReplyingTo(msg)
      handleTouchStart.current = null
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-white bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="p-4 bg-gray-800 flex justify-between items-center">
        <h1 className="text-xl font-bold text-green-400">💬 Chat Room</h1>
        {user && (
          <button onClick={() => signOut(auth)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded">
            Sign Out
          </button>
        )}
      </header>

      {partner && (
        <div className="flex items-center gap-4 bg-gray-700 py-3 px-4">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-black font-bold">
            {partner.name?.charAt(0).toUpperCase() || "P"}
          </div>
          <div>
            <div className="font-semibold">Chatting with {partner.name}</div>
            {typing && <div className="text-xs text-gray-300 animate-pulse">Typing...</div>}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-2 space-y-2 sm:p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            onTouchStart={(e) => handleTouchStart.current = e.touches[0].clientX}
            onTouchEnd={(e) => handleTouchEnd(msg, e)}
            className={`max-w-[80%] px-4 py-2 rounded-lg text-sm break-words shadow-md ${
              msg.uid === user?.uid ? "bg-green-600 ml-auto" : "bg-gray-700"
            }`}
          >
            <div className="text-xs text-gray-300 mb-1 font-semibold">{msg.sender}</div>
            {msg.replyTo && <div className="text-xs italic text-gray-400 mb-1 border-l-2 pl-2 border-green-300">{msg.replyTo}</div>}
            {msg.type === "text" && <div>{msg.text}</div>}
            {msg.type === "image" && <img src={msg.fileURL || "/placeholder.svg"} alt="uploaded" className="rounded max-w-[250px] border border-white" />}
            {msg.uid === user?.uid && msg.read && <div className="text-[10px] text-gray-300 mt-1">✓ Seen</div>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-3 bg-gray-800 flex flex-col gap-2 relative">
        {replyingTo && (
          <div className="bg-gray-700 text-sm text-white p-2 rounded flex justify-between items-center">
            <div className="italic">Replying to: {replyingTo.text}</div>
            <button onClick={() => setReplyingTo(null)} className="text-red-400 font-bold text-sm ml-4">×</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={handleTyping}
            className="flex-1 p-2 rounded bg-gray-700 text-white focus:outline-none text-sm sm:text-base"
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-lg px-2 text-yellow-400">😊</button>
          <button onClick={handleUploadFile} className="text-lg px-2 text-purple-400">📎</button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          <button
            id="send-btn"
            onClick={() => {
              handleSendMessage()
              const btn = document.getElementById("send-btn")
              if (btn) {
                btn.classList.remove("animate-bounce-once")
                void btn.offsetWidth
                btn.classList.add("animate-bounce-once")
              }
            }}
            className="text-2xl px-2 text-blue-400 hover:text-blue-500 transition-transform"
            aria-label="Send"
          >
            ➤
          </button>
        </div>

        {showEmojiPicker && (
          <div className="absolute bottom-16 left-4 z-10">
            <Suspense fallback={<div className="text-white">Loading emojis...</div>}>
              <EmojiPicker onEmojiClick={handleEmojiClick} height={300} width={250} theme={Theme.DARK} />
            </Suspense>
          </div>
        )}
      </footer>
    </div>
  )
}
