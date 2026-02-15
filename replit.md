# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system built for the financial services and real estate industries. It offers comprehensive client and partner management, precise commission calculations, and prioritizes data integrity, auditability, and temporal validity. The platform aims to be a secure and robust solution for managing complex business relationships and financial transactions.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## System Architecture
The system uses a modern full-stack architecture, emphasizing data integrity, security, and auditability.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui`, `wouter`.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Replit OIDC Auth.

**Key Architectural Decisions & Features:**
- **Data Integrity & Auditability**: Achieved through immutable historical records, soft deletion with audit trails, comprehensive `audit_logs` for all mutating operations, and subject-specific history views.
- **Temporal Validity**: Utilizes `validFrom`, `validTo`, and `isActive` fields with an hourly cron job for archiving expired bindings.
- **Role-Based Access Control (RBAC)**: Granular permissions managed via `permission_groups`.
- **Unique Identifiers**: Atomic 12-digit UIDs generated from a `global_counters` table.
- **UI/UX & Interaction**:
    - **Context Switching**: Forced two-step context selector (State → Company) with a blocking visual overlay.
    - **Design**: Dark mode, Slovak language, sharp borders, small border radius, fixed dialog sizes.
    - **Rich Text Editing**: Integrated Tiptap editor for notes.
    - **Document Management**: Supports dual document systems (official/work) with file uploads and database metadata.
    - **Drag & Drop Reordering**: Implemented for various elements using `@dnd-kit`.
    - **Status Indicators**: Consistent 5-color status dots and green/red for active/inactive states.
    - **Voice Assistance (TTS)**: Web Speech API for user-controlled notifications.
- **Security & Workflow**:
    - **Idle Timeout**: Two-phase system with warnings and auto-logout.
    - **Archive Module**: Dedicated page for soft-deleted entities with password-protected restore.
    - **Processing Time Protocol**: Tracks form editing duration.
- **Module-Specific Features**:
    - **Dynamic Parameter System**: A 4-level hierarchy (Sectors → Sections → Products → Parameters) for dynamic configuration and form generation.
    - **Dynamic Panels System**: Wraps parameters into visual containers within forms, allowing flexible layout with customizable grid columns.
    - **Contracts Module**: Full-page contract management with multi-tab navigation, custom fields, and password management. Supports dynamic panel loading and value persistence.
    - **Commission Brain & Calculation Engine**: Manages `commission_rates` with temporal validity, supports base and differential calculations, and maintains `commission_calculation_logs`.
    - **Settlement Sheets (Supisky) Module**: Manages settlement sheets and contracts, including locking mechanisms and status workflows.
    - **Calendar Module**: Provides full CRUD for `calendar_events` with various views and dashboard integration.
    - **Client Registration**: Multi-step flow including identity verification and simulated MFA.
    - **System Settings**: Key-value store for application configurations.
    - **Dashboard Customization**: Drag-and-drop widget reordering with user-specific layout persistence.
    - **Global Table Resizing**: All tables support column resizing with persistence.
    - **State and Company Management**: Dedicated pages for CRUD operations on states and companies.
    - **Contract Folders System**: Organizes panels visually into folders within the contract form for flexible grid-based layouts.
    - **Contract Processing Workflow**: Features a multi-phase system for contract submission, dispatch, and acceptance (`Evidencia zmluv` module), including auto-numbering for `Sprievodka` and contract registration.
    - **Contract Status Management**: Customizable `contract_statuses` with properties like `isCommissionable`, `isFinal`, `assignsNumber`, and status-specific parameters. Supports tracking status change history and documents.
    - **Hierarchy Count Badges**: Displays child-item counts in various hierarchical tables.

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
- **Multer**: For handling file uploads.
- **ExcelJS**: For generating Excel spreadsheets.