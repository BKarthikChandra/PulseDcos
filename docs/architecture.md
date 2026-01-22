PulseDocs — Current Architecture (v0.3)
1. System Purpose
PulseDocs is a backend system that ingests PDF documents, processes them asynchronously through a staged pipeline, and enables vector-based retrieval of document content with explicit source attribution.
The system is designed to decouple user-facing latency from heavy processing, ensure pipeline safety under concurrent uploads, and maintain clear state transitions across ingestion stages.
LLMs are used only at the response layer and do not participate in ingestion, storage, or retrieval decisions.

2. High-Level Architecture Overview
The system is composed of three major subsystems:
Ingestion Pipeline — asynchronous, state-driven document processing
Storage Layer — relational source of truth with derived embeddings
Retrieval & Response Layer — vector-based context retrieval with constrained generation
Processing is orchestrated via a queue-based pipeline, allowing multiple documents to be ingested concurrently without blocking API requests.

3. Document Lifecycle & State Machine
Each document progresses through a linear, state-driven lifecycle.
State transitions act as pipeline gates, ensuring stages execute in the correct order.
Document States
UPLOADED
→ PROCESSING
→ EXTRACTED
→ CLEANED
→ CHUNKED
→ EMBEDDED

Each state corresponds to the successful completion of a pipeline stage.
Jobs validate the current state before execution to prevent out-of-order processing.

4. Ingestion Pipeline
4.1 Upload Stage
Trigger:
User uploads a PDF via /document/upload.
Responsibilities:
Accept PDF file
Persist file to local storage
Create a document record in the database
Outputs:
Document metadata (name, path, MIME type, size)
Initial document state: UPLOADED
Design Rationale:
Upload endpoint returns immediately
No heavy processing occurs in request lifecycle
Enables high concurrency for uploads

4.2 Extraction Stage
Trigger:
Asynchronous extractJob enqueued after upload.
Input Constraints:
Document must exist
Document state must be UPLOADED
Responsibilities:
Parse PDF into page-level text
Normalize extracted text at page granularity
Persist raw pages to the database
Outputs:
Page entities containing raw extracted text
Document state updated to EXTRACTED
Failure Behavior:
Job retries with exponential backoff
Document remains in pre-extraction state on failure
Design Rationale:
Page-level persistence enables downstream cleaning and chunk lineage
Extraction isolated from cleaning and chunking for clearer failure boundaries

4.3 Cleaning & Chunking Stage
Trigger:
Asynchronous processJob enqueued after extraction.
Cleaning Phase
Input Constraints:
Document state must be EXTRACTED
Responsibilities:
Normalize Unicode
Remove formatting noise and excessive whitespace
Merge wrapped lines
Produce clean, readable text per page
Outputs:
Cleaned text persisted per page
Document state updated to CLEANED

Chunking Phase
Responsibilities:
Split cleaned content into semantic chunks
Enforce maximum token limits per chunk
Preserve page boundaries and ordering metadata
Chunk Metadata Includes:
Chunk index
Page start / end
Token count
Processing status
Outputs:
Chunk records persisted
Document state updated to CHUNKED
Design Rationale:
Chunking performed after cleaning to avoid embedding noise
Token-aware chunking ensures safe downstream embedding

4.4 Embedding Stage
Trigger:
Asynchronous embedJob enqueued after chunking.
Input Constraints:
Document state must be CHUNKED
Chunks must be in PENDING state
Responsibilities:
Batch chunks for embedding
Generate embeddings using a dedicated embedding model
Validate embedding responses before persistence
Atomically update chunk records
Outputs:
Vector embeddings stored alongside chunks
Chunk status updated to EMBEDDED
Document state updated to EMBEDDED once all chunks complete
Failure Behavior:
Batch-level retries
Partial batch failure does not corrupt completed chunks
Design Rationale:
Embeddings treated as derived data
Atomic batch updates prevent partial corruption
Batching controls memory and API limits

5. Storage Model
5.1 PostgreSQL (Source of Truth)
PostgreSQL stores all authoritative data:
Documents
Pages
Cleaned text
Chunks
Processing states
Embeddings (current version)
Relational storage enables:
Deterministic lineage
Explicit state validation
Safe reprocessing in future iterations

5.2 Redis (Infrastructure Support)
Redis is used for:
Queue coordination
Worker concurrency safety
Infrastructure-level reliability
Redis currently does not store domain truth and does not influence retrieval correctness.

6. Retrieval & Response Flow
6.1 Query Processing
Inputs:
User query
Target document ID
Responsibilities:
Embed user query using the same embedding model
Perform vector similarity search against embedded chunks
Retrieve top-K most similar chunks
Constraints:
Retrieval scoped to a single document
Vector similarity only (no hybrid filtering yet)

6.2 Prompt Construction
Retrieved chunks are:
Ordered by similarity
Formatted with explicit source identifiers
Injected into a constrained prompt
If no relevant chunks are found, the system explicitly states that the information is unavailable.

6.3 LLM Response Layer
Responsibilities:
Generate a natural language answer
Cite sources using provided chunk identifiers
Avoid hallucination beyond supplied context
Constraints:
LLM has no access to raw documents or embeddings
Stateless and replaceable

7. Failure Scenarios (Currently Handled)
Concurrent document uploads without request blocking
Partial embedding batch failure
Missing or invalid embedding responses
No-retrieval scenarios

8. Known Limitations (Explicit)
This version does not yet support:
Document versioning or re-ingestion
Idempotent stage replay guarantees
Hybrid (BM25 + vector) retrieval
Cross-document retrieval
Embedding model versioning
Conflict resolution across sources
Evaluation metrics or benchmarks
These limitations are acknowledged and intentionally deferred.

9. Summary
PulseDocs v0.3 is a state-driven, asynchronous document ingestion and retrieval system designed with production safety and extensibility in mind.
The system prioritizes:
Correctness over novelty
Clear data ownership
Explicit pipeline boundaries
Replaceable AI components
Future iterations will focus on idempotency, versioning, retrieval quality, and evaluation rigor.


