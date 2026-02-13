# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system for industries like financial services and real estate. It provides robust client and partner management, detailed commission calculations, and emphasizes data integrity, auditability, and temporal validity. The project aims to be a comprehensive and secure platform for managing complex business relationships and financial transactions.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## System Architecture
The system employs a modern full-stack architecture with a focus on data integrity, security, and audibility.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui` for UI, `wouter` for routing.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Replit OIDC Auth with separate `users` (auth) and `app_users` (application-specific roles) tables.

**Key Architectural Decisions & Features:**
- **Deployment**: Frontend and Backend served together on port 5000.
- **Data Integrity & Auditability**:
    - **No Overwriting**: All updates archive original records, creating an immutable history.
    - **Soft Deletion**: Entities are soft-deleted with an `isDeleted` flag and audit trail.
    - **Audit Logging**: Comprehensive `audit_logs` track user actions, data changes, and processing times for all mutating routes.
    - **Global Click Logging**: All button clicks are logged to `audit_logs` via a throttled endpoint.
    - **Subject-Specific History**: Audit logs are viewable per entity.
- **Unique Identifiers**: Atomic 12-digit UIDs generated via a `global_counters` table.
- **Temporal Validity**: Many tables include `validFrom`, `validTo`, and `isActive` fields; an hourly cron job archives expired bindings.
- **Role-Based Access Control (RBAC)**: Granular permissions system using `permission_groups` and a permissions matrix.
- **UI/UX & Interaction**:
    - **Dark Mode**: Default with military/security aesthetic.
    - **Slovak Language**: Default language for the application.
    - **Design**: Sharp borders, small border radius, fixed 800x600px dialogs.
    - **Context Switching**: Supports switching active states (e.g., geographic regions) and companies per `app_user`.
    - **Rich Text Editing**: Tiptap editor for notes.
    - **Document Management**: Dual document system (official/work) with file uploads to local storage and database metadata.
    - **Drag & Drop Reordering**: Uses `@dnd-kit` for reordering elements in various modules (contract statuses, client types, etc.).
    - **Status Indicators**: 5-color status dots for Subjects and consistent green/red for active/inactive items.
    - **Voice Assistance (TTS)**: Web Speech API for notifications and welcome messages, with user-controlled muting via global `window.ARUTSOK_AUDIO_ENABLED` hardware-style switch persisted in localStorage.
- **Security & Workflow**:
    - **Idle Timeout Security**: Two-phase system with warning, audio cues, and auto-logout.
    - **Modal Scroll Lock**: Prevents background scrolling when dialogs are open.
    - **Archive Module**: Dedicated `/archive` page for soft-deleted entities with password-protected restore functionality (admin/superadmin only).
    - **Processing Time Protocol**: Tracks form editing duration (`processingTimeSec`) for all create/edit forms.
- **Module-Specific Features**:
    - **Contracts Module**: Manages contract statuses, templates, inventories, and main contracts. Includes regional data isolation based on `activeStateId`.
    - **Client Registration**: Multi-step flow with identity verification, simulated MFA, and public API endpoints.
    - **Client Zone**: Post-registration area for data review.
    - **Dynamic Client Type System**: Defines per-type form structures with conditional field visibility and 11 field types.
    - **Smart Subject Registration**: Two-step flow with duplicate checks and initial type selection.
    - **Bulk Client Assignment**: Feature for assigning multiple clients to groups.
    - **Client Groups**: Manages client groups and sub-groups with login blocking capabilities.
    - **Commission Brain & Calculation Engine**:
        - Manages `commission_rates` (partner+product rate matrix) with temporal validity.
        - `commission_calculation_logs` for audit trail of calculations.
        - Supports base and differential commission calculations based on agent hierarchy.
        - Dedicated pages for managing rates, incoming commissions (`Provizie`), and outgoing payments (`Odmeny`).
    - **Settlement Sheets (Supisky) Module**:
        - Manages `supisky` and `supiska_contracts`.
        - Implements contract locking mechanism during settlement sheet processing.
        - Status workflow (Nova → Pripravena → Odoslana) with auto-locking/unlocking of contracts.
        - Export functionality to Excel/CSV.
    - **Dynamic Parameter System**: `sectors`, `parameters`, `sector_parameters`, `product_sectors`, `product_parameters` tables for dynamic product parameterization.
    - **System Settings**: Key-value store for application configurations (e.g., support phone number, category timeouts, dashboard preferences).

## External Dependencies
- **Replit OIDC Auth**: For user authentication.
- **PostgreSQL (Neon)**: Primary database.
- **Drizzle ORM**: Database interactions.
- **Vite**: Frontend build tool.
- **Express.js**: Backend framework.
- **Tailwind CSS**: Styling.
- **shadcn/ui**: UI components.
- **wouter**: Client-side routing.
- **Tiptap**: Rich text editor.
- **Multer**: File uploads.
- **ExcelJS**: Spreadsheet generation.