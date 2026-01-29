# Lost & Found - Tech Docs

## What is this?
A web app for finding lost items on campus. Users post items they found, search for their stuff, and claim items with an ID.

## The Stack
- **Frontend**: HTML, CSS, JavaScript (no frameworks)
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini API (checks if submissions are legit)

## What it Does
- Browse and search lost items
- Report found items with photos
- Claim items you lost
- Admin panel to manage stuff
- Dark mode toggle
- Works on mobile, tablet, desktop
- AI validates sketchy submissions

## API Endpoints
- `GET /api/items` - Get items (with filters)
- `POST /api/items` - Submit found item
- `PUT /api/items/:id/status` - Change status
- `DELETE /api/items/:id` - Delete item
- `GET /api/claims` - Get claims
- `POST /api/claims` - Submit claim
- `PUT /api/claims/:id/status` - Update claim
- `POST /api/validate-item/:id` - AI check

## Setup
1. `npm install`
2. Create `.env.local` with your API keys (see `.env.example`)
3. `npm start`
4. Visit `http://localhost:3000`

## What You Need
- Supabase account (free works)
- Google Gemini API key
- Node.js 18+

## File Structure
```
public/        - Frontend (HTML, CSS, JS)
server.js      - Backend API
package.json   - Dependencies
.env.example   - Setup template
```

## Sources Used
- Lucide Icons (ISC License)
- Express (MIT)
- Supabase (MIT)
- Google Generative AI (Apache 2.0)
- Multer (MIT)
