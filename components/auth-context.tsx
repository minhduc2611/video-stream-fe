"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { apiService, type User } from "@/lib/api"

interface AuthUser extends User {
  avatar?: string
  role: "user" | "admin"
}

interface AuthContextType {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (email: string, password: string, username: string) => Promise<{ success: boolean; error?: string }>
  signInWithGoogle: (credential: string) => Promise<void>
  logout: () => void
  isLoading: boolean
  isAdmin: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in and validate token
    const checkAuth = async () => {
      const token = localStorage.getItem("token")
      if (token) {
        apiService.setToken(token)
        const response = await apiService.getCurrentUser()
        if (response.success && response.data) {
          setUser({
            ...response.data,
            avatar: "/diverse-user-avatars.png",
            role: response.data.email === "admin@example.com" ? "admin" : "user"
          })
        } else {
          // Token is invalid, remove it
          localStorage.removeItem("token")
          apiService.setToken(null)
        }
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)

    try {
      const response = await apiService.login(email, password)
      
      if (response.success && response.data) {
        const { user: userData, token } = response.data
        apiService.setToken(token)
        
        setUser({
          ...userData,
          avatar: "/diverse-user-avatars.png",
          role: userData.email === "admin@example.com" ? "admin" : "user"
        })
        
        setIsLoading(false)
        router.push("/dashboard")
        return { success: true }
      } else {
        setIsLoading(false)
        return { success: false, error: response.error || "Login failed" }
      }
    } catch (error) {
      setIsLoading(false)
      return { success: false, error: "Network error" }
    }
  }

  const signup = async (email: string, password: string, username: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)

    try {
      const response = await apiService.register(email, username, password)
      
      if (response.success && response.data) {
        const { user: userData, token } = response.data
        apiService.setToken(token)
        
        setUser({
          ...userData,
          avatar: "/diverse-user-avatars.png",
          role: "user"
        })
        
        setIsLoading(false)
        router.push("/dashboard")
        return { success: true }
      } else {
        setIsLoading(false)
        return { 
          success: false, 
          error: response.error || "Registration failed",
          ...(response.validation_errors && { validation_errors: response.validation_errors })
        }
      }
    } catch (error) {
      setIsLoading(false)
      return { success: false, error: "Network error" }
    }
  }

  const signInWithGoogle = async (credential: string): Promise<void> => {
    setIsLoading(true)

    try {
      const response = await apiService.googleAuth(credential)
      
      if (response.success && response.data) {
        const { user: userData, token } = response.data
        apiService.setToken(token)
        
        setUser({
          ...userData,
          avatar: userData.avatar || "/diverse-user-avatars.png",
          role: userData.email === "admin@example.com" ? "admin" : "user"
        })
        
        setIsLoading(false)
        router.push("/dashboard")
      } else {
        setIsLoading(false)
        throw new Error(response.error || "Google authentication failed")
      }
    } catch (error) {
      setIsLoading(false)
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("token")
    apiService.setToken(null)
    router.push("/sign-in")
  }

  const isAdmin = () => {
    return user?.role === "admin"
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, signInWithGoogle, logout, isLoading, isAdmin }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
