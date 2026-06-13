# Chatbot Fix Checklist

## Critical Bugs Found:

1. **Token key mismatch in ChatAdmin.jsx** — Uses `localStorage.getItem('token')` but the auth system stores it as `'auth_token'`. This causes all admin API calls (FAQs, docs, history, analytics) to fail silently.

2. **Missing dotenv/GEMINI_API_KEY handling** — No `.env` file exists. The chatbot tries to contact Gemini API without a key, causing silent failures.

3. **ChatWidget streaming error handling** — Lack of robust error handling when the response body isn't a proper ReadableStream.

4. **ChatAdmin useApi hook swallows all auth errors** — Auth failures are caught silently with no user feedback.