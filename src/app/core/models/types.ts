export interface Box {
  cls: string;
  conf: number;
  xyxy: [number, number, number, number];
}

export interface DetectResponse {
  ok: boolean;
  missing: string[];
  boxes: Box[];
  verdict?: string;
  image_b64?: string;
}

export interface VideoResponse {
  total_frames: number;
  sample_results: {
    frame: number;
    ok: boolean;
    boxes: Box[];
    missing: string[];
  }[];
  missing_global: string[];
  frames?: { boxes: Box[]; verdict: string }[];
}

export interface AnalyseCompleteResponse extends DetectResponse {
  chat_response: string;
  sources: string[];
}

export interface ChatResponse {
  answer: string;
  missing_used: string[];
  sources?: string[];
  processing_time_ms: number;
  diagnostics?: any;
}
