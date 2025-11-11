"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-context"

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (user) {
      router.replace("/dashboard")
    } else {
      router.replace("/sign-in")
    }
  }, [router, user, isLoading])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Loading...</h1>
      </div>
    </div>
  )
}
