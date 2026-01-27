
PulseDocs — Current Architecture (v0.4)

1. System Purpose

PulseDocs is a backend system that ingests PDF documents, processes them asynchronously through a staged pipeline, and enables vector-based retrieval of document content with explicit source attribution.

The system is designed to:

decouple user-facing latency from heavy processing,
tolerate retries and partial failures without corrupting state,
and ensure deterministic convergence of ingestion results.

LLMs are used only as a response layer and do not participate in ingestion, storage, or retrieval decisions.

2. High-Level Architecture Overview

The system consists of three major subsystems:

1. Ingestion Pipeline — asynchronous, state-driven, retry-safe document processing
2. Storage Layer — relational source of truth with derived, replaceable embeddings
3. Retrieval & Response Layer — vector-based context retrieval with constrained generation

Processing is orchestrated using a queue-based pipeline to allow concurrent ingestion while preserving correctness under retries and failures.

3. Document Lifecycle & State Machine

Each document progresses through a linear, state-driven lifecycle.
States act as coarse execution gates, while correctness is enforced through idempotent writes and database constraints.

Document States

UPLOADED
→ PROCESSING
→ EXTRACTED
→ CLEANED
→ CHUNKED
→ EMBEDDED

State transitions indicate stage completion but are not relied upon as proof of work completion.

4. Ingestion Pipeline (Retry-Safe)

4.1 Upload Stage

Trigger
User uploads a PDF via /document/upload.

Responsibilities

Accept PDF file
Persist file to local storage
Create a document record

Outputs

Document metadata (name, path, MIME type, size)
Initial document state: UPLOADED

Design Rationale

Upload requests return immediately
No heavy processing in request lifecycle
Supports high concurrency safely

4.2 Extraction Stage (Idempotent)

Trigger
Asynchronous extractJob enqueued after upload.

Input Constraints

Document must exist
Document must not be beyond extraction stage

Responsibilities

Parse PDF into page-level text
Persist extracted pages using idempotent upserts

Correctness Strategy

Each page is uniquely identified by (document_id, page_number)
Database-level unique constraint enforces page identity
Extraction uses upsert semantics to tolerate retries and partial failures

Outputs

Page entities with raw text and content hash
Document state updated to EXTRACTED

Guarantee

Re-running extraction for the same document always converges to the same set of pages without duplication.

4.3 Cleaning Stage (Page-Idempotent)

Trigger
Asynchronous processJob after extraction.

Input Constraints

Document state must be EXTRACTED

Responsibilities

Normalize Unicode
Remove formatting noise
Merge wrapped lines
Produce cleaned text per page

Correctness Strategy

Cleaning is a deterministic, pure transformation
Only existing page records are updated
No new rows are created

Outputs

Cleaned text and cleaned hash persisted per page
Document state updated to CLEANED

Guarantee

Cleaning can be retried arbitrarily and always converges for unchanged raw input.

4.4 Chunking Stage (Content-Idempotent)

Trigger
Continuation of processJob after cleaning.

Responsibilities

Split cleaned content into semantic chunks
Enforce token limits
Preserve page boundaries and ordering

Chunk Identity
Each chunk is identified by a content-derived hash computed from:

chunk text
page start
page end
chunk index

Correctness Strategy

Unique constraint on (document_id, chunk_hash)
Chunk creation uses upsert semantics
Entire chunk set is recomputed on each run

Outputs

Chunk records persisted
Document state updated to CHUNKED

Guarantee

Chunking is deterministic and retry-safe. Re-running chunking converges to the same chunk set for unchanged cleaned pages.

4.5 Embedding Stage (Chunk-Level Idempotent)

Trigger
Asynchronous embedJob enqueued after chunking.

Input Constraints

Document state must be CHUNKED
Only chunks without persisted embeddings are processed

Responsibilities

Batch chunks for embedding
Generate vector embeddings
Persist embeddings atomically with completion status

Correctness Strategy

Embedding completion is tracked per chunk
Database state is the source of truth
Retries resume incomplete work rather than restarting

Outputs

Vector embeddings persisted
Chunk status updated to EMBEDDED
Document state updated to EMBEDDED when complete

Guarantee

Embedding retries may repeat external API calls, but persisted state always converges correctly without duplication.

5. Storage Model

5.1 PostgreSQL (Source of Truth)

PostgreSQL stores all authoritative state:

Documents
Pages (raw + cleaned text)
Chunks
Processing states
Embeddings (single model, current version)

Relational constraints enforce:

identity
idempotency
lineage

5.2 Redis (Infrastructure Support)

Redis is used for:

queue coordination
worker concurrency
retry orchestration

Redis does not store domain truth and does not influence correctness decisions.

6. Retrieval & Response Flow

6.1 Query Processing

Inputs

User query
Target document ID

Responsibilities

Embed query
Perform vector similarity search over embedded chunks
Retrieve top-K most relevant chunks

Constraints

Retrieval scoped to a single document
Vector similarity only

6.2 Prompt Construction

Chunks ordered by similarity
Explicit source identifiers included
Clear fallback when no relevant context is found

6.3 LLM Response Layer

Responsibilities

Generate answers strictly from provided context
Provide source citations

Constraints

Stateless
Replaceable
No access to raw data

7. Failure Scenarios (Handled in v0.4)

Concurrent uploads
Partial extraction or chunking
Job retries at any stage
Partial embedding failures
External API call duplication
No-retrieval scenarios

All failures converge to a correct final state.

8. Known Limitations (Explicit)

This version does not yet support:

Document versioning or re-ingestion
Hybrid retrieval (BM25 + vector)
Cross-document retrieval
Multiple embedding models
Conflict resolution across sources
Retrieval evaluation metrics

These are intentionally deferred.

9. Summary

PulseDocs v0.4 is a retry-safe, state-driven knowledge ingestion and retrieval system.

Compared to v0.3, v0.4 adds:

explicit idempotency guarantees,
deterministic convergence under failure,
and correctness independent of job execution order.

The system treats AI components as replaceable, while correctness and data ownership remain centralized and verifiable.