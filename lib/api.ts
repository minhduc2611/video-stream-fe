// API service layer for backend integration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090/api/v1';

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

export interface PlaybackMetricPayload {
  benchmark_run_source?: string;
  benchmark_metadata?: Record<string, unknown>;
  video_id?: string;
  bandwidth_mbps?: number;
  country?: string;
  isp?: string;
  device_type?: string;
  first_frame_ms?: number;
  total_startup_ms?: number;
  buffering_events?: number;
}

export interface MetricsInsights {
  video_processing: {
    totals: ProcessingAggregate;
    step_breakdown: ProcessingStepStat[];
    recent_runs: ProcessingRunSummary[];
  };
  api_latency: {
    totals: ApiLatencyTotals;
    by_route: ApiRouteLatency[];
  };
  playback: {
    totals: PlaybackTotals;
    by_country: PlaybackGeoSummary[];
    by_device: PlaybackDeviceSummary[];
  };
  server_startup: {
    totals: ServerStartupTotals;
    recent_samples: ServerStartupSample[];
  };
}

export interface ProcessingAggregate {
  run_count: number;
  avg_total_duration_ms: number | null;
  fastest_run_ms: number | null;
  slowest_run_ms: number | null;
}

export interface ProcessingStepStat {
  step: string;
  sample_count: number;
  avg_duration_ms: number | null;
  avg_cpu: number | null;
  peak_mem_bytes: number | null;
}

export interface ProcessingRunSummary {
  id: string;
  started_at: string;
  source: string;
  runner_host: string;
  cpu_model: string | null;
  bandwidth_mbps: number | null;
  total_duration_ms: number;
  step_count: number;
  avg_cpu: number | null;
  peak_mem_bytes: number | null;
}

export interface ApiLatencyTotals {
  sample_count: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  p99_latency_ms: number | null;
}

export interface ApiRouteLatency {
  route: string;
  method: string;
  sample_count: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  p99_latency_ms: number | null;
  avg_concurrent: number | null;
  top_statuses: ApiStatusBreakdown[];
}

export interface ApiStatusBreakdown {
  status: string;
  sample_count: number;
}

export interface PlaybackTotals {
  sample_count: number;
  avg_first_frame_ms: number | null;
  avg_total_startup_ms: number | null;
  avg_buffering_events: number | null;
}

export interface PlaybackGeoSummary {
  country: string;
  sample_count: number;
  avg_first_frame_ms: number | null;
  avg_total_startup_ms: number | null;
  avg_buffering_events: number | null;
}

export interface PlaybackDeviceSummary {
  device_type: string;
  sample_count: number;
  avg_first_frame_ms: number | null;
  avg_total_startup_ms: number | null;
  avg_buffering_events: number | null;
}

export interface ServerStartupTotals {
  sample_count: number;
  avg_startup_ms: number | null;
  min_startup_ms: number | null;
  max_startup_ms: number | null;
  cold_start_avg_ms: number | null;
  warm_start_avg_ms: number | null;
  cold_start_count: number;
  warm_start_count: number;
}

export interface ServerStartupSample {
  recorded_at: string;
  service_name: string;
  revision: string | null;
  cold_start: boolean;
  startup_duration_ms: number;
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

  async recordPlaybackMetric(
    payload: PlaybackMetricPayload
  ): Promise<ApiResponse<string>> {
    return this.request<string>('/metrics/playback', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMetricsInsights(): Promise<ApiResponse<MetricsInsights>> {
    return this.request<MetricsInsights>('/metrics/insights');
  }
}

export const apiService = new ApiService(API_BASE_URL);
