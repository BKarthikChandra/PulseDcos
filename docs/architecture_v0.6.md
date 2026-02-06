PulseDocs — Architecture (v0.6)

1. System Purpose

PulseDocs is a backend system that ingests PDF documents, processes them asynchronously through a staged pipeline, and enables explainable, vector-based retrieval of document content with explicit source attribution.

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

6. Retrieval & Response Flow (Quality-Controlled & Explainable)

6.1 Query Processing

Inputs

User query
Document ID
Embedding model (config-driven)

Responsibilities

Embed query using selected model
Perform vector similarity search over chunk_embeddings scoped to the model
Join embeddings → chunks for content retrieval

Guarantee
Retrieval correctness depends only on persisted embeddings, never on document state.

6.2 Retrieval Quality Controls (v0.6 Core Addition)

Retrieval is treated as a policy-driven selection process, not a raw top-K similarity lookup.

The retrieval pipeline enforces the following stages:

Candidate Generation

Over-fetch semantically relevant chunks (similarity-ranked) to allow downstream selection policies.

Relevance Gate

A minimum similarity threshold is enforced.
If no chunks pass the threshold, the system explicitly abstains from answering.

Diversity Enforcement

To prevent single-section or single-page dominance:

Maximum chunks per page
Maximum chunks per logical section

This ensures broad contextual coverage and surfaces conflicting sources when present.

Freshness Bias

When multiple chunks are similarly relevant, newer content is softly preferred.
Freshness is applied as a tie-breaker and never overrides semantic relevance.

Final Selection (Hard Constraints)

A token-aware final selection step enforces:

Maximum context token budget
Prompt overhead reservation

This guarantees prompt safety and predictable latency.

Explanation Tracing (Deterministic)

For every retrieved chunk, the system records:

similarity score
freshness penalty
final score
selection or rejection reason

This enables post-hoc explanation of retrieval behavior independent of the LLM.

Guarantee

Bad answers are diagnosable at the retrieval layer without attributing failures to generation.

6.3 Prompt Construction

Chunks selected by retrieval are:

ordered deterministically,
annotated with explicit source identifiers, and
formatted into a bounded prompt context.

If no eligible chunks remain after quality controls:

"The provided documents do not contain this information."

No hallucination. No silent failure.

6.4 LLM Response Layer

Responsibilities

Generate answers strictly from supplied context
Provide citations

Constraints

Stateless
Replaceable
No access to storage or embeddings

7. Failure Scenarios (Handled in v0.6)

Job retries at any ingestion stage
Partial embedding batch failures
Duplicate embed job execution
External API call repetition
Missing or stale embeddings
Retrieval attempted before embeddings exist
Low-relevance queries with no eligible context

All failures converge without mutating semantic truth.

8. Known Limitations (Explicit)

v0.6 intentionally does not yet support:

Automatic embedding invalidation
Re-embedding triggers
Multiple active retrieval models
Hybrid (BM25 + vector) retrieval
Cross-document retrieval
Retrieval evaluation metrics

These are deferred to later versions.

9. Summary

PulseDocs v0.6 extends the system from correct retrieval to controlled, explainable retrieval.

Key guarantees now include:

Semantic content remains immutable truth
Embeddings remain replaceable, model-scoped representations
Retrieval decisions are policy-driven, bounded, and traceable

At this point, removing or replacing the LLM does not reduce the system's architectural value.