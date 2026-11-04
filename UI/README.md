# Workforce Attendance UI

React frontend for the workforce attendance system.

## Run locally

1. Start the backend service from `SERVER`.
2. Copy `.env.example` to `.env` if you need to change the API URL.
3. From this directory, install dependencies and start Vite:

```powershell
npm install
npm run dev
```

The UI runs at `http://localhost:3000`, which matches the backend's default CORS origin.

## Authentication and security

- Sign in with an account provisioned by your organization.
- The shared API client attaches the bearer token to authenticated requests.
- Tokens are kept in `sessionStorage` and cleared on sign-out or an API `401`.
- `sessionStorage` is accessible to JavaScript on the page; for production, prefer an HttpOnly, Secure, SameSite cookie-based session.
- Protected routes are for user experience only. The backend must enforce authorization for every request.
- Do not put secrets in `VITE_*` variables; Vite exposes them to the browser.
