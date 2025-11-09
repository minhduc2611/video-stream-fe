// API service layer for backend integration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  validation_errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    current_page: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export enum VideoStatus {
  Uploading = 'Uploading',
  Processing = 'Processing',
  Ready = 'Ready',
  Failed = 'Failed',
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  filename: string;
  file_size: number;
  duration?: number;
  thumbnail_path?: string;
  hls_playlist_path?: string;
  hls_stream_url?: string;
  thumbnail_url?: string;
  status: VideoStatus;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface VideoUploadResponse {
  video_id: string;
  title: string;
  description?: string;
  status: string;
  hls_files_count: number;
  total_size: number;
  created_at: string;
}

export interface HlsStreamingResponse {
  video_id: string;
  hls_url: string;
  thumbnail_url?: string;
  status: string;
  title: string;
  duration?: number;
}

class ApiService {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Get token from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers = new Headers({ 'Content-Type': 'application/json' });

    if (options.headers) {
      const optionHeaders = new Headers(options.headers as HeadersInit);
      optionHeaders.forEach((value, key) => {
        headers.set(key, value);
      });
    }

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'An error occurred',
          validation_errors: data.validation_errors,
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Authentication endpoints
  async register(email: string, username: string, password: string): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
  }

  async login(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>('/auth/me');
  }

  async googleAuth(credential: string): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token: credential }),
    });
  }

  // Video endpoints
  async getVideos(limit = 10, offset = 0): Promise<ApiResponse<PaginatedResponse<Video>>> {
    return this.request<PaginatedResponse<Video>>(`/videos?limit=${limit}&offset=${offset}`);
  }

  async getVideo(videoId: string): Promise<ApiResponse<Video>> {
    return this.request<Video>(`/videos/${videoId}`);
  }

  async getVideoStream(videoId: string): Promise<ApiResponse<HlsStreamingResponse>> {
    return this.request<HlsStreamingResponse>(`/videos/${videoId}/stream`);
  }

  async updateVideo(
    videoId: string,
    payload: { title?: string; description?: string | null },
  ): Promise<ApiResponse<Video>> {
    return this.request<Video>(`/videos/${videoId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async uploadVideo(
    title: string,
    description: string | undefined,
    files: File[]
  ): Promise<ApiResponse<VideoUploadResponse>> {
    const formData = new FormData();
    formData.append('title', title);
    if (description) {
      formData.append('description', description);
    }
    
    files.forEach(file => {
      formData.append('files', file);
    });

    const url = `${this.baseURL}/videos`;
    const headers: HeadersInit = {};
    
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Upload failed',
          validation_errors: data.validation_errors,
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async deleteVideo(videoId: string): Promise<ApiResponse<string>> {
    return this.request<string>(`/videos/${videoId}`, {
      method: 'DELETE',
    });
  }

  // Helper method to get full URL for HLS streaming
  getHlsStreamUrl(videoId: string): string {
    return `${this.baseURL}/videos/${videoId}/stream/playlist.m3u8`;
  }

  // Helper method to get thumbnail URL
  getThumbnailUrl(videoId: string): string {
    return `${this.baseURL}/videos/${videoId}/thumbnail`;
  }
}

export const apiService = new ApiService(API_BASE_URL);
