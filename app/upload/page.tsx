"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import VideoUpload from "@/components/video-upload"

export default function UploadPage() {
  const router = useRouter()

  const handleUploadSuccess = () => {
    // Redirect to dashboard after successful upload
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Upload Video</h1>
          <p className="text-muted-foreground mt-2">
            Share your HLS video content with the community
          </p>
        </div>
      </div>

      {/* Upload Form */}
      <VideoUpload 
        onUploadSuccess={handleUploadSuccess}
        className="mx-auto"
      />
    </div>
  )
}
