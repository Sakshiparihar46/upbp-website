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
2. Copy `backend/.env.example` to `backend/.env` and add your MySQL values.
3. `cd backend`
4. `npm install`
5. `npm run dev`
6. Open `http://localhost:5000`

## Admin portal
Set `ADMIN_SESSION_SECRET` in `backend/.env` to a random value of at least 32 characters; generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` from the `backend` directory. Admin usernames and scrypt-hashed passwords are stored in MySQL, not environment variables. On first startup, open `/admin/login` and use the one-time setup code printed in the server logs to create the initial admin account. Keep that code private; restarting before setup generates a new one. After signing in, use the **Admin account** tab to change the admin username and password. Changing credentials signs out all admin sessions.

If an existing installation still has both `ADMIN_USERNAME` and `ADMIN_PASSWORD` configured, the first startup migrates them into the database. After that startup succeeds, remove both variables from the hosting environment and `.env`; they are only used for this one-time migration.

The admin portal can search and edit registrations, view uploaded documents with their registration owner, set each document to pending/approved/rejected with an optional note, view gateway-confirmed payment records, and change registration fields for future applicants. Document files are limited to JPG, PNG, or PDF up to 5 MB and are accessible only through the authenticated admin portal. Payment status is only changed by successful server-side Razorpay verification. Registration form and document tables are created automatically in MySQL when the server starts. Admin cookies are HTTP-only and SameSite; production deployments must use HTTPS. Older registrations that saved only a filename will show as not uploaded if the actual file is not present in server storage.

Configure Razorpay from the admin portal's **Payments** tab by entering the account's Key ID and Key Secret. The secret is encrypted in MySQL and is never returned to the browser; keep `ADMIN_SESSION_SECRET` stable because it protects the stored credential. Existing `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` environment variables remain supported as a fallback until an admin explicitly disables Razorpay; disabling it also blocks that fallback.

Education and achievements are submitted as arrays and stored in their own SQL tables.

## Production hosting

Use a Node.js host that supports a long-running Express process and a MySQL database. Set the service root directory to `backend`, install with `npm install`, and use `npm start` as the start command. Use Node.js 20 or newer.

Create an empty MySQL database and configure its connection variables in the hosting provider. On startup, the app creates any missing application tables automatically; the database user must have permission to create tables. `backend/schema.sql` is also available for manual setup. Configure these environment variables in the hosting provider (do not commit real credentials):

- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
- `ADMIN_SESSION_SECRET` (at least 32 random characters; keep it stable)
- (Optional legacy fallback) `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`; admins can configure credentials in the portal instead
- `NODE_ENV=production`
- `UPLOAD_DIR` set to a persistent mounted directory for registration documents

The host should provide `PORT`; the app listens on it automatically. Enable HTTPS and use live Razorpay credentials only when ready to accept real payments. The server exits if it cannot connect to MySQL, so the hosting service can report a failed deployment instead of routing traffic to an unusable app. Uploaded files are stored on disk; without persistent storage configured through `UPLOAD_DIR`, files may be lost when the host replaces the instance.
# upbp-website
