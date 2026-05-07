# Clerk Branding Checklist (NovaMart)

Use this once in the Clerk Dashboard to align hosted auth with the in-app theme.

## 1) Open your Clerk app

- Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
- Select your application: `NovaMart Support`

## 2) Set branding

- Navigate to appearance/branding settings
- Set brand name to `NovaMart Support`
- Set primary color to `#0d9488` (teal)
- Upload logo (square, transparent PNG recommended)
- Optional: upload favicon for hosted pages

## 3) Authentication methods

- Keep `Email + Password` enabled for now
- Optionally enable Google sign-in if needed
- Keep MFA optional in early development

## 4) URLs and redirects

- Add allowed origin: `http://localhost:3000`
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in redirect: `/admin`
- After sign-up redirect: `/admin`
- After sign-out redirect: `/`

## 5) Save and verify

- Visit `http://localhost:3000/sign-in`
- Visit `http://localhost:3000/sign-up`
- Visit `http://localhost:3000/admin` and confirm protected access

## Notes

- You are currently using development keys (`pk_test`, `sk_test`) which is correct for local work.
- For production, add production Clerk keys in your deployment environment.
