# Medic Mouse Dashboard

A simple web dashboard for managing medical routing rules.

## Features
- View and edit medical rules (status, confidence, exceptions)
- Real-time search/filter by condition or clinic
- Analytics overview (total queries, success rate, unknown items)
- Clean medical UI with white/red theme
- Auto-saves to JSON file

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open browser to: http://localhost:3000

## Usage

- **Search**: Type in the search box to filter rules by condition or clinic
- **Edit**: Click "Edit" button to modify rule status, confidence, or exceptions
- **Save**: Changes are automatically saved to `../data/medical-rules.json`

## Data Structure

The dashboard reads/writes to `../data/medical-rules.json` with this structure:
- `rules`: Array of medical routing rules
- `analytics`: Usage statistics

Each rule contains:
- `id`: Unique identifier
- `condition`: Medical condition name
- `clinics`: Array of recommended clinics
- `status`: active/review/inactive
- `confidence`: Confidence score (0-1)
- `exceptions`: Array of exception notes