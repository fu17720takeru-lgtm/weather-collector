export interface WeatherRecord {
  id: string;
  observed_at: string;
  area: string;
  temperature: number | null;
  wind_speed: number | null;
  precipitation: number | null;
  created_at: string;
}

export interface WeatherData {
  observed_at: string;
  area: string;
  temperature: number | null;
  wind_speed: number | null;
  precipitation: number | null;
}

export interface WeatherApiResponse {
  success: boolean;
  data?: WeatherRecord[];
  error?: string;
}

export interface CollectApiResponse {
  success: boolean;
  message?: string;
  inserted?: number;
  error?: string;
}
