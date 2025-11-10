"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search,
  Play,
  Bookmark,
  History,
  TrendingUp,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Shield,
  Upload,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-context"
import Link from "next/link"

interface Video {
  id: string
  title: string
  thumbnail: string
  duration: string
  views: string
  uploadDate: string
  category: string
  isNew?: boolean
  isWatched?: boolean
}

interface VideoSidebarProps {
  videos: Video[]
  selectedVideoId?: string
  onVideoSelect: (video: Video) => void
  className?: string
  onClose?: () => void
}

const mockVideos: Video[] = [
  {
    id: "1",
    title: "Introduction to React Hooks",
    thumbnail: "/react-tutorial.png",
    duration: "15:30",
    views: "12K",
    uploadDate: "2 days ago",
    category: "Tutorial",
    isNew: true,
  },
  {
    id: "2",
    title: "Advanced TypeScript Patterns",
    thumbnail: "/typescript-code.png",
    duration: "28:45",
    views: "8.5K",
    uploadDate: "1 week ago",
    category: "Programming",
    isWatched: true,
  },
  {
    id: "3",
    title: "Building Modern Web Apps",
    thumbnail: "/web-development-concept.png",
    duration: "42:15",
    views: "25K",
    uploadDate: "3 days ago",
    category: "Web Dev",
  },
  {
    id: "4",
    title: "CSS Grid Layout Masterclass",
    thumbnail: "/css-grid-layout.png",
    duration: "35:20",
    views: "18K",
    uploadDate: "5 days ago",
    category: "CSS",
  },
  {
    id: "5",
    title: "Node.js Performance Optimization",
    thumbnail: "/nodejs-server.jpg",
    duration: "22:10",
    views: "9.2K",
    uploadDate: "1 week ago",
    category: "Backend",
  },
]

export default function VideoSidebar({
  videos = mockVideos,
  selectedVideoId,
  onVideoSelect,
  className,
  onClose,
}: VideoSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [expandedSections, setExpandedSections] = useState({
    library: true,
    categories: true,
  })

  const { user, logout, isAdmin } = useAuth()

  const categories = ["All", "Tutorial", "Programming", "Web Dev", "CSS", "Backend"]

  const filteredVideos = videos.filter((video) => {
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "All" || video.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const handleSidebarClose = () => {
    onClose?.()
  }

  return (
    <div
      className={cn(
        "flex h-full w-full max-w-full flex-col bg-sidebar",
        "md:w-80 md:border-r md:border-sidebar-border",
        className,
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-primary rounded-full p-2">
            <Play className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-sidebar-foreground">StreamApp</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-sidebar-primary border-sidebar-border"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Quick Actions */}
          <div className="space-y-2">
            <Link href="/upload" onClick={handleSidebarClose}>
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Upload className="h-4 w-4 mr-3" />
                Upload Video
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={handleSidebarClose}
            >
              <TrendingUp className="h-4 w-4 mr-3" />
              Trending
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={handleSidebarClose}
            >
              <History className="h-4 w-4 mr-3" />
              Watch History
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={handleSidebarClose}
            >
              <Bookmark className="h-4 w-4 mr-3" />
              Saved Videos
            </Button>
            {isAdmin && (
              <Link href="/admin" onClick={handleSidebarClose}>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Shield className="h-4 w-4 mr-3" />
                  Admin Panel
                </Button>
              </Link>
            )}
          </div>

          {/* Categories */}
          <div>
            <button
              onClick={() => toggleSection("categories")}
              className="flex items-center justify-between w-full text-sm font-medium text-sidebar-foreground mb-3 hover:text-sidebar-accent-foreground"
            >
              Categories
              {expandedSections.categories ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {expandedSections.categories && (
              <div className="space-y-1">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className="w-full justify-start text-xs"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Video Library */}
          <div>
            <button
              onClick={() => toggleSection("library")}
              className="flex items-center justify-between w-full text-sm font-medium text-sidebar-foreground mb-3 hover:text-sidebar-accent-foreground"
            >
              Video Library ({filteredVideos.length})
              {expandedSections.library ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {expandedSections.library && (
              <div className="space-y-3">
                {filteredVideos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => {
                      onVideoSelect(video)
                      handleSidebarClose()
                    }}
                    className={cn(
                      "flex space-x-3 p-2 rounded-lg cursor-pointer transition-colors",
                      selectedVideoId === video.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-primary",
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={video.thumbnail || "/placeholder.svg"}
                        alt={video.title}
                        className="w-16 h-10 object-cover rounded"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                        {video.duration}
                      </div>
                      {video.isWatched && (
                        <div className="absolute top-1 left-1">
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-medium text-sidebar-foreground line-clamp-2 text-balance">
                          {video.title}
                        </h3>
                        {video.isNew && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-muted-foreground">{video.views} views</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{video.uploadDate}</span>
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {video.category}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* User Profile */}
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar || "/diverse-user-avatars.png"} />
              <AvatarFallback>{user?.name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground">{user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground">{isAdmin ? "Admin User" : "Premium Member"}</p>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={handleSidebarClose}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void logout()
                handleSidebarClose()
              }}
              className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
