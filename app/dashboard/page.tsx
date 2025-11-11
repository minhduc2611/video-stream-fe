"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import VideoPlayer from "@/components/video-player"
import VideoSidebar from "@/components/video-sidebar"
import VideoUpload from "@/components/video-upload"
import { apiService, type Video, VideoStatus } from "@/lib/api"
import { useAuth } from "@/components/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { AlertCircle, Loader2, Menu } from "lucide-react"

interface DashboardVideo extends Video {
  thumbnail: string
  formattedDuration: string
  views: number
  uploadDate: string
  category: string
  isNew?: boolean
  isWatched?: boolean
  src: string
  subtitles?: Array<{
    label: string
    src: string
    language: string
  }>
}

type SidebarVideo = {
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

export default function DashboardPage() {
  const [videos, setVideos] = useState<DashboardVideo[]>([])
  const [selectedVideo, setSelectedVideo] = useState<DashboardVideo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const fetchVideos = async () => {
      if (!user) return
      
      setIsLoading(true)
      setError("")
      
      try {
        const response = await apiService.getVideos(50, 0)
        
        if (response.success && response.data) {
          const dashboardVideos: DashboardVideo[] = response.data.data.map(video => ({
            ...video,
            thumbnail: video.thumbnail_url || "/placeholder.svg",
            formattedDuration: video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : "0:00",
            views: 0, // Backend doesn't track views yet
            uploadDate: new Date(video.created_at).toLocaleDateString(),
            category: "Video", // Default category
            src: video.hls_stream_url || "",
            isNew: new Date(video.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // New if created within last 7 days
          }))
          
          setVideos(dashboardVideos)
          if (dashboardVideos.length > 0 && !selectedVideo) {
            setSelectedVideo(dashboardVideos[0])
          }
        } else {
          setError(response.error || "Failed to load videos")
        }
      } catch (error) {
        setError("Failed to load videos")
        console.error("Error fetching videos:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchVideos()
  }, [user, selectedVideo])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const handleVideoSelect = (video: DashboardVideo) => {
    setSelectedVideo(video)
  }

  const sidebarVideos: SidebarVideo[] = videos.map(video => ({
    id: video.id,
    title: video.title,
    thumbnail: video.thumbnail,
    duration: video.formattedDuration,
    views: `${video.views}`,
    uploadDate: video.uploadDate,
    category: video.category,
    ...(video.isNew ? { isNew: true } : {}),
    ...(video.isWatched ? { isWatched: true } : {}),
  }))

  const handleSidebarVideoSelect = (sidebarVideo: SidebarVideo) => {
    const fullVideo = videos.find(video => video.id === sidebarVideo.id)
    if (fullVideo) {
      handleVideoSelect(fullVideo)
    }
  }

  const handleUploadSuccess = () => {
    // Refresh videos after successful upload
    window.location.reload()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading videos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b border-border bg-background md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-1">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open video library</span>
                </Button>
              </SheetTrigger>
              <div>
                <p className="text-lg font-semibold text-foreground">StreamApp</p>
                <p className="text-xs text-muted-foreground">Your video dashboard</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/upload">Upload</Link>
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col md:flex-row">
          <aside className="hidden md:flex md:h-screen md:w-80 md:flex-shrink-0 md:flex-col md:overflow-y-auto">
            <VideoSidebar
              videos={sidebarVideos}
              selectedVideoId={selectedVideo?.id || ""}
              onVideoSelect={handleSidebarVideoSelect}
            />
          </aside>

          <main className="flex flex-1 flex-col md:overflow-hidden">
            {videos.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6">
                <div className="space-y-2 text-center">
                  <h2 className="text-2xl font-bold text-foreground">No videos yet</h2>
                  <p className="text-muted-foreground">
                    Upload your first HLS video to start building your library.
                  </p>
                </div>
                <VideoUpload onUploadSuccess={handleUploadSuccess} className="w-full max-w-md" />
              </div>
            ) : selectedVideo ? (
              <div className="flex flex-1 flex-col overflow-y-auto">
                <div className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
                  {selectedVideo.status === VideoStatus.Ready && selectedVideo.src ? (
                    <VideoPlayer
                      src={selectedVideo.src}
                      title={selectedVideo.title}
                      subtitles={selectedVideo.subtitles}
                      className="w-full aspect-video md:aspect-auto md:h-full md:max-h-[70vh]"
                      videoId={selectedVideo.id}
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-black text-white md:h-full md:max-h-[70vh]">
                      <div className="space-y-2 text-center">
                        {selectedVideo.status === VideoStatus.Processing ? (
                          <>
                            <p className="text-base">The video is being processed...</p>
                            <p className="text-sm text-white/70">Try again in a few minutes.</p>
                          </>
                        ) : selectedVideo.status === VideoStatus.Uploading ? (
                          <>
                            <Loader2 className="mx-auto h-12 w-12 animate-spin" />
                            <p className="text-base">Uploading video...</p>
                            <p className="text-sm text-white/70">Hang tight while we finish uploading your file.</p>
                          </>
                        ) : selectedVideo.status === VideoStatus.Failed ? (
                          <>
                            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
                            <p className="text-base font-semibold">Processing failed</p>
                            <p className="text-sm text-white/70">Try re-uploading the video from the dashboard.</p>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="mx-auto h-12 w-12 text-amber-300" />
                            <p className="text-base font-semibold">Video not ready</p>
                            <p className="text-sm text-white/70">We&apos;ll enable playback once the stream is prepared.</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 space-y-4 sm:mt-8">
                    <div>
                      <h1 className="text-xl font-bold text-foreground text-balance sm:text-2xl">
                        {selectedVideo.title}
                      </h1>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{selectedVideo.views} views</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{selectedVideo.uploadDate}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="rounded bg-secondary/10 px-2 py-1 text-secondary">
                          {selectedVideo.category}
                        </span>
                        <span className="rounded bg-secondary/10 px-2 py-1 text-secondary">
                          {selectedVideo.status}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-card p-4">
                      <h3 className="mb-2 font-semibold text-card-foreground">About this video</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {selectedVideo.description || "No description available."}
                      </p>
                    </div>
                  </div>
                  {videos.length > 1 && (
                    <div className="mt-8 md:hidden">
                      <h2 className="text-lg font-semibold text-foreground">Recommended Videos</h2>
                      <div className="mt-4 space-y-4">
                        {sidebarVideos
                          .filter((video) => video.id !== selectedVideo.id)
                          .map((video) => (
                            <button
                              key={video.id}
                              onClick={() => handleSidebarVideoSelect(video)}
                              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-card/90"
                              type="button"
                            >
                              <div className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-md">
                                <img
                                  src={video.thumbnail || "/placeholder.svg"}
                                  alt={video.title}
                                  className="h-full w-full object-cover"
                                />
                                <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-xs text-white">
                                  {video.duration}
                                </span>
                              </div>
                              <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium text-foreground line-clamp-2 text-balance">
                                  {video.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {video.views} views • {video.uploadDate}
                                </p>
                                <span className="inline-flex items-center rounded bg-secondary/10 px-2 py-0.5 text-xs text-secondary">
                                  {video.category}
                                </span>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center px-4 py-10">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-foreground">Select a video</h2>
                  <p className="text-muted-foreground">Choose a video from the sidebar to start watching.</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <SheetContent side="left" className="w-full max-w-sm border-r border-border p-0">
        <VideoSidebar
          videos={sidebarVideos}
          selectedVideoId={selectedVideo?.id || ""}
          onVideoSelect={handleSidebarVideoSelect}
          onClose={() => setIsSidebarOpen(false)}
          className="h-full"
        />
      </SheetContent>
    </Sheet>
  )
}
