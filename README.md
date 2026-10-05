# U.P. Boxing Association - Simple MVC

React/Vite has been removed. The project uses:
- EJS + CSS + Vanilla JavaScript
- Node.js + Express
- MySQL
- MVC: Routes -> Controllers -> Models -> EJS Views
- Multer for uploads
- Razorpay for online payment

## Run
1. Create DB: `mysql -u root -p < backend/schema.sql`
2. Copy `backend/.env.example` to `backend/.env` and add your MySQL/Razorpay values.
3. `cd backend`
4. `npm install`
5. `npm run dev`
6. Open `http://localhost:5000`

## Admin portal
Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in `backend/.env` before starting the server. Use a unique password and a random session secret of at least 32 characters; generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` from the `backend` directory. Sign in at `http://localhost:5000/admin`.

The admin portal can search and edit registrations, view uploaded documents with their registration owner, set each document to pending/approved/rejected with an optional note, view gateway-confirmed payment records, and change registration fields for future applicants. Document files are limited to JPG, PNG, or PDF up to 5 MB and are accessible only through the authenticated admin portal. Payment status is only changed by successful server-side Razorpay verification. Registration form and document tables are created automatically in MySQL when the server starts. Admin cookies are HTTP-only and SameSite; production deployments must use HTTPS. Older registrations that saved only a filename will show as not uploaded if the actual file is not present in server storage.

Education and achievements are submitted as arrays and stored in their own SQL tables.

## Production hosting

Use a Node.js host that supports a long-running Express process and a MySQL database. Set the service root directory to `backend`, install with `npm install`, and use `npm start` as the start command. Use Node.js 20 or newer.

Create an empty MySQL database and configure its connection variables in the hosting provider. On startup, the app creates any missing application tables automatically; the database user must have permission to create tables. `backend/schema.sql` is also available for manual setup. Configure these environment variables in the hosting provider (do not commit real credentials):

- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (at least 32 characters)
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` for online payments
- `NODE_ENV=production`
- `UPLOAD_DIR` set to a persistent mounted directory for registration documents

The host should provide `PORT`; the app listens on it automatically. Enable HTTPS and use live Razorpay credentials only when ready to accept real payments. The server exits if it cannot connect to MySQL, so the hosting service can report a failed deployment instead of routing traffic to an unusable app. Uploaded files are stored on disk; without persistent storage configured through `UPLOAD_DIR`, files may be lost when the host replaces the instance.
# upbp-website
