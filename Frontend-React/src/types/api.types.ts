export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
}

export interface ApiErrorResponse {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
  message?: string;
}

