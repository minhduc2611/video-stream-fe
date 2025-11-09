"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import VideoPlayer from "@/components/video-player"
import { apiService, Video, HlsStreamingResponse, VideoStatus } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, Clock, User, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

const WatchPage = () => {
  const params = useParams()
  const router = useRouter()
  const videoId = params.video_id as string

  const [video, setVideo] = useState<Video | null>(null)
  const [streamData, setStreamData] = useState<HlsStreamingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hlsUrl, setHlsUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!videoId) return

    const fetchVideoData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch video details
        const videoResponse = await apiService.getVideo(videoId)
        if (!videoResponse.success || !videoResponse.data) {
          throw new Error(videoResponse.error || "Failed to fetch video details")
        }
        setVideo(videoResponse.data)

        // Use direct GCS URLs from the video data
        if (videoResponse.data.hls_stream_url) {
          setHlsUrl(videoResponse.data.hls_stream_url)
        }

        // Try to fetch streaming data for additional info (optional)
        try {
          const streamResponse = await apiService.getVideoStream(videoId)
          if (streamResponse.success && streamResponse.data) {
            setStreamData(streamResponse.data)
          }
        } catch (streamError) {
          console.warn("Stream endpoint not available, using video data only:", streamError)
        }

      } catch (err) {
        console.error("Error fetching video data:", err)
        setError(err instanceof Error ? err.message : "Failed to load video")
        toast.error("Failed to load video")
      } finally {
        setLoading(false)
      }
    }

    fetchVideoData()
  }, [videoId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "Unknown"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500'
      case 'processing': return 'bg-yellow-500'
      case 'failed': return 'bg-red-500'
      case 'uploading': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-gray-600">Loading video...</p>
        </div>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Video Not Found</CardTitle>
            <CardDescription>
              {error || "The video you're looking for doesn't exist or you don't have permission to view it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => router.back()}
              variant="ghost"
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>

            <div className="flex items-center space-x-4">
              <Badge className={`${getStatusColor(video.status)} text-white`}>
                {video.status.charAt(0).toUpperCase() + video.status.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-0">
                {hlsUrl && video.status === VideoStatus.Ready ? (
                  <VideoPlayer
                    src={hlsUrl}
                    title={video.title}
                    className="w-full aspect-video"
                  />
                ) : video.status === VideoStatus.Processing ? (
                  <div className="aspect-video bg-black flex items-center justify-center">
                    <div className="text-center text-white">
                      <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Processing Video</h3>
                      <p className="text-gray-300">Your video is being processed. This may take a few minutes.</p>
                    </div>
                  </div>
                ) : video.status === VideoStatus.Failed ? (
                  <div className="aspect-video bg-black flex items-center justify-center">
                    <div className="text-center text-white">
                      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Processing Failed</h3>
                      <p className="text-gray-300">There was an error processing this video.</p>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-black flex items-center justify-center">
                    <div className="text-center text-white">
                      <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Uploading</h3>
                      <p className="text-gray-300">Your video is being uploaded.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Video Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{video.title}</CardTitle>
                {video.description && (
                  <CardDescription className="text-base">
                    {video.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  <span>Uploaded by user</span>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(video.created_at)}</span>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(video.duration)}</span>
                </div>

                <div className="pt-4 border-t">
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>File Size: {(video.file_size / (1024 * 1024)).toFixed(2)} MB</div>
                    <div>Filename: {video.filename}</div>
                    {video.hls_playlist_path && (
                      <div>HLS Ready: Yes</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stream Information */}
            {streamData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stream Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge className={`${getStatusColor(streamData.status)} text-white`}>
                      {streamData.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span>{formatDuration(streamData.duration)}</span>
                  </div>
                  {(streamData?.thumbnail_url || video.thumbnail_url) && (
                    <div className="pt-2">
                      <img
                        src={streamData?.thumbnail_url || video.thumbnail_url}
                        alt="Video thumbnail"
                        className="w-full rounded-md"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default WatchPage