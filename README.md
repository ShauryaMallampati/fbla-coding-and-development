# Lost & Found - Campus Recovery System

A modern web application for managing lost and found items on school campuses. Built with Node.js, Express, Supabase, and vanilla JavaScript.

## Features

- **Browse & Search** - Find lost items with filters for category, location, and more
- **Report Items** - Submit found items with photos and details
- **Claim Items** - Claim lost items that match your belongings  
- **Admin Panel** - Review submissions, manage statuses, validate items with AI
- **Dark Mode** - Toggle between light and dark themes
- **Responsive** - Works great on mobile, tablet, and desktop
- **Accessible** - WCAG 2.1 AA compliant with proper focus management

## Setup

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)
- Google Gemini API key

### Installation

1. Clone the repository
```bash
git clone <repo-url>
cd fbla-coding-and-development
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

Then edit `.env` and add your keys:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
```

4. Set up Supabase database (see [SUPABASE-SETUP.md](SUPABASE-SETUP.md))

5. Start the server
```bash
npm start
```

Visit `http://localhost:3000`

## Project Structure

```
├── public/              # Frontend files
│   ├── index.html      # Homepage
│   ├── browse.html     # Search/browse items
│   ├── found.html      # Report found items
│   ├── claim.html      # Claim lost items
│   ├── admin.html      # Admin panel
│   ├── styles.css      # Global styles
│   └── *.js            # Frontend logic
├── server.js           # Express backend
├── package.json        # Dependencies
└── DOCUMENTATION.md    # Full tech docs
```

## API Endpoints

- `GET /api/items` - Fetch items with filters
- `POST /api/items` - Submit a found item
- `PUT /api/items/:id/status` - Update item status
- `DELETE /api/items/:id` - Delete item
- `GET /api/claims` - Get all claims
- `POST /api/claims` - Submit a claim
- `PUT /api/claims/:id/status` - Update claim status
- `POST /api/validate-item/:id` - Validate item with AI

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini API (content validation)
- **File Storage**: Local uploads folder

## Documentation

See [DOCUMENTATION.md](DOCUMENTATION.md) for:
- Detailed API documentation
- Database schema
- Sources and credits
- WCAG 2.1 compliance details

## License

MIT
