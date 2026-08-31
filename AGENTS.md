# Software Design Patterns and Engineering Standards

**Project-specific context (read first):** [`docs/context/README.md`](docs/context/README.md) — decisions, architecture, what is already built, contracts, and WBS ownership. This file is the generic pattern guide; do not use it to invent a second folder layout.

This document defines the design patterns, architectural principles, and coding standards that agents must follow when contributing to this codebase or any project that adopts this guide. The goal is to produce code that is **testable**, **scalable**, **maintainable**, and **consistently structured**.

---

## Core Principles

1. **Program to interfaces, not implementations.** Every dependency a class consumes should be typed as an abstraction (interface or abstract class), never a concrete class.
2. **Single Responsibility.** Each class, module, and function should have exactly one reason to change.
3. **Open/Closed.** Classes should be open for extension but closed for modification. Favor adding new implementations over editing existing ones.
4. **Favor composition over inheritance.** Use inheritance only for genuine "is-a" relationships and template method hierarchies. Prefer injecting collaborators for "has-a" relationships.
5. **Keep constructors simple.** Constructors should assign dependencies, not perform work. Move initialization logic to factory methods or lifecycle hooks.
6. **Root-cause over bandaids.** When a failure mode appears (timeouts, truncated AI output, stuck job status, wasted retries), fix the architecture and policy — do not paper over it with identical retries, silent catches, or one-off scripts. Ask: what invariant was missing, and how do we enforce it for every future job of this shape?
7. **Cost and time are first-class constraints.** Calls to paid / rate-limited providers (Anthropic, etc.) burn money and wall-clock on every attempt. Treat token budget, latency, and retry policy as part of the design, not afterthoughts.

---

## Required Patterns

### 1. Dependency Injection and Inversion of Control

All services and business-logic classes must receive their dependencies through constructor parameters typed as interfaces. No class should instantiate its own collaborators with `new ConcreteClass()` inline.

**Structure:**
- Define an interface for each dependency (e.g., `UserDao`, `SessionDao`).
- Implement the interface in a concrete class (e.g., `UserDynamoDao`).
- Inject via constructor: the consuming class never imports or references the concrete implementation.
- Wire everything together in a single composition root (a factory or entry point), which is the only place that knows about concrete types.

**Why:** This makes every class independently testable by substituting mock/stub implementations, and allows swapping infrastructure (e.g., DynamoDB to PostgreSQL) without touching business logic.

---

### 2. Abstract Factory

Use an abstract factory interface to group related dependency creation. A single factory implementation binds all abstractions to their concrete types.

**Structure:**
- Define a `DaoFactory` (or similar) interface with one `create*()` method per dependency.
- Implement it once per infrastructure target (e.g., `DynamoDaoFactory`).
- Services receive the factory and call its methods — they never know which concrete DAO they get.

**Why:** Adding a new persistence backend means writing one new factory implementation. No service code changes.

---

### 3. Singleton (for Factories and Shared Infrastructure)

Use the singleton pattern sparingly and only for stateless factories, connection pools, or SDK clients that are expensive to construct and safe to share.

**Structure:**
- Private constructor, static `instance` getter with lazy initialization.
- Never use singletons for stateful business objects.

**Why:** Avoids redundant construction of heavy resources (database clients, HTTP clients) while keeping a single composition root.

---

### 4. Template Method

Use an abstract base class to define the skeleton of an algorithm, deferring specific steps to subclasses.

**Structure:**
- Base class implements the invariant workflow (error handling, loading states, pagination loops).
- Subclasses override abstract methods or supply callbacks for the parts that vary.
- The base class calls those hooks at the right points in the workflow.

**Common applications:**
- **Presenter base classes:** A `doFailureReportingOperation()` method wraps any async operation with try/catch and standardized error display. Subclasses pass their specific logic as the operation.
- **Paged data loading:** A `loadMoreItems()` method handles pagination state and view updates. Subclasses implement `getMoreItems()` and `itemDescription`.
- **Authentication flows:** A `doAuthenticate()` method handles loading states and navigation. Subclasses supply the specific auth function (login vs. register).

**Why:** Eliminates duplicated boilerplate across similar operations. Adding a new feature means implementing only the varying steps.

---

### 5. Model-View-Presenter (MVP)

Separate UI rendering from presentation logic so that presenters can be unit-tested without a DOM or framework.

**Structure:**
- **View interface:** Declares UI callbacks (`displayErrorMessage`, `setIsLoading`, `addItems`, `navigate`). Each feature defines its own View interface.
- **Presenter:** Holds a View reference (constructor-injected). Contains all presentation logic — state management, service calls, error handling. Never imports UI framework types.
- **View implementation:** The UI component (React component, mobile view controller, etc.) implements the View interface by wiring its state setters to the interface methods. Constructs the Presenter and passes `this` (or a listener object).

**Rules:**
- Presenters must be framework-agnostic. No React hooks, no DOM APIs, no framework imports inside presenters.
- All user-initiated actions flow through the Presenter. Views never call services directly.
- View interfaces should be minimal — only the callbacks the Presenter actually needs.

**Why:** Presenters become trivially testable with mock views. UI framework migrations only require rewriting View implementations.

---

### 6. Facade

Provide a simplified, unified interface over a complex subsystem so that callers don't need to understand internal details.

**Structure:**
- **Network facade:** A single class exposes high-level methods (`login`, `postStatus`, `loadMoreFeedItems`). Internally it builds request objects, calls the HTTP client, checks responses, and deserializes results.
- **Service facade:** On the server, a service class orchestrates multiple DAOs, authorization checks, and side effects (queues, notifications) behind a single method call.

**Rules:**
- Facade methods should map 1:1 to use cases, not to raw API endpoints or database operations.
- Internal subsystem classes (HTTP clients, serializers, DAOs) should not be exposed to callers.

**Why:** Reduces coupling between layers. Changes to the network protocol or data format are contained within the facade.

---

### 7. Adapter

Convert the interface of one system into the interface another system expects.

**Structure:**
- **Network adapter:** Wraps a low-level HTTP client (e.g., `fetch`) and exposes a typed `doPost<REQ, RES>()` method. Handles URL construction, headers, JSON serialization, and error normalization.
- **Serialization adapter:** Converts raw JSON objects from API responses into typed domain objects (e.g., a `Serde` module with `toUser()`, `toStatus()` functions).

**Why:** Isolates third-party API details. If the HTTP library or wire format changes, only the adapter is modified.

---

### 8. Strategy

Define a family of interchangeable algorithms behind a common interface. Select the implementation at runtime or construction time.

**Structure:**
- Define an interface for the varying behavior.
- Implement each variant as a separate class.
- Inject the chosen implementation into the consumer.

**Overlap with DI:** In this codebase, Strategy and DI work together — DAO interfaces are strategies for data access, and the factory injects the chosen strategy.

**Why:** New algorithms (caching strategies, sorting, different auth providers) are added without modifying consumers.

---

### 9. Observer / Event-Driven (for Async Workflows)

For operations that trigger downstream work (e.g., posting a status that must update thousands of feeds), use message queues to decouple the producer from consumers.

**Structure:**
- **Producer:** After completing the primary write, sends a message to a queue with the relevant data.
- **Consumer:** A separate handler (Lambda, worker) processes messages independently.
- **Fan-out:** If the downstream work is large (e.g., many followers), the first consumer pages through the work and sends smaller batches to a second queue.

**Rules:**
- Messages must be self-contained — include all data the consumer needs without requiring additional lookups when possible.
- Consumers must be idempotent — processing the same message twice should produce the same result.
- Use exponential backoff and retry logic for throttled downstream services.

**Why:** Decouples write latency from fan-out scope. The user gets a fast response while background workers handle distribution.

---

## Throttling, Resilience, and External / AI APIs

When writing to rate-limited services (DynamoDB, external APIs), follow these rules:

1. **Batch within limits.** Respect service batch-size limits (e.g., DynamoDB's 25-item BatchWrite limit). Chunk larger lists.
2. **Retry unprocessed items with exponential backoff.** Start with a small delay (e.g., 100ms), double on each retry, cap at a maximum (e.g., 1-2 seconds).
3. **Throttle between batches.** Add a fixed delay between successful batch calls to stay within provisioned throughput.
4. **Never silently drop failures.** Log or re-throw after exhausting retries.

### AI and paid-provider calls (mandatory)

Invoice generation, field-doc extraction, and similar Claude calls are expensive and slow on large mitigation jobs. Agents must treat the following as hard requirements:

1. **Retry only when the next attempt can differ.** Never loop the same prompt / same `max_tokens` / same mode after a deterministic failure (truncated tool payload, invalid schema, already-compact packet). If the strategy cannot change, fail fast and persist a clear `failureReason`.
2. **Classify failures; do not use a blind `MAX_RETRIES` hammer.** Separate transient (rate limit, overload, one connection blip) from fatal (auth, credit balance, unsupported model) from strategy failures (payload / truncation). Cap transport retries tightly (typically one). Escalate output budget at most once when truncation is the cause.
3. **Instrument before you re-run.** Structured logs must include correlation id, attempt, duration, prompt size metrics (chars / approx tokens — not full prompts with PII), model, compact flag, error kind, network cause chain, and **why** a retry was or was not taken (`retryReason`). A single failed run must be diagnosable without burning another API call.
4. **Persist operator-visible failure reasons.** UI/API consumers should see the classified reason (timeout, truncation, credits, etc.), not only a generic "try again" banner.
5. **Size the request for the job.** Large field packets (many rooms / demo / daily / equipment days / rates) must auto-compact or otherwise reduce payload. Prefer summaries (`equipment_day_summary`) over redundant per-row dumps when compacting.
6. **Long generations use streaming.** Non-streaming waits for the full buffered response; idle sockets die (`read ETIMEDOUT`) on Cole-Adams-scale invoices. Stream and accumulate the final message for tool-forced calls.
7. **Disable adaptive thinking for pure tool / JSON outputs** unless thinking is explicitly required. On Sonnet 5+, thinking tokens count against `max_tokens` and will truncate line-item JSON on large jobs.
8. **Own retries in application code.** Prefer SDK `maxRetries: 0` so every attempt is logged and policy-controlled. Do not rely on opaque SDK retries that hide cost and cause.
9. **Configure budgets explicitly.** Timeouts and invoice `max_tokens` come from env with documented defaults; do not leave critical caps as magic numbers scattered in adapters.
10. **Prefer product-scale fixes.** If large jobs are common, design for that class of job (compact + stream + token ceiling + fail-fast policy), not a one-job hotfix.

### Observability minimum

- Prefer structured JSON logs (`event` + fields) over free-form `console.log` strings for server AI / invoice / generation paths.
- Never log secrets or full signed URLs. Redact API keys; log sizes and ids instead of prompt bodies when possible.
- After a user-visible failure, the next debugging step should be "read the logs / `failure_reason`" — not "run it again and hope."

---

## Testing Standards

### Unit Tests
- Mock all external dependencies using the injected interfaces.
- Test presenters by mocking the View interface and verifying method calls.
- Test services by mocking the DaoFactory and its DAOs.
- Each test should verify one behavior. Name tests descriptively: what is being tested and the expected outcome.

### Integration Tests
- Hit real deployed services (API Gateway, databases).
- Use real authentication (login to get a valid token, don't fabricate tokens).
- Handle pre-existing state gracefully (e.g., fall back to login if registration says "alias already exists").
- Set generous timeouts for tests that make multiple network calls.
- Guard with environment variables or configuration so integration tests can be toggled on/off.

### General Rules
- `await` every async call in test setup and assertions. Missing `await` on async operations is a common source of false passes.
- Prefer `toBeGreaterThanOrEqual(0)` over `toBeGreaterThan(0)` when the count depends on external state you don't control.
- Clean up test data in `afterAll` blocks (best-effort, wrapped in try/catch).

---

## Project Structure Conventions

```
project-root/
  shared/               # Domain types, DTOs, request/response contracts
  server/
    src/
      config/           # Environment-driven configuration (table names, URLs, etc.)
      dao/
        interface/      # DAO interfaces (abstractions)
        dynamodb/       # DynamoDB implementations (or any other backend)
        util/           # Shared infra clients (AWS SDK wrappers, SQS helpers)
      model/
        service/        # Business logic services, ServiceFactory
      lambda/           # Entry-point handlers (thin: parse event, call service, return response)
    scripts/            # Deployment and infrastructure shell scripts
  web/
    src/
      components/       # UI components (View implementations)
      presenter/        # Presenters and View interfaces
      model.service/    # Client-side service facades
      network/          # ServerFacade, ClientCommunicator, Serde, Endpoints
    test/
      presenter/        # Presenter unit tests
      components/       # Component/UI tests
      network/          # Network integration tests
      integration/      # End-to-end integration tests
      model.service/    # Service-layer integration tests
```

**Rules:**
- Lambda handlers must be thin. Parse the event, call a service method, format the response. No business logic in handlers.
- Configuration values come from environment variables with sensible defaults. Never hardcode infrastructure names in business logic.
- Shared domain types live in a shared package imported by both client and server.

---

## Code Style

- **No narration comments.** Don't write `// Get the user` above `getUser()`. Comments should explain *why*, not *what*.
- **Naming:** Classes are `PascalCase`. Methods and variables are `camelCase`. Constants are `UPPER_SNAKE_CASE`. Interfaces do not use `I` prefixes.
- **Error messages:** Include context about what failed and why. Prefer `Failed to post status: Unauthorized` over `Error`.
- **Async/await:** Always `await` async calls. Never fire-and-forget unless explicitly intended and documented.
- **Imports:** Group by external packages, then internal modules. No circular dependencies.