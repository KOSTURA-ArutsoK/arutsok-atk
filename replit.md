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
    - **Design**: Dark mode, Slovak language, sharp borders, small border radius.
    - **Dynamic Dialog Sizing**: `DialogContent` supports `size` prop ("sm"|"md"|"lg"|"xl"|"full"|"auto"). Auto mode detects mobile (<1024px → full), tables (→ xl), field count (>15 → xl, 5-15 → md, ≤5 → sm). `DialogScrollContent` wraps scrollable body in xl/full dialogs. All sm/md/lg get `max-h-[85vh] overflow-y-auto`. Responsive resize listener for auto mode.
    - **Smart Filter Bar System**: `useSmartFilter` hook with typed column definitions (`SmartColumnDef`: key, label, type: "text"|"number"|"date"). Filter chips with type-specific operators: TEXT (contains/not_contains, diacritic-insensitive), NUMBER (=, >, <, ≥, ≤, range od-do), DATE (exact, before, after, range + quick picks: Dnes, Vcera, Tento mesiac, Tento rok). `SmartFilterBar` component with [+] column picker (searchable Command dropdown), dynamic chip editors via Popovers, saved views per table (localStorage). AND logic, 300ms debouncing. Integrated across 24+ pages. Data flow: raw data → useSmartFilter → useTableSort → display.
    - **Row-Click Navigation**: `TableRow` accepts `onRowClick` prop with automatic stop propagation for interactive elements (buttons, inputs, checkboxes via selector matching).
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
    - **Settlement Sheets (Supisky) Module**: Manages settlement sheets and contracts, including locking mechanisms and status workflows. Includes automatic undelivered contract monitoring: daily cron (03:30) checks supisky with status "Odoslana", exactly 1 contract, and sentAt > 30 days, moving those contracts to "Nedorucena 30 dni" system status with full audit trail. Manual trigger available via POST /api/admin/run-undelivered-check.
    - **Calendar Module**: Provides full CRUD for `calendar_events` with various views and dashboard integration.
    - **Client Registration**: Multi-step flow including identity verification and simulated MFA. Supports triple client type inline creation (FO, SZČO, and PO) in contract pre-select dialog with two-phase SZČO workflow (business info → personal info). ClientTypeRules organized into "POVINNÉ ÚDAJE" and "VOLITEĽNÉ ÚDAJE" sections; inline forms filter to show only mandatory fields.
    - **Subject Ownership & Visibility**: Subjects track `registeredByUserId` (auto-set on creation). In contract form Step 2, ownership is determined by: (a) user registered the subject, OR (b) user is an acquirer on any contract of that subject. Owned subjects show full details; non-owned subjects are anonymized (first letter + ***, no email/phone/IBAN). Superadmin/prezident bypass anonymization. Anonymized subjects are selectable but shown with Lock icon. Backend uses `?forContract=true` query param to trigger this logic.
    - **Company Context Filtering**: All subject and contract queries filter by `appUser.activeCompanyId`. Creating subjects/contracts auto-assigns the active company. Switching company context invalidates all cached data. Storage methods accept `companyId`/`myCompanyId` parameters; routes extract from `req.appUser.activeCompanyId`.
    - **System Settings**: Key-value store for application configurations.
    - **Dashboard Customization**: Drag-and-drop widget reordering with user-specific layout persistence.
    - **Global Table Resizing**: All tables support column resizing with persistence.
    - **Universal Column Manager**: Global `useColumnVisibility` hook + `ColumnManager` popover component. Every table in the system has a settings icon that opens a column picker with checkboxes, bulk actions (Show All, Hide All, Reset to Default), and per-table localStorage persistence. Integrated across 24 pages.
    - **State and Company Management**: Dedicated pages for CRUD operations on states and companies.
    - **Contract Folders System**: Organizes panels visually into folders within the contract form for flexible grid-based layouts.
    - **Contract Processing Workflow**: Features a multi-phase system for contract submission, dispatch, and acceptance (`Evidencia zmluv` module), including auto-numbering for `Sprievodka` and contract registration.
    - **Contract Status Management**: Customizable `contract_statuses` with properties like `isCommissionable`, `isFinal`, `assignsNumber`, and status-specific parameters. Supports tracking status change history and documents.
    - **Hierarchy Count Badges**: Displays child-item counts in various hierarchical tables.
    - **Decimal Parameter Type (DESATINNE_CISLO)**: Global parameter type across all modules (Sectors, ClientTypeRules) supporting comma/dot input, configurable unit suffix (€, %, BTC, ETH), and dynamic precision (0-8 decimal places). Stored with `unit` and `decimal_places` metadata columns.
    - **Client Data Architecture (30-Category System)**: 7 logical tabs (Identita, Legislatíva, Rodina a vzťahy, Financie a majetok, Profil a marketing, Digitálna stopa, Servis a archív) with 30 categories organized via `client_data_tabs` and `client_data_categories` tables. `SubjektView` component (`client/src/components/subjekt-view.tsx`) renders the 7-tab layout with collapsible category accordions. Fields mapped to categories via `FIELD_TO_CATEGORY` mapping and optional `categoryCode` on `StaticField`. PDF summary sidebar allows toggling `is_summary_visible` per field, stored in `subjects.ui_preferences` as `{ summary_fields: Record<string, boolean> }`.
    - **Marketing Consents (M:N)**: `client_marketing_consents` table stores per-subject × per-company consent types (email, SMS, phone, data_processing, third_party, profiling). UI in "Profil a marketing" tab shows current active company consents with Switch toggles.

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