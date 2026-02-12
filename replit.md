# ArutsoK

## Overview
ArutsoK is a multi-tenant Customer Relationship Management and commission tracking system designed for industries such as financial services, real estate, and defense/weapons trade. It aims to provide robust client management, partner relationship tracking, and detailed commission calculations with a strong focus on data integrity, auditability, and temporal validity. The project's vision is to be a comprehensive and secure platform for managing complex business relationships and financial transactions.

## User Preferences
- Dark mode default with military/security aesthetic
- Slovak language throughout the application
- Sharp borders, small border radius

## System Architecture
The system is built on a modern full-stack architecture:
- **Frontend**: React with Vite, styled using Tailwind CSS and `shadcn/ui` components for a consistent UI. `wouter` is used for client-side routing.
- **Backend**: Express.js handles API requests, serving both frontend assets and API endpoints.
- **Database**: PostgreSQL with Drizzle ORM for type-safe database interactions, hosted on Neon.
- **Authentication**: Replit OIDC Auth integration, maintaining separate user tables for authentication (`users`) and application-specific roles/permissions (`app_users`).
- **Deployment**: Frontend and Backend are served together on port 5000.
- **Data Integrity**: A core principle is "no overwriting"; all updates archive original records, creating an immutable history.
- **Unique Identifiers**: A 12-digit UID (`01-CC-SSS-NNN NNN NNN NNN`) is generated atomically using a `global_counters` table.
- **Soft Deletion**: Entities like Companies and Partners are soft-deleted using an `isDeleted` flag, accompanied by an audit trail (deletedBy, deletedAt, deletedFromIp).
- **Rich Text Editing**: Tiptap editor is integrated for rich text notes, storing content as HTML.
- **Document Management**: A dual document system (official and work documents) allows file uploads to local storage (`uploads/`) with metadata stored in the database. Logo management includes primary/archived states.
- **Context Switching**: The application supports switching between active states (e.g., geographic regions) and companies, persisted per `app_user`.
- **Temporal Validity**: Many tables (`companyOfficers`, `partnerContacts`, `companyContacts`, `commission_schemes`) incorporate `validFrom`, `validTo`, and `isActive` fields for managing time-sensitive data. An hourly cron job automatically archives expired bindings.
- **Audit Logging**: A comprehensive audit log (`audit_logs` table) tracks user actions, module, entity, data changes, processing time, and IP address for all mutating routes.
- **Role-Based Access Control (RBAC)**: A granular RBAC system uses `permission_groups` and a `permissions` matrix (module x action) to control access to different parts of the application.
- **Processing Time Protocol**: Tracks form editing duration (`processingTimeSec`) for all create/edit forms, displayed as HH:MM:SS format ("Cas spracovania").
- **Global Click Logging**: Every button click is captured and logged to `audit_logs` via `/api/click-log` endpoint with 500ms throttle. Visible in History as "Kliknutie" action type.
- **Idle Timeout Security**: Two-phase idle timeout system. Warning overlay with blur effect, audio beep, and 60s countdown at 120s of inactivity. Full auto-logout at 180s. Dismiss button resets timers. Tracks mousemove/keydown/mousedown/touchstart/scroll events with 1s interval. Visual countdown timer in header bar (green->red at 10s before warning). 3 beeps during final 10 seconds. Centered timer display during blur overlay.
- **Modal Scroll Lock**: CSS prevents background scrolling when dialogs are open via `body[data-scroll-locked]` targeting.
- **Archive Module**: Dedicated `/archive` page showing all soft-deleted companies, partners, products, and contracts in tabbed view. Restore operations are password-protected (server-side validation via `ARCHIVE_RESTORE_PASSWORD` env var) and restricted to admin/superadmin roles.
- **Contracts Module**: Full contracts management with 4 sub-modules: Contract Statuses (`/contract-statuses`) with color coding and drag&drop reorder, Contract Templates (`/contract-template-management`) with file upload support, Contract Inventories (`/contract-inventories`) with drag&drop reorder and open/closed states, and main Contracts page (`/contracts`) linking subjects, partners, products, statuses, templates, and inventories. Processing time tracking on contract forms.
- **Regional Data Isolation**: Server-side `getEnforcedStateId()` helper enforces `activeStateId` filtering on all contract module endpoints. Non-superadmin users can only access data within their active state. Cross-state entity linking blocked on contract creation. State validation on contract get/update/delete with superadmin bypass.
- **Drag & Drop Reordering**: @dnd-kit library (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) with reusable `SortableTableRow` and `SortableContext_Wrapper` components in `sortable-list.tsx`. Used in contract statuses, contract inventories, client types, client groups (main + sub-groups), and client type rules (fields + sections). Reorder endpoints: `PUT /api/contract-statuses/reorder`, `PUT /api/contract-inventories/reorder`, `PUT /api/client-types/reorder`, `PUT /api/client-types/:typeId/fields/reorder`, `PUT /api/client-types/:typeId/sections/reorder`.
- **Dialog Sizing**: All application dialogs use fixed 800x600px dimensions (`sm:max-w-[800px] h-[600px] overflow-y-auto`).
- **Click Log Format**: Click events logged in Slovak format: `Kliknutie na tlacidlo [X] v module [Y]`.
- **Processing Save Button**: Formerly WameSaveButton, renamed to `ProcessingSaveButton` in `processing-save-button.tsx`.
- **Client Registration**: Multi-step registration flow (`/register`) for clients linked to companies. Identity verification via partial rodne cislo (random 4 digits: 2 from first 6, 2 from last 4 for 10-digit / 1 from last 3 for 9-digit). MFA via SMS + email codes (simulated). Fallback to full birth number + ID card number. Public routes under `/api/public/register/*`. Challenge state stored server-side with 10-minute expiry.
- **System Settings**: `system_settings` table (key-value store). Support phone number configurable in Settings page (admin-only). Used in registration error messages.
- **Client Zone**: Post-registration welcome screen with data review. Entry to `/client-zone` personal area.
- **Category Timeouts**: `category_timeouts` table stores per-client-category logout durations in seconds. Admin-managed via Settings page. Default categories: Standardny (180s), VIP klient (300s), Bezpecnostny (120s).
- **Dashboard Preferences**: `dashboard_preferences` table stores per-user widget visibility (widgetKey + enabled flag). Users can toggle widgets in Settings > "Nastavenie prehladov". Dashboard dynamically renders only enabled widgets.
- **Status Indicators**: 5-color status dots for Subjects (gray=Vymazany, red=Neaktivny, blue=KIK, emerald=Overeny, amber=Aktivny). Active items consistently shown in Green, Inactive/Archived in Red across other modules (Partners contacts, Dashboard, Commissions).
- **Dynamic Client Type System**: `client_types`, `client_type_sections`, `client_type_fields` tables define per-type form structures. Base parameter determines RC vs ICO. Fields support 11 types (short_text, long_text, combobox, checkbox, switch, phone, email, number, file, date, iban). Conditional visibility via `visibilityRule` (dependsOn/value). Managed at `/client-type-rules`.
- **Smart Subject Registration**: 2-step flow: initial modal (client type + RC/ICO, state auto-assigned from activeStateId) with duplicate check → full-page editor. Type is locked after initial selection. Duplicate check endpoint at `/api/subjects/check-duplicate`.
- **Bulk Client Assignment**: Checkbox selection in Subjects table with "Priradit do skupiny" bulk action. POST `/api/client-groups/:groupId/bulk-assign` with duplicate-skipping logic.
- **Subject Finance Tab**: SubjectDetailDialog includes Financie tab with KIK ID, IBAN, SWIFT/BIC, commission level fields. PUT `/api/subjects/:id/finance` endpoint.
- **Branding**: Sidebar shows "Secure Platform" (not "CRM System"). Archive renamed to "Kos" throughout.
- **Collapsible Sidebar**: Four collapsible menu groups: Klienti (Zoznam klientov, Pravidla typov klientov, Skupiny klientov), Partneri a produkty (Zoznam partnerov, Katalog produktov, Kontaktne osoby), Zmluvy (Zmluvy, Nastavenia sablon, Sprava sablon, Stavy zmluv, Zoznam supisiek), Nastavenia (Kos, Logy, Pouzivatelia, Pravomoci skupiny, Podpora a registracia, Doba prihlasenia, Nastavenie prehladov). Uses Collapsible + SidebarMenuSub components.
- **Client Groups**: `client_groups`, `client_sub_groups`, `client_group_members` tables. 3-tab dialog: Vseobecne (name, allowLogin, allowCalculators), Podskupiny (sub-groups with drag&drop), Zoznam klientov (member search & assignment). Drag&drop reorder on main list. State-filtered via `getEnforcedStateId()`. Login blocking enforced in registration flow (`/api/public/register/initiate`).
- **Partner Contacts Overview**: `/partner-contacts` page aggregates contacts across all active partners with search and active/inactive filtering.
- **Enhanced Kôš Security**: Restore modal is 800x600px with admin password verification. Audit log records authorizedByAdminId, authorizedByUsername, authorizedByRole for every restore operation.
- **Subject-Specific History**: História tab on subject detail dialog shows entity-specific audit logs filtered by entityId + module. Displays T_idle (processing time) per entry.
- **Voice Assistance (TTS)**: Web Speech API with sk-SK language. Welcome message on login ("Vitaj, [Meno]. Prajem ti uspesny pracovny den."). Security warning at 10s before auto-logout ("System bude o chvilu uzamknuty. Prosim, ulozte si pracu."). Speaker icon (Volume2/VolumeX) in top bar with localStorage persistence via `arutsok_tts_enabled` key.
- **Doba prihlasenia**: Settings section renamed from "Timeout nastavenia" to "Doba prihlasenia".

## External Dependencies
- **Replit OIDC Auth**: Used for user authentication and session management.
- **PostgreSQL (Neon)**: The primary relational database.
- **Drizzle ORM**: Used for database interactions.
- **Vite**: Frontend build tool.
- **Express.js**: Backend web framework.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: UI component library.
- **wouter**: Client-side routing library.
- **Tiptap**: Rich text editor.
- **Multer**: Node.js middleware for handling multipart/form-data, primarily used for file uploads.