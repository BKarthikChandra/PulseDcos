DIRS (Document Ingestion & Retrieval System) —  Architecture (v0.5)

1. System Purpose

DIRS is a backend system that ingests PDF documents, processes them asynchronously through a staged pipeline, and enables explainable, vector-based retrieval of document content with explicit source attribution.

The system is designed to:

decouple user-facing latency from heavy processing,
tolerate retries and partial failures without corrupting state,
separate semantic truth from derived representations, and
allow embedding strategies to evolve independently of content.

LLMs are used only as a response layer and never participate in ingestion, storage, or retrieval decisions.

2. High-Level Architecture Overview

The system consists of three major subsystems:

1. Ingestion Pipeline — asynchronous, idempotent, state-driven processing
2. Storage Layer — relational source of truth with explicitly derived embeddings
3. Retrieval & Response Layer — model-scoped vector retrieval with constrained generation

Processing is orchestrated using a queue-based pipeline to allow concurrent ingestion while preserving correctness under retries and failures.

3. Document Lifecycle & State Semantics

Each document progresses through a linear ingestion lifecycle.
Document state represents semantic readiness, not representation completeness.

Document States

UPLOADED
→ PROCESSING
→ EXTRACTED
→ CLEANED
→ CHUNKED
→ EMBEDDED

All vector representations are treated as independent, derived artifacts.

4. Ingestion Pipeline (Retry-Safe & Deterministic)

4.1 Upload Stage

Trigger
User uploads a PDF via /document/upload.

Responsibilities

Accept PDF file
Persist file to local storage
Create document record

Outputs

Document metadata
Initial document state: UPLOADED

Guarantee
Upload is fast, concurrency-safe, and never blocked by downstream processing.

4.2 Extraction Stage (Idempotent)

Trigger
Asynchronous extractJob.

Correctness Strategy

Each page identified by (document_id, page_number)
Database-level unique constraint
Upsert semantics

Guarantee
Extraction can be retried arbitrarily and always converges to the same page set.

4.3 Cleaning Stage (Deterministic)

Trigger
Asynchronous processJob.

Correctness Strategy

Cleaning is a pure, deterministic transformation
Same input → same output
No row creation

Guarantee
Cleaning retries are safe and non-destructive.

4.4 Chunking Stage (Content-Idempotent)

Trigger
Continuation of processJob.

Chunk Identity
Each chunk is uniquely identified by a content-derived hash computed from:

cleaned chunk text
page start / end
chunk index

Correctness Strategy

Unique constraint on (document_id, chunk_hash)
Upsert-based persistence

Outputs

Immutable semantic chunks
Document state updated to CHUNKED

Guarantee
Chunking retries converge to the same chunk set for unchanged content.

5. Embedding Subsystem (v0.5 Core Change)

5.1 Separation of Concerns (Key v0.5 Guarantee)

Chunks represent semantic truth.
Embeddings represent model-scoped, derived views of that truth.

Chunks are immutable once created.
Embeddings are replaceable, versionable, and independently managed.

5.2 Embedding Storage Model

document_chunks (Semantic Truth)

Stores:

chunk text
structural metadata
content identity

Does NOT store:

vectors
model information
embedding status

chunk_embeddings (Derived Data)

Each row represents one embedding of one chunk using one model.

Identity

(chunk_id, model)

Some Important Fields

chunk_id (FK)
model
vector


Hard Constraint

UNIQUE (chunk_id, model)

This enforces idempotency and prevents duplicate embeddings.

5.3 Embedding Pipeline (Model-Scoped & Idempotent)

Trigger
Asynchronous embedJob, parameterized by model.

Responsibilities

Discover chunks without embeddings for the target model
Generate embeddings in batches
Persist embeddings atomically

Correctness Strategy

Embedding completion tracked per (chunk, model)
Re-runs skip completed work
Partial failures resume safely

Guarantee
Re-embedding never mutates chunk truth and always converges correctly.

6. Retrieval & Response Flow (Model-Aware)

6.1 Query Processing

Inputs

User query
Document ID
Embedding model (config-driven)

Responsibilities

Embed query using selected model
Perform vector similarity search only over EMBEDDED chunk_embeddings
Join embeddings → chunks for content

Guarantee
Retrieval correctness depends only on persisted embeddings, never on document state.

6.2 Prompt Construction

Chunks ordered by similarity
Explicit source references
Clear fallback when no embeddings exist

If embeddings are missing:

"This document has not been indexed for the selected retrieval model."

No hallucination. No silent failure.

6.3 LLM Response Layer

Responsibilities

Generate answers strictly from supplied context
Provide citations

Constraints

Stateless
Replaceable
No access to storage or embeddings

7. Failure Scenarios (Handled in v0.5)

Job retries at any ingestion stage
Partial embedding batch failures
Duplicate embed job execution
External API call repetition
Missing or stale embeddings
Retrieval attempted before embeddings exist

All failures converge without mutating semantic truth.

8. Known Limitations (Explicit)

v0.5 intentionally does not yet support:

Automatic embedding invalidation
Re-embedding triggers
Multiple active retrieval models
Hybrid (BM25 + vector) retrieval
Cross-document retrieval
Retrieval evaluation metrics

These are deferred to later versions.

9. Summary

DIRS v0.5 introduces a critical architectural correction:

Semantic content is immutable truth
Vector embeddings are explicitly derived, model-scoped data
Re-embedding is safe, auditable, and non-destructive

Compared to v0.4, v0.5 adds:

structural separation of truth vs representation,
clean model migration paths,
and correctness guarantees that hold over time.

At this point, removing or replacing the LLM does not reduce the system's architectural value.