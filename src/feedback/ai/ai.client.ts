import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAnalysisResult } from './ai.types';

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string | null {
    const url = this.config.get<string>('AI_BASE_URL');
    if (!url) return null;
    return url.replace(/\/+$/, '');
  }

  private get timeoutMs(): number {
    // 8s suele ser insuficiente en cold-start o con zero-shot.
    return Number(this.config.get<string>('AI_TIMEOUT_MS') ?? 30000);
  }

  async analyzeText(params: {
    text: string;
    lang?: string;
    tasks?: Array<'sentiment' | 'topics' | 'summary'>;
  }): Promise<AiAnalysisResult | null> {
    const base = this.baseUrl;
    if (!base) return null;

    const text = String(params.text ?? '').trim();
    if (!text) return null;

    const payload = {
      text,
      lang: params.lang ?? 'es',
      tasks: params.tasks ?? ['sentiment', 'topics', 'summary'],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${base}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(`AI analyze failed: ${res.status} ${res.statusText}`);
        return null;
      }

      const data = (await res.json()) as any;

      const result: AiAnalysisResult = {
        sentiment: data?.sentiment
          ? { label: String(data.sentiment.label ?? ''), score: Number(data.sentiment.score ?? 0) }
          : undefined,
        topics: Array.isArray(data?.topics)
          ? data.topics.map((t: any) => ({ label: String(t.label ?? ''), score: Number(t.score ?? 0) }))
          : undefined,
        summary: data?.summary ? String(data.summary) : undefined,
        modelVersion: data?.modelVersion ? String(data.modelVersion) : undefined,
        analyzedAt: new Date().toISOString(),
      };

      return result;
    } catch (e: any) {
      this.logger.warn(`AI analyze error: ${String(e?.message ?? e)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
