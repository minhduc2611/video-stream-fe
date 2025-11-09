"use client"

import { useState, useEffect } from "react"
import VideoPlayer from "@/components/video-player"
import VideoSidebar from "@/components/video-sidebar"
import VideoUpload from "@/components/video-upload"
import { apiService, type Video, VideoStatus } from "@/lib/api"
import { useAuth } from "@/components/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"

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
            src: video.hls_stream_url
              ? (video.hls_stream_url.startsWith("http")
                  ? video.hls_stream_url
                  : apiService.getHlsStreamUrl(video.id))
              : video.hls_playlist_path
                ? apiService.getHlsStreamUrl(video.id)
                : "",
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
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading videos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen bg-background items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="flex h-screen bg-background">
        <VideoSidebar videos={[]} selectedVideoId="" onVideoSelect={() => {}} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">No videos yet</h2>
            <p className="text-muted-foreground mb-4">Upload your first HLS video to get started</p>
            <VideoUpload onUploadSuccess={handleUploadSuccess} className="max-w-md" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <VideoSidebar 
        videos={sidebarVideos} 
        selectedVideoId={selectedVideo?.id || ""} 
        onVideoSelect={handleSidebarVideoSelect} 
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedVideo ? (
          <>
            {/* Video Player */}
            <div className="flex-1 p-6">
              {selectedVideo.status === VideoStatus.Ready && selectedVideo.src ? (
                <VideoPlayer
                  src={selectedVideo.src}
                  title={selectedVideo.title}
                  subtitles={selectedVideo.subtitles}
                  className="w-full h-full max-h-[70vh]"
                />
              ) : (
                <div className="w-full h-full max-h-[70vh] flex items-center justify-center bg-black rounded-lg">
                  <div className="text-center text-white space-y-2">
                    {selectedVideo.status === VideoStatus.Processing ? (
                      <>
                        <p className="text-base">The video is being processed...</p>
                        <p className="text-sm text-white/70">Try again in a few minutes.</p>
                      </>
                    ) : selectedVideo.status === VideoStatus.Uploading ? (
                      <>
                        <Loader2 className="h-12 w-12 animate-spin mx-auto" />
                        <p className="text-base">Uploading video...</p>
                        <p className="text-sm text-white/70">Hang tight while we finish uploading your file.</p>
                      </>
                    ) : selectedVideo.status === VideoStatus.Failed ? (
                      <>
                        <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
                        <p className="text-base font-semibold">Processing failed</p>
                        <p className="text-sm text-white/70">Try re-uploading the video from the dashboard.</p>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-12 w-12 text-amber-300 mx-auto" />
                        <p className="text-base font-semibold">Video not ready</p>
                        <p className="text-sm text-white/70">We&apos;ll enable playback once the stream is prepared.</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Video Info */}
              <div className="mt-6 space-y-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground text-balance">{selectedVideo.title}</h1>
                  <div className="flex items-center space-x-4 mt-2 text-muted-foreground">
                    <span>{selectedVideo.views} views</span>
                    <span>•</span>
                    <span>{selectedVideo.uploadDate}</span>
                    <span>•</span>
                    <span className="bg-secondary/10 text-secondary px-2 py-1 rounded text-sm">
                      {selectedVideo.category}
                    </span>
                    <span className="bg-secondary/10 text-secondary px-2 py-1 rounded text-sm">
                      {selectedVideo.status}
                    </span>
                  </div>
                </div>

                <div className="bg-card p-4 rounded-lg border border-border">
                  <h3 className="font-semibold text-card-foreground mb-2">About this video</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {selectedVideo.description || "No description available."}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Select a video</h2>
              <p className="text-muted-foreground">Choose a video from the sidebar to start watching</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
