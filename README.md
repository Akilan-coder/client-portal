# Apex Digital Client Portal — Full Stack Application

A complete full-stack Client Portal web application featuring a Tailwind CSS frontend, Express.js REST API backend, and a relational SQLite database. Every single user action across all modules writes directly to the local database.

---

## 🗂️ Project Structure

```
client-portal/
├── database.sqlite        # SQLite relational database with all tables
├── db.js                  # Database setup, migrations, and seed data
├── server.js              # Express.js server, static hosting & Multer
├── .env                   # Environment variables (PORT, JWT_SECRET)
├── package.json           # Node.js dependencies & scripts
├── index.html             # Full-featured UI connected to all backend endpoints
├── uploads/               # Disk storage for real uploaded documents
└── routes/
    ├── auth.js            # User profile, role switcher, and settings
    ├── dashboard.js       # Live KPI stats & dynamic velocity calculation
    ├── projects.js        # Full CRUD for deliverables & progress tracking
    ├── documents.js       # Multer file upload, download, and vault records
    ├── tickets.js         # Support tickets & conversation thread messages
    ├── invoices.js        # Invoicing, payment simulation & receipt generation
    └── notifications.js   # Live notification queue & unread badge tracking
```

---

## 🗄️ Relational Database Schema (`database.sqlite`)

Every module has its own dedicated table with full relational connections:

1. **`users`**
   - Columns: `id`, `email`, `password_hash`, `full_name`, `role` (`ADMIN` | `CLIENT`), `company_name`, `account_id`, `avatar_url`.
   - Connected Actions: Editable profile modal, role switcher (`CLIENT` ↔ `ADMIN`).

2. **`projects`**
   - Columns: `id`, `user_id`, `title`, `description`, `status` (`In Progress`, `Client Review`, `Completed`), `progress` (0–100%), `due_date`, `lead_name`.
   - Connected Actions: Create new project, update progress via slider, delete/archive.

3. **`documents`**
   - Columns: `id`, `user_id`, `name`, `category`, `size_label`, `file_path`, `file_url`, `created_at`.
   - Connected Actions: Real file uploads via **Multer** saved to `uploads/` directory on disk, downloadable files, record deletion.

4. **`tickets` & `ticket_messages`**
   - `tickets`: `id`, `user_id`, `ticket_number`, `subject`, `description`, `priority`, `status`, `last_response`.
   - `ticket_messages`: `id`, `ticket_id`, `sender_name`, `sender_role` (`CLIENT` | `SUPPORT`), `message`, `created_at`.
   - Connected Actions: Create ticket, open real-time conversation drawer, send threaded replies, mark as resolved or reopen.

5. **`invoices`**
   - Columns: `id`, `user_id`, `invoice_number`, `period`, `amount`, `status` (`Pending`, `Paid`), `due_label`.
   - Connected Actions: Issue new invoice, process instant payment, download generated `.txt` receipt.

6. **`notifications` & `activities`**
   - `notifications`: Unread badge queue on top navbar with "Mark all read" action.
   - `activities`: Audit log tracking every change, project update, payment, and file upload in real time.

---

## 🚀 How to Run in VS Code

### 1. Open the Project
1. Open **VS Code**.
2. Select **File → Open Folder...** and choose:
   ```
   C:\Users\AKILAN M\.gemini\antigravity\scratch\client-portal
   ```

### 2. Start the Backend Server
In the VS Code terminal (`Ctrl + ~`), run:
```powershell
npm start
```
*(Or `npm run dev` for auto-reloading).*

### 3. Open the Client Portal
Open your browser to:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 📡 Complete API Endpoints

| Resource | Method | Endpoint | Database Operation |
| :--- | :--- | :--- | :--- |
| **Auth & Profile** | `GET` | `/api/auth/me` | Fetch active user & company details |
| | `PATCH` | `/api/auth/profile` | Update user name, company name, and email |
| | `POST` | `/api/auth/switch-role` | Toggle between `CLIENT` and `ADMIN` role |
| **Projects** | `GET` | `/api/projects` | Query all projects & deliverables |
| | `POST` | `/api/projects` | Insert new project into SQLite |
| | `PATCH` | `/api/projects/:id` | Update progress % and status |
| | `DELETE`| `/api/projects/:id` | Remove project from database |
| **Documents** | `GET` | `/api/documents` | List vault documents |
| | `POST` | `/api/documents/upload`| Multer upload to disk + save row in SQLite |
| | `GET` | `/api/documents/download/file/:filename` | Download real uploaded file from disk |
| | `DELETE`| `/api/documents/:id` | Delete file from disk & remove database row |
| **Tickets** | `GET` | `/api/tickets` | Query support queue |
| | `POST` | `/api/tickets` | Open ticket & initial thread message |
| | `GET` | `/api/tickets/:id` | Fetch ticket with complete message thread |
| | `POST` | `/api/tickets/:id/messages` | Insert reply into `ticket_messages` table |
| | `PATCH` | `/api/tickets/:id/status` | Update status to `Resolved` or `In Progress` |
| **Invoices** | `GET` | `/api/invoices` | Query statement history |
| | `POST` | `/api/invoices` | Insert new invoice into database |
| | `POST` | `/api/invoices/:id/pay`| Update status to `Paid` |
| | `GET` | `/api/invoices/:id/receipt`| Generate and download official receipt |
| **Notifications** | `GET` | `/api/notifications` | Query unread alerts |
| | `POST` | `/api/notifications/mark-read`| Mark all alerts as read in database |
| **Dashboard** | `GET` | `/api/dashboard/stats` | Dynamic KPI calculations & sprint velocity |
