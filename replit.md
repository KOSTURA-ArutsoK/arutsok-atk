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
    - **Sidebar Navigation (ArutsoK 36, updated ArutsoK 41)**: Zmluvy section restructured: "Evidencia zmluv" (position 1), "Zmluvy" (position 2) as flat siblings. "Nastavenia sablon" is a sub-collapsible parent containing "Sprava sablon", "Stavy zmluv", and "Nastavenie evidencie". "Zoznam protokolov" is a sub-collapsible containing "Sprievodky" (renamed from "Zoznam supisiek") and "Supisky".
    - **Contract Form Navigation (ArutsoK 37)**: "Ulozit zmluvu" button only appears on Folder 8 (Provizne zostavy, last tab) on the right side. Folders 1-7 show only "Predchadzajuci krok" + "Pokracovat". "Predchadzajuci krok" navigates back to previous folder. Tab order: Pokracovat(1) → Predchadzajuci(2) → Ulozit(3).
    - **Product Folder Assignments (ArutsoK 38-40)**: Products now have folder assignments via `product_folder_assignments` table with sort_order for rendering order in contract forms. Product form dialog replaces Parameters multi-select with sortable Folders DnD list. Partner dropdown added to product form. Panely column removed from products table.
    - **Contract Field Settings (ArutsoK 38-40)**: `contract_field_settings` table with `field_key` and `required_for_pfa` boolean. "Nastavenie evidencie" page under sidebar "Nastavenia sablon" section for toggling PFA-required fields. Route: /contract-field-settings.
    - **Parameter Snapshots (ArutsoK 38-40)**: `contract_parameter_values` stores `snapshot_label`, `snapshot_type`, `snapshot_options`, `snapshot_help_text` to preserve parameter metadata at contract save time, preventing future master parameter edits from affecting existing contracts.
    - **Contract Form Folder Ordering (ArutsoK 38-40)**: Contract form now uses `product_folder_assignments` sort_order to render folders in product-specific order instead of global folder order.
    - **Protocol Validation (ArutsoK 41)**: Supisky enforce max 25 contracts and same-product constraint. Sprievodky remain flexible with no limits.
    - **Hierarchy Count Badges (ArutsoK 41)**: API endpoint `/api/hierarchy/counts` returns child-item counts. Tables display Badge counts: Sectors→Products, Sections→Products, Products→Folders, Folders→Panels, Panels→Parameters.
    - **UI Consistency & Naming (ArutsoK 42)**: Sidebar label "Sprava pristupov" renamed to "Sprava prihlasenia". Product form folder DnD list unified to use Card+CardContent+TableHeader matching Sectors module style. Drag handles visually integrated via SortableTableRow first-column GripVertical.
    - **Contract Flow & Evidencia (ArutsoK 43)**: Added `isSystem` boolean to `contract_statuses` with seeded system status "Nahrata do systemu". Evidencia zmluv page (`/evidencia-zmluv`) filters unprocessed contracts (inventoryId IS NULL) with bulk checkbox selection and "Vytvorit sprievodku" dialog. Processing creates a new sprievodka (contract inventory), assigns system status, and sets inventoryId on selected contracts. System statuses are protected: cannot be deleted, name is read-only (backend + frontend enforced). API: POST `/api/contract-inventories/:id/process`, GET `/api/contracts?unprocessed=true`.
    - **Sidebar Width & Labels Fix (ArutsoK 44)**: Sidebar width set to 280px to prevent text truncation on deeply nested items. All labels ("Evidencia zmluv", "Sprava prihlasenia", "Financie", "Zoznam protokolov", "Nastavenia sablon") confirmed fully visible in one line with proper icon-text alignment.
    - **Dual-Phase Contract Processing (ArutsoK 45)**: Evidencia zmluv restructured with two Card-based folders: "Nahravanie zmluv" (PFA workspace with multi-select + "Odoslat" dispatch) and "Zmluvy cakajuce na prijatie" (Central Office verification grouped by Sprievodka with "Schvalit a prijat"). Schema: `isAccepted` boolean on `contract_inventories`. API: POST `/api/contract-inventories/:id/dispatch` (Phase 1 - PFA sends), POST `/api/contract-inventories/:id/accept` (Phase 2 - Central Office accepts + assigns system status), GET `/api/contracts/dispatched` (pending acceptance contracts).
    - **Contract Flow, Numbering & Archive (ArutsoK 46)**: Sprievodka auto-numbering via `sprievodka_sequence` counter (displayed as "Sprievodka c. X"). Contracts stored in user-checked order via `sortOrderInInventory` field. UI shows selection order (#) column and note about ordering. Button states: "Odoslat" disabled after dispatch, "Tlacit sprievodku" enabled after dispatch. On acceptance, unique registration numbers generated in format "[StateCode] XXX XXX XXX XXX" via `contract_registration` counter. Schema: `sequenceNumber`, `isDispatched` on `contract_inventories`; `sortOrderInInventory`, `registrationNumber` on `contracts`. Sprievodky page shows sequence number and acceptance/dispatch status badges.
    - **Evidencia Redesign & Access Control (ArutsoK 47)**: Evidencia zmluv restructured with 4 horizontal folder cards at top: (1) Nahravanie zmluv, (2) Cakajuce na prijatie, (3) Prijate zmluvy, (4) Archiv zmluv s vyhradami. Search bar below folders. Archive folder auto-populates with accepted contracts older than 1 year. Duplicate check on contract number entry with inline warning showing client name (visibility-gated). Auto-status assignment: "Odoslana na sprievodke" on dispatch, "Prijata centrom - OK" on accept. Schema: `uploadedByUserId`, `dispatchedAt`, `acceptedAt` on contracts; `contract_acquirers` table for multi-acquirer visibility; 3 new system statuses seeded. API: GET `/api/contracts/check-duplicate`, GET `/api/contracts/accepted`, GET `/api/contracts/archived`, CRUD `/api/contracts/:id/acquirers`.
    - **Global Numbering & Status Matrix (ArutsoK 48)**: Replaced country-code registration numbering with global incrementing counter (`globalNumber` integer on contracts, `global_contract_number` counter). Number assigned ONLY when status with `assignsNumber=true` is reached (default: "Prijata centrom - OK"). Status property matrix: 3 boolean toggles on `contract_statuses`: `isCommissionable` (triggers commission calc), `isFinal` (contract becomes read-only), `assignsNumber` (triggers global number assignment). ContractStatuses form shows Switch toggles; table shows property Badges. Contracts without globalNumber display "V procese" Badge. Data integrity: once globalNumber assigned, it cannot be changed or reused (skip if already set).
    - **Status Configurator & Rejected Contracts (ArutsoK 49)**: ContractStatuses page rebuilt with 2-tab dialog: Tab 1 (Vseobecne udaje) has name, color picker, state select, companies multi-select (checkboxes), definesContractEnd toggle, visibility filter (Sektor/Sekcia/Produkt tree checkboxes), and 4 property switches (definesContractEnd, isCommissionable, isFinal, assignsNumber). Tab 2 (Parametre) has independent CRUD for status-specific parameters (`contract_status_parameters` table) with types: text, number, date, select, multiselect, boolean, textarea. Schema: `definesContractEnd` boolean on `contract_statuses`, 4 new tables: `contract_status_companies` (many-to-many), `contract_status_visibility` (entityType+entityId), `contract_status_parameters`, `contract_status_change_logs` (tracks all status transitions with timestamps). Evidencia zmluv folder 3 renamed to "Neprijate zmluvy - vyhrady" (red XCircle icon) showing contracts not checked during sprievodka acceptance (no globalNumber, no main archive). Contextual status filtering in ContractForm: statuses filtered by company match AND visibility (sector/section/product) match using `/api/contract-statuses/all-visibility` bulk endpoint. API: GET/PUT `/api/contract-statuses/:id/companies`, GET/PUT `/api/contract-statuses/:id/visibility`, CRUD `/api/contract-statuses/:id/parameters`, GET `/api/contracts/rejected`, GET `/api/contracts/:id/status-change-logs`.

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