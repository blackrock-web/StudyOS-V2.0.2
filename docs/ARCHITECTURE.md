# StudyOS Desktop — Architecture & Evolution Plan

## Status

Architecture baseline: v1

Current product:

- StudyOS Desktop
- Electron
- React
- TypeScript
- Local-first
- Public GitHub repository
- GitHub Releases for application updates

RAGBook Studio exists as a separate architecture and is planned for future integration.

---

# 1. Core Architectural Principle

StudyOS Desktop is a LOCAL-FIRST desktop application.

The application must work without an internet connection.

Internet connectivity is currently used ONLY for application updates.

Current network boundary:

    StudyOS Desktop
          |
          v
    UpdateService
          |
          v
    GitHubReleaseUpdateProvider
          |
          v
    Public GitHub Releases

No other StudyOS functionality currently requires a network connection.

---

# 2. Current Architecture

    Electron
       |
       +----------------------+
       |                      |
       v                      v
    React Renderer       Electron Main
                              |
                              v
                         Secure IPC
                              |
                              v
                        Service Layer
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
          Local Data       Local AI        Updates
             |                                |
             v                                v
       User's machine                 GitHub Releases

---

# 3. Current Data Policy

StudyOS currently stores application/user data locally.

Examples:

- accounts
- study progress
- tasks
- lectures
- notes
- flashcards
- PDFs
- annotations
- analytics
- planner data
- focus sessions
- exam data

These must NOT be uploaded to GitHub.

GitHub is not a database for StudyOS user data.

---

# 4. Update Architecture

The update system uses a provider boundary.

    UpdateService
          |
          v
    UpdateProvider
          |
          v
    GitHubReleaseUpdateProvider
          |
          v
    Public GitHub Release

The rest of the application must not depend directly on GitHub.

This allows future replacement without rewriting StudyOS.

---

# 5. Release Model

Production releases use semantic versioning.

Examples:

v1.0.0
v1.0.1
v1.1.0
v2.0.0

Production releases are triggered by tags matching:

v*

Normal commits do not create production releases.

The application updates to the latest RELEASE, not the latest arbitrary Git commit.

---

# 6. Release Flow

Developer:

    npm version patch
    git push --follow-tags

GitHub:

    version tag
        |
        v
    GitHub Actions
        |
        +--> Windows build
        |
        +--> Linux AppImage build
        |
        v
    GitHub Release
        |
        v
    Update metadata + installers

Installed StudyOS:

    Check GitHub Release
          |
          v
    New version?
       /     \
     no       yes
     |         |
     v         v
  continue   download
                |
                v
             install
                |
                v
             restart

---

# 7. Security

The packaged application must NEVER contain:

- GitHub PAT
- GH_TOKEN
- private GitHub credentials
- Supabase service-role keys
- backend secrets
- API secrets

The repository is public.

Only public release information is accessed by the desktop updater.

GitHub Actions may use GitHub's temporary workflow credentials to publish releases.

Those credentials must never be bundled into the application.

---

# 8. Offline Behavior

If internet is unavailable:

StudyOS continues operating normally.

Only the updater is affected.

Possible updater states:

- checking
- upToDate
- updateAvailable
- downloading
- downloaded
- installing
- error
- offline

Update failures must never prevent application startup.

---

# 9. Provider Boundaries

The architecture intentionally defines boundaries for future evolution.

## Authentication

Current:

    AuthProvider
        |
        +--> LocalAuthProvider

Future:

    AuthProvider
        |
        +--> LocalAuthProvider
        +--> SupabaseAuthProvider

---

## Storage

Current:

    StorageProvider
        |
        +--> LocalStorageProvider

Future:

    StorageProvider
        |
        +--> LocalStorageProvider
        +--> CloudStorageProvider

---

## Synchronization

Current:

    SyncProvider
        |
        +--> LocalOnlySyncProvider

Future:

    SyncProvider
        |
        +--> LocalOnlySyncProvider
        +--> CloudSyncProvider

---

## AI

Existing AI provider abstraction supports multiple providers.

Future hosted AI can be added without replacing existing BYO-key/local AI providers.

---

## Updates

Current:

    UpdateProvider
        |
        +--> GitHubReleaseUpdateProvider

Future:

    UpdateProvider
        |
        +--> GitHubReleaseUpdateProvider
        +--> GenericHttpUpdateProvider
        +--> EnterpriseUpdateProvider

---

## RAG

Future:

    RAGProvider
        |
        +--> LocalRAGBookProvider
        +--> CloudRAGProvider

---

# 10. Supabase / Backend Future

Supabase/backend is intentionally NOT part of the current v1 application.

When cloud functionality becomes necessary, add it as a separate service layer.

Future architecture:

    StudyOS Desktop
          |
          v
    Service Interfaces
          |
    +-----+-----+-----+
    |     |     |     |
    v     v     v     v
   Auth  Sync   AI   RAG
    |     |     |     |
    +-----+-----+-----+
          |
          v
    Backend / Supabase

Potential future backend responsibilities:

- user accounts
- authentication
- cloud sync
- parent/student relationships
- assignments
- subscriptions
- hosted AI
- usage quotas
- product analytics
- cohort/classroom functionality

These must remain separate from the Electron shell.

---

# 11. Future Product Architecture

StudyOS Desktop remains the primary deep-work client.

Potential future clients:

    StudyOS Desktop
    StudyOS Mobile
    StudyOS Web
    Parent Web/Mobile

All communicate through a future backend/API.

The desktop client remains capable of local-first operation.

---

# 12. RAGBook Studio

RAGBook Studio is currently a separate product/system.

It provides:

- PDF ingestion
- OCR
- chunking
- embeddings
- vector databases
- retrieval
- reranking
- local/cloud LLM adapters
- citation-aware answers
- model/device management
- plugin architecture

Future integration:

    StudyOS PDF Knowledge Engine
              |
              v
         RAGProvider
              |
              v
       Local RAGBook Engine

Future cloud option:

    RAGProvider
         |
         +--> Local RAGBook
         |
         +--> Cloud RAG Service

The PDF UI should not be tightly coupled to the RAG implementation.

---

# 13. Business Evolution

Current:

FREE LOCAL-FIRST DESKTOP

    +
GitHub public releases

Future:

FREE
- local study features
- local AI/BYO key

PRO
- cloud sync
- hosted AI
- multi-device
- advanced parent features

B2B/B2C2:

- coaching institutes
- classrooms
- cohorts
- teacher dashboards

Potential RAGBook Studio product:

- standalone PDF RAG engine
- developer API
- embeddable RAG infrastructure

---

# 14. Architectural Rule

Do NOT rewrite the Electron application when future cloud functionality is introduced.

Add implementations behind existing service boundaries.

Preferred evolution:

    Interface
       |
       +--> Local implementation
       |
       +--> Cloud implementation

NOT:

    Old Electron application
            |
            v
       Complete rewrite

---

# 15. Non-Goals for v1

Do NOT add:

- backend
- Supabase
- Firebase
- cloud sync
- telemetry
- hosted AI
- remote authentication
- remote database
- cloud RAG
- mobile application
- web application
- subscription billing

These are future phases.

---

# 16. Current Architecture Decision

The v1 architecture is:

    Electron + React + TypeScript
             |
             v
       Local-first services
             |
             +--> Local storage
             +--> Local authentication
             +--> Existing AI providers
             +--> Local application data
             |
             v
       UpdateService
             |
             v
       GitHubReleaseUpdateProvider
             |
             v
       Public GitHub Releases

This is the architectural baseline for StudyOS Desktop.

Future cloud functionality must extend this architecture rather than replace it.
