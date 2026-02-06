import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenAI } from '@google/genai';

import { Document } from 'src/entities/document.entity';
import { DocumentChunk } from 'src/entities/document.chunks.entity';
import { DocumentPages } from 'src/entities/document.pages.entity';



const SIMILARITY_FLOOR = 0.5;

const MAX_PER_PAGE = 1;
const MAX_PER_SECTION = 2;

const MAX_CONTEXT_TOKENS = 1500;
const PROMPT_OVERHEAD = 300;

const FRESHNESS_WEIGHT = 0.1;



export type RetrievalTrace = {
  chunkId: number;
  similarity: number;
  freshnessPenalty: number;
  finalScore: number;
  pageStart: number;
  sectionTitle?: string;
  selected: boolean;
  rejectionReason?: 'PAGE_DIVERSITY' | 'SECTION_DIVERSITY' | 'TOKEN_LIMIT';
};

@Injectable()
export class RetrievalService {
  private readonly ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,

    @InjectRepository(DocumentChunk)
    private documentChunkRepository: Repository<DocumentChunk>,

    @InjectRepository(DocumentPages)
    private documentPagesRepository: Repository<DocumentPages>,
  ) {}

  

  private toPgVector(values: number[]): string {
    return `[${values.join(',')}]`;
  }

  

  async retrieveRelevantChunks(query: string, documentId: number) {
   
    const embeddingResponse = await this.ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: query,
    });

    if (!embeddingResponse.embeddings?.length) {
      throw new Error('Failed to generate query embedding');
    }

    const values = embeddingResponse.embeddings[0].values;
    if (!values) {
      throw new Error('Failed to generate query embedding values');
    }

    const queryVector = this.toPgVector(values);

    
    const rawChunks = await this.documentChunkRepository.query(
      `
      SELECT
        dc.id,
        dc.chunk_text,
        dc.section_title,
        dc.page_start,
        dc.page_end,
        dc.chunk_index,
        dc.created_on,
        dc.token_count,
        1 - (dp.embedding <=> $1) AS similarity
      FROM document_chunks dc
      INNER JOIN chunk_embeddings dp
        ON dp.chunk_id = dc.id
      WHERE dc.document_id = $2
        AND dc.status = 'EMBEDDED'
        AND dp.model_name = $3
        AND (1 - (dp.embedding <=> $1)) >= $4
      ORDER BY dp.embedding <=> $1
      LIMIT 30;
      `,
      [queryVector, documentId, 'gemini-embedding-001', SIMILARITY_FLOOR],
    );

   
    const { diverseChunks, traces } =
      this.applyDiversityWithTrace(rawChunks);

    
    const rankedChunks = this.applyFreshnessBias(diverseChunks, traces);

 
    const finalChunks = this.finalSelectWithTrace(
      rankedChunks,
      traces,
    );

    
    const prompt = await this.generatePrompt(finalChunks, query);
    const answer = await this.generateAnswer(prompt);

    return {
      answer,
      trace: traces, // return only in debug mode if needed
    };
  }

  

  private applyDiversityWithTrace(chunks: any[]) {
    const selected: any[] = [];
    const traces: RetrievalTrace[] = [];

    const pageCount = new Map<number, number>();
    const sectionCount = new Map<string, number>();

    for (const chunk of chunks) {
      let rejectionReason: RetrievalTrace['rejectionReason'];

      const pageKey = chunk.page_start;
      if ((pageCount.get(pageKey) ?? 0) >= MAX_PER_PAGE) {
        rejectionReason = 'PAGE_DIVERSITY';
      }

      const sectionKey = chunk.section_title ?? 'UNKNOWN';
      if (
        !rejectionReason &&
        (sectionCount.get(sectionKey) ?? 0) >= MAX_PER_SECTION
      ) {
        rejectionReason = 'SECTION_DIVERSITY';
      }

      const accepted = !rejectionReason;

      traces.push({
        chunkId: chunk.id,
        similarity: chunk.similarity,
        freshnessPenalty: 0,
        finalScore: 0,
        pageStart: chunk.page_start,
        sectionTitle: chunk.section_title,
        selected: accepted,
        rejectionReason,
      });

      if (accepted) {
        selected.push(chunk);
        pageCount.set(pageKey, (pageCount.get(pageKey) ?? 0) + 1);
        sectionCount.set(
          sectionKey,
          (sectionCount.get(sectionKey) ?? 0) + 1,
        );
      }
    }

    return { diverseChunks: selected, traces };
  }

  

  private applyFreshnessBias(
    chunks: any[],
    traces: RetrievalTrace[],
  ) {
    const now = Date.now();

    const ranked = chunks.map((chunk) => {
      const ageInDays =
        (now - new Date(chunk.created_on).getTime()) /
        (1000 * 60 * 60 * 24);

      const freshnessPenalty =
        Math.log(ageInDays + 1) * FRESHNESS_WEIGHT;

      const finalScore = chunk.similarity - freshnessPenalty;

      const trace = traces.find((t) => t.chunkId === chunk.id);
      if (trace) {
        trace.freshnessPenalty = freshnessPenalty;
        trace.finalScore = finalScore;
      }

      return {
        ...chunk,
        finalScore,
      };
    });

    return ranked.sort((a, b) => b.finalScore - a.finalScore);
  }

  

  private finalSelectWithTrace(
    chunks: any[],
    traces: RetrievalTrace[],
  ) {
    let usedTokens = PROMPT_OVERHEAD;
    const final: any[] = [];

    for (const chunk of chunks) {
      if (usedTokens + (chunk.token_count ?? 0) > MAX_CONTEXT_TOKENS) {
        const trace = traces.find((t) => t.chunkId === chunk.id);
        if (trace) {
          trace.selected = false;
          trace.rejectionReason = 'TOKEN_LIMIT';
        }
        continue;
      }

      final.push(chunk);
      usedTokens += chunk.token_count ?? 0;
    }

    return final;
  }

  

  async generatePrompt(
    chunks: { chunk_text: string; section_title?: string }[],
    query: string,
  ) {
    if (!chunks.length) {
      return `
You are a technical assistant.
No relevant documentation was found for the user's question.

User Question:
${query}

Answer:
State clearly that the information is not available in the provided documents.
`;
    }

    const context = chunks
      .map((chunk, i) => {
        const title = chunk.section_title
          ? `Section: ${chunk.section_title}\n`
          : '';
        return `### Source ${i + 1}\n${title}${chunk.chunk_text}`;
      })
      .join('\n\n');

    return `
You are a senior technical assistant.

Answer the user's question using **only** the information from the sources below.
If the answer is not present in the sources, say:
"The provided documents do not contain this information."

${context}

---

User Question:
${query}

Answer:
Provide a clear, precise answer.
Cite sources using [Source X] notation.
`;
  }

 

  async generateAnswer(prompt: string) {
    const result = await this.ai.models.generateContent({
      model: 'models/gemini-2.5-flash',
      contents: prompt,
    });

    return result.text;
  }
}
