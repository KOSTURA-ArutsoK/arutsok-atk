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
    - **Context Switching (ArutsoK 29)**: Visual Context Selector overlay with frosted glass backdrop-blur. Two-step forced selection: State (circular flag buttons) → Company (rectangular cards filtered by stateId). Blocks all app interaction until both are selected. Top bar State button reopens from Step 1 (clears company), Company button reopens Step 2 for current state. Auto-shows after login if context is missing. `ContextSelectorOverlay` component in `client/src/components/context-selector-overlay.tsx`. `setActive` API accepts `activeCompanyId: null` to clear company on state change.
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
    - **Dynamic Parameter System (ArutsoK 24-25, 28)**: 4-level hierarchy: Sektory → Sekcie → Produkty → Parametre. `sectors` (with `partnerIds` for multi-company assignment), `sections` (name, sectorId), `sector_products` (name, abbreviation, sectionId), `sector_product_parameters` bridge table. Legacy `sector_parameters`, `product_sectors`, `product_parameters` kept for compatibility. Sectors.tsx has 5-tab UI (Sektory, Sekcie, Produkty, Panely, Parametre) with cascading filters and partner multi-select combobox. All management tables default to descending sort (newest first).
    - **4-Level Hierarchy (ArutsoK 28)**: Added `sections` table between `sectors` and `sector_products`. Schema: `sections` (id, name, sectorId, isDeleted, createdAt). Changed `sector_products.sectorId` → `sector_products.sectionId`. Sectors.tsx Sekcie tab with full CRUD. Contracts.tsx uses cascading Sektor → Sekcia → Produkt dropdowns for product selection. Panels-with-parameters endpoint traverses full hierarchy.
    - **Product Form Cleanup (ArutsoK 26)**: Removed State (Stat) and Company (Spolocnost) fields from ProductFormDialog. These values auto-assign from app_user's `activeStateId` and `activeCompanyId` global context filter, simplifying the product creation flow.
    - **Dynamic Panels System (ArutsoK 27)**: Panels (Panely) wrap parameters into visual containers. Schema: `panels` table (name, description, sortOrder), `panel_parameters` bridge (panelId, parameterId, sortOrder), `product_panels` bridge (sectorProductId, panelId, sortOrder). 4th tab "Panely" added to Sectors.tsx for panel CRUD with parameter assignment. ProductsTab has panel assignment per sector product. Contract form dynamically renders panel sections with parameter inputs when a product is selected (via `/api/sector-products/:id/panels-with-parameters`). Supports all parameter types (text, textarea, number, currency, percent, date, boolean, combobox, etc.).
    - **System Settings**: Key-value store for application configurations (e.g., support phone number, category timeouts, dashboard preferences).
    - **Calendar Module**: `calendar_events` table with full CRUD, month grid view, event chips, day panel, create/edit/delete dialogs, color coding, all-day events. Dashboard widget for upcoming events.
    - **Settings Reorganization (ArutsoK 19)**: Sidebar 'Nastavenia' split into nested 'Sprava pristupov' sub-group (Pouzivatelia, Pravomoci skupiny, Doba prihlasenia) and direct items (Logy, Podpora a registracia, Nastavenie prehladov, Kos). Each settings concern has its own dedicated page.
    - **Session Management (ArutsoK 20)**: `permission_groups.sessionTimeoutSeconds` links session timeout to user groups. Two-way editing: editable in both Pravomoci skupiny dialog and Doba prihlasenia master table. AppShell derives timeout from user's permission group. Idle timeout modal "Zostat prihlaseny" button properly resets session.
    - **Global Table Resizing (ArutsoK 21)**: All tables support column resizing via drag handles on header boundaries. Built into the base `Table`/`TableHead` shadcn components (`client/src/components/ui/table.tsx`). On first resize, captures all column widths and switches to fixed layout. Visual indicators: hover shows subtle line, drag shows primary-colored line. Minimum column width 40px.
    - **Dashboard Customization (ArutsoK 22)**: Drag-and-drop widget reordering on Dashboard using `@dnd-kit`. `user_dashboard_layouts` table stores widget order per user (text array). Edit mode toggle "Upravit rozlozenie" shows dashed borders and GripVertical drag handles. Save/Cancel buttons persist layout via `/api/dashboard-layout`. Responsive grid (1-col mobile, 2-col desktop). Stats widget spans full width.
    - **Session Timeout Safeguards (ArutsoK 23)**: Minimum 60s for `sessionTimeoutSeconds` enforced on frontend (both Doba prihlasenia and Pravomoci skupiny) and server-side. Dynamic warning timing: timeout >5m warns at 2m remaining; timeout <=5m warns at 50% of duration. Anti-lockout via safe minimum ensures users always have enough time to interact with settings.

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