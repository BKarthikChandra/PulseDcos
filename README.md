Here is the complete text with all Markdown formatting removed:

AIRS - Artifact Ingestion & Retrieval System

A backend system that ingests PDF documents, processes them through an asynchronous pipeline, and enables semantic search with vector embeddings and explainable retrieval.

What Problem Does It Solve?

AIRS solves the challenge of building a production-grade document RAG system that is:
- Retry-safe - Handles failures without corrupting data
- Explainable - Every retrieval decision is traceable
- Quality-controlled - No hallucination; system abstains when context is insufficient

Tech Stack

- NestJS + TypeScript - Backend framework
- PostgreSQL + pgvector - Database with vector search
- TypeORM - Database ORM
- Bull + Redis - Job queue for async processing
- Google Gemini API - LLM (gemini-2.5-flash) and embeddings (gemini-embedding-001)
- pdf-parse + pdfjs-dist - PDF processing

Prerequisites

- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- Redis 6+
- Google Gemini API key

Install pgvector

Ubuntu/Debian
sudo apt-get install postgresql-14-pgvector

macOS
brew install pgvector

Enable in your database:
CREATE EXTENSION vector;

Installation & Setup

Clone repository
git clone https://github.com/BKarthikChandra/airs.git
cd airs

Install dependencies
npm install

Configure environment
cp .env.example .env
Edit .env with your database, Redis, and Gemini API credentials

Setup database
psql -U postgres -c "CREATE DATABASE airs_db;"
psql -U postgres -d airs_db -c "CREATE EXTENSION vector;"

Run migrations
npm run migration:run

Running the Application

Development mode (with hot-reload)
npm run start:dev

Production mode
npm run build
npm run start:prod

The API will be available at http://localhost:5000

API Documentation: http://localhost:5000/api (Swagger)

Documentation

- Architecture Overview - System design and guarantees
  https://github.com/BKarthikChandra/airs/blob/main/docs/architecture_current.md

