# ArutsoK

## Overview
ArutsoK is a multi-tenant CRM and commission tracking system designed for financial services and real estate industries. It provides comprehensive client and partner management, precise commission calculations, and prioritizes data integrity, auditability, and temporal validity. The platform aims to be a secure and robust solution for managing complex business relationships and financial transactions.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## System Architecture
The system employs a modern full-stack architecture, emphasizing data integrity, security, and auditability.

**Core Technologies:**
- **Frontend**: React with Vite, Tailwind CSS, `shadcn/ui`, `wouter`.
- **Backend**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Replit OIDC Auth.

**Key Architectural Decisions & Features:**
- **Data Integrity & Auditability**: Implemented through immutable historical records, soft deletion with audit trails, comprehensive `audit_logs`, and subject-specific history views.
- **Temporal Validity**: Uses `validFrom`, `validTo`, and `isActive` fields with an hourly cron job for archiving expired bindings.
- **Role-Based Access Control (RBAC)**: Granular permissions managed via `permission_groups`.
- **Unique Identifiers**: Atomic 12-digit UIDs generated from a `global_counters` table.
- **UI/UX & Interaction**:
    - **Context Switching**: Forced two-step context selector (State → Company) with a blocking visual overlay.
    - **Dynamic Dialog Sizing**: `DialogContent` supports responsive sizing based on content and screen size.
    - **Smart Filter Bar System**: `useSmartFilter` hook provides typed column definitions and type-specific operators for filtering, including saved views per table.
    - **Row-Click Navigation**: `TableRow` supports `onRowClick` with automatic stop propagation.
    - **Rich Text Editing**: Integrated Tiptap editor for notes.
    - **Document Management**: Supports dual document systems (official/work) with file uploads.
    - **Drag & Drop Reordering**: Implemented using `@dnd-kit`.
    - **Status Indicators**: Consistent 5-color status dots and green/red for active/inactive states.
    - **Voice Assistance (TTS)**: Web Speech API for user-controlled notifications.
- **Security & Workflow**:
    - **Idle Timeout**: Two-phase system with warnings and auto-logout.
    - **Archive Module**: Dedicated page for soft-deleted entities with password-protected restore.
    - **Processing Time Protocol**: Tracks form editing duration.
- **Module-Specific Features**:
    - **Dynamic Parameter System (Contract-level)**: A 4-level hierarchy (Sectors → Sections → Products → Parameters) for dynamic contract field configuration and form generation.
    - **Dynamic Subject Parameter Library**: Database-driven field definitions replacing hardcoded `staticFieldDefs.ts`. Architecture: `subject_param_sections` (folders/panels) → `subject_parameters` (field definitions) → `subject_templates` (field groupings) → `subject_template_params` (template↔parameter bindings with temporal validity via `validFrom`/`validTo`). Admin UI embedded within Sectors page under "Sektory Subjektov" tab with 3 sub-tabs: Parametre, Sekcie & Panely, Šablóny. Supports `getResolvedParametersForTemplate()` for contract-date-based field resolution. Auto-code generation: system generates unique slugs from user-friendly names (`generateAutoCode()` with prefixes `sec_`, `f_`, `p_`, `tmpl_`). Includes `parameter_synonyms` table for AI synonym mapping, `isCollection` flag for multi-value fields (phone, email, addresses), `extractionHints` JSON for regex patterns/format, and `POST /api/ai/extract-fields` endpoint for document text extraction via synonyms. `subject_field_history` extended with `validFrom`/`validTo` for temporal value tracking.
    - **Dynamic Panels System**: Wraps parameters into visual containers within forms for flexible layout.
    - **Contracts Module**: Full-page contract management with multi-tab navigation, custom fields, and password management.
    - **Commission Brain & Calculation Engine**: Manages `commission_rates` with temporal validity, supports base and differential calculations, and maintains `commission_calculation_logs`.
    - **Settlement Sheets (Supisky) Module**: Manages settlement sheets and contracts, including locking mechanisms, status workflows, and automatic undelivered contract monitoring.
    - **Calendar Module**: Provides full CRUD for `calendar_events` with various views and dashboard integration.
    - **Client Registration**: Multi-step flow including identity verification, simulated MFA, and triple client type inline creation.
    - **Subject Ownership & Visibility**: Subjects track `registeredByUserId`, with visibility rules anonymizing non-owned subjects unless the user is a superadmin/prezident.
    - **Company Context Filtering**: All subject and contract queries filter by `appUser.activeCompanyId`.
    - **System Settings**: Key-value store for application configurations.
    - **Dashboard Customization**: Drag-and-drop widget reordering with user-specific layout persistence.
    - **Global Table Resizing**: All tables support column resizing with persistence.
    - **Universal Column Manager**: Global `useColumnVisibility` hook and `ColumnManager` component for per-table column selection and persistence.
    - **State and Company Management**: Dedicated pages for CRUD operations on states and companies.
    - **Contract Folders System**: Organizes panels visually into folders within the contract form.
    - **Contract Processing Workflow**: Multi-phase system for contract submission, dispatch, and acceptance.
    - **Contract Status Management**: Customizable `contract_statuses` with status change history tracking.
    - **Hierarchy Count Badges**: Displays child-item counts in hierarchical tables.
    - **Decimal Parameter Type (DESATINNE_CISLO)**: Global parameter type supporting configurable unit suffix and dynamic precision.
    - **Client Data Architecture (30-Category System)**: Organized into 7 logical tabs and 30 categories with PDF summary sidebar and field history logging.
    - **Parameter → Category Mapping**: Allows parameter values from contracts to automatically flow into specified client data categories/fields.
    - **Marketing Consents (M:N)**: Stores per-subject and per-company consent types.
    - **Bonita Point System**: Automatic credit rating system with `subject_points_log`, "Červený zoznam" (red list), and "Čierny zoznam" (blacklist).
    - **Detective Risk Linking (BLOK 2)**: Cross-checks risky data (phone, email, addresses) against blacklisted subjects and identifies FO-PO relationship risks.
    - **AML Module (KUV)**: Fields for Konečný užívateľ výhod (Ultimate Beneficial Owner).
    - **Firemný profil (Category 32)**: Category for business profile information (SK NACE, Turnover, Employee Count).
    - **Relationship Visualization**: Component for visualizing Konateľ ↔ Firma relationships with propagated list warnings.
    - **UID Format**: Subjects receive permanent UIDs in `421` + 12-digit sequential format.
    - **Field History (Versioning)**: `subject_field_history` tracks granular per-field changes.
    - **Shadow Archive (GDPR Bypass)**: Anonymizes PII while preserving encrypted original data for SuperAdmin reveal.
    - **Subject Collaborators (Tipér/Špecialista/Správca)**: Manages collaborators with roles and temporal validity.
    - **Extended Bonita Points**: `subject_points_log` supports `pointType` and manual point addition with reason.
    - **Duplicity Checker**: Enhanced checking for duplicates including ŠPZ and VIN, with bulk checking capabilities.
    - **Master Subject Component (SubjektView)**: Single shared component (`subjekt-view.tsx`) used across: Subject Registry, Contract Detail ("Údaje o klientovi" + "Zhrnutie" tabs), and Client Portal. Any field/ordering change in `staticFieldDefs.ts` automatically propagates to all locations.
    - **Inline Subject Detail Panel**: Subject detail renders as a full-page inline panel.
    - **Field Hints System**: Category and field-level hints for various data types.
    - **Nezatriedené dáta (Category 33)**: Category for unclassified contract data with trend detection.
    - **Internal Field Notes (SuperAdmin)**: Per-field notes visible only to SuperAdmin/Prezident.
    - **Client Portal System (Klientská zóna)**: 'Klienti' permission group with auto-redirect to own profile, hidden sidebar, read-only access. `appUsers.linkedSubjectId` links users to subject profiles. Backend guards enforce access isolation on all subject endpoints.
    - **PEP Intelligence Banner**: Purple banner highlighting "POLITICKY EXPONOVANÁ OSOBA" when subject has PEP flag in dynamicFields.
    - **GDPR Data Export**: `/api/subjects/:id/gdpr-export` endpoint generating JSON with only legal fields (Identity, Contracts, Consents). Internal data excluded as "Interné obchodné tajomstvo".
    - **Access Logging**: Every subject profile view logged via `POST /api/subjects/:id/log-view` with audit trail.
    - **Internal Notes Backend Security**: field_notes stripped from uiPreferences for non-SuperAdmin/Prezident users at API level.
    - **Edit/View Mode Toggle**: Subject detail supports Edit mode (all fields editable) and View mode (empty categories auto-hidden).
    - **Parameter → Category Mapping**: `panel_parameters.targetCategoryCode` maps contract parameter values to client data categories automatically on save.
    - **Supplementary Index (Dodatkový index)**: `subjects.supplementaryIndex` allows SuperAdmin to insert subjects between existing records (e.g., 1057/B, 1057.1) for correct ordering in settlement sheets.
    - **Big Reset Script**: `POST /api/admin/big-reset` (SuperAdmin-only, confirmation code: RESET-ARUTSOK-2025) wipes all test data and resets UID counters.
    - **Enhanced Excel Importer**: `POST /api/contracts/import-excel` auto-creates subjects by RČ/IČO, marks incomplete contracts (`incompleteData`, `incompleteDataReason`), tracks batches via `importBatchId`/`importedAt`. Supports CSV. RČ/IČO matching updates existing or creates new subjects. Maps data to 30 client categories via `targetCategoryCode`. VIN/ŠPZ duplicate detection with audit log "Potenciálny konflikt majetku". Missing storno date → status "Čaká na posúdenie bonusu/malusu" (no auto red point). "Hromadný import" button in Evidencia zmlúv toolbar.
    - **Profile Photo System**: `subject_photos` table with versioning (photos never overwritten). Circular avatar in subject detail header + thumbnail in subjects list next to UID. Upload sources: manual, from OP (Občiansky preukaz), from Pas. Smart crop via `sharp` attention strategy. Photo history archive with validity dates and activation. Authenticated file serving.
    - **Contract Renumbering (Fix Poradia)**: `PATCH /api/contracts/:id/renumber` with automatic shift of subsequent contracts (+1) within same inventory. Inline sort order editing in contract list.

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
- **Multer**: File upload handling.
- **ExcelJS**: Excel spreadsheet generation.
- **Sharp**: Image processing (resize, crop with attention strategy).