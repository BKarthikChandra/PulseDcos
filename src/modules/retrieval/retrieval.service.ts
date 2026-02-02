import { Injectable } from '@nestjs/common';
import { Document } from 'src/entities/document.entity';
import { DocumentChunk } from 'src/entities/document.chunks.entity';
import { DocumentPages } from 'src/entities/document.pages.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class RetrievalService {
  private readonly ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    // 1️⃣ Embed the query
    const embeddingResponse = await this.ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: query,
    });

    if (
      !embeddingResponse.embeddings ||
      embeddingResponse.embeddings.length === 0
    ) {
      throw new Error('Failed to generate embedding for query');
    }

    const queryVector = this.toPgVector(
      embeddingResponse.embeddings[0].values || [],
    );

    // 2️⃣ Similarity search in Postgres using pgvector
    const chunks = await this.documentChunkRepository.query(
      `
     SELECT
  dc.chunk_text,
  dc.section_title,
  dc.chunk_index,
  1 - (dp.embedding <=> $1) AS similarity
FROM document_chunks dc
INNER JOIN chunk_embeddings dp
  ON dp.chunk_id = dc.id
WHERE dc.document_id = $2
  AND dc.status = 'EMBEDDED'
  AND dp.model_name = $3
ORDER BY dp.embedding <=> $1
LIMIT 5;
      `,
      [queryVector, documentId, 'gemini-embedding-001'],
    );

    const prompt = await this.generatePrompt(chunks, query);

    const answer = await this.generateAnswer(prompt);
    return { answer };
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

    const prompt = `
You are a senior technical assistant.

Answer the user's question using **only** the information from the sources below.
If the answer is not present in the sources, say: "The provided documents do not contain this information."

${context}

---

User Question:
${query}

Answer:
Provide a clear, precise answer.
Cite sources using [Source X] notation.
`;

    return prompt;
  }

  async generateAnswer(prompt: string) {
    const result = await this.ai.models.generateContent({
      model: 'models/gemini-2.5-flash',
      contents: prompt,
    });

    return result.text;
    //  const models = await this.ai.models.list();
    //  return models;
  }
}
