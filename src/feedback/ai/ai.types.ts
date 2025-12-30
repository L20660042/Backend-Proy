export type AiSentiment = {
  label: string;   
  score: number;     
};

export type AiTopic = {
  label: string;     
  score: number;     
};

export type AiAnalysisResult = {
  sentiment?: AiSentiment;
  topics?: AiTopic[];
  summary?: string;
  modelVersion?: string;
  analyzedAt?: string; 
};
