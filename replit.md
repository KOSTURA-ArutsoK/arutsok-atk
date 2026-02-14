# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system designed for financial services and real estate industries. It provides comprehensive client and partner management, precise commission calculations, and emphasizes data integrity, auditability, and temporal validity. The platform aims to be a secure and robust solution for managing complex business relationships and financial transactions.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## System Architecture
The system utilizes a modern full-stack architecture prioritizing data integrity, security, and auditability.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui`, `wouter`.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Replit OIDC Auth.

**Key Architectural Decisions & Features:**
- **Data Integrity & Auditability**: Implemented through immutable historical records (no overwriting), soft deletion with audit trails, comprehensive `audit_logs` for all mutating routes and button clicks, and subject-specific history views.
- **Temporal Validity**: Extensive use of `validFrom`, `validTo`, and `isActive` fields, with an hourly cron job for archiving expired bindings.
- **Role-Based Access Control (RBAC)**: Granular permissions managed via `permission_groups`.
- **Unique Identifiers**: Atomic 12-digit UIDs generated from a `global_counters` table.
- **UI/UX & Interaction**:
    - **Context Switching**: A forced two-step context selector (State → Company) with a visual overlay, blocking app interaction until selection.
    - **Design**: Dark mode, Slovak language, sharp borders, small border radius, fixed dialog sizes.
    - **Rich Text Editing**: Integrated Tiptap editor for notes.
    - **Document Management**: Supports dual document systems (official/work) with file uploads and database metadata.
    - **Drag & Drop Reordering**: Used for various elements via `@dnd-kit`.
    - **Status Indicators**: Consistent 5-color status dots and green/red for active/inactive states.
    - **Voice Assistance (TTS)**: Web Speech API for notifications, user-controlled.
- **Security & Workflow**:
    - **Idle Timeout**: Two-phase system with warnings and auto-logout.
    - **Archive Module**: Dedicated page for soft-deleted entities with password-protected restore.
    - **Processing Time Protocol**: Tracks form editing duration.
- **Module-Specific Features**:
    - **Dynamic Parameter System**: A 4-level hierarchy (Sectors → Sections → Products → Parameters) for dynamic configuration and form generation.
    - **Dynamic Panels System**: Panels wrap parameters into visual containers within forms, allowing for flexible layout with customizable grid columns.
    - **Contracts Module**: Full-page contract management with multi-tab navigation, custom fields (`proposalNumber`, `kik`, `signingPlace`, `contractType`, `paymentFrequency`, `annualPremium`), and password management. Supports dynamic panel loading and value persistence.
    - **Commission Brain & Calculation Engine**: Manages `commission_rates` with temporal validity, supports base and differential calculations, and maintains `commission_calculation_logs`.
    - **Settlement Sheets (Supisky) Module**: Manages settlement sheets and contracts, including a contract locking mechanism and status workflow.
    - **Calendar Module**: Provides full CRUD for `calendar_events` with various views and dashboard integration.
    - **Client Registration**: Multi-step flow including identity verification and simulated MFA.
    - **System Settings**: Key-value store for application configurations.
    - **Dashboard Customization**: Drag-and-drop widget reordering with user-specific layout persistence.
    - **Global Table Resizing**: All tables support column resizing with persistence.
    - **State and Company Management**: Dedicated pages for CRUD operations on states (with flag uploads) and companies (with logo history).
    - **Contract Folders System**: Organizes panels visually into folders within the contract form, enabling flexible grid-based layouts.
    - **Sidebar Navigation (ArutsoK 36)**: Zmluvy section restructured: "Zmluvy" (/contracts) and "Evidencia zmluv" (/evidencia-zmluv) are flat siblings. "Nastavenia sablon" is a sub-collapsible parent containing "Sprava sablon" and "Stavy zmluv" as children. Supisky section (Zoznam supisiek, Supisky) unchanged.
    - **Contract Form Navigation (ArutsoK 37)**: "Ulozit zmluvu" button only appears on Folder 8 (Provizne zostavy, last tab) on the right side. Folders 1-7 show only "Predchadzajuci krok" + "Pokracovat". "Predchadzajuci krok" navigates back to previous folder. Tab order: Pokracovat(1) → Predchadzajuci(2) → Ulozit(3).

## External Dependencies
- **Replit OIDC Auth**: User authentication.
- **PostgreSQL (Neon)**: Database service.
- **Drizzle ORM**: Database abstraction.
- **Vite**: Frontend build tool.
- **Express.js**: Backend framework.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: UI component library.
- **wouter**: Client-side routing.
- **Tiptap**: Rich text editor.
- **Multer**: Handling `multipart/form-data` for file uploads.
- **ExcelJS**: Generating Excel spreadsheets.