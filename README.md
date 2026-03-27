# QuickCal

A Chrome extension that shows your Google Calendar schedule in a daily timeline view, right from the toolbar.

## Features

- **Daily timeline** — View today's events in a compact timeline popup
- **Multiple calendars** — Select and overlay multiple Google Calendars
- **Toolbar badge** — Countdown badge shows minutes until your next event
- **Event details** — Click any event to see location, description, and a link to Google Calendar
- **Quick add** — Jump to Google Calendar's event creation with one click
- **Day navigation** — Browse past and future days with prev/next buttons
- **i18n** — English and Japanese

## Setup

### Prerequisites

- Node.js
- A Google Cloud project with the [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) enabled
- An OAuth 2.0 client ID of type **Chrome extension**

### Google Cloud configuration

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID with application type **Chrome extension**
3. Set the extension ID (you can find it on `chrome://extensions` after loading the unpacked extension once)
4. Copy the client ID and replace `oauth2.client_id` in `public/manifest.json`

### Install and build

```sh
npm install
npm run build
```

The built extension is output to `dist/`.

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` directory

## Development

```sh
npm run dev        # Build with watch mode
npm run typecheck  # Run TypeScript type checks
npm test           # Run tests
npm run package    # Build and create quickcal.zip
```

## Project structure

```
src/
├── background.ts          # Service worker — badge updates and alarm scheduling
├── popup.html / popup.ts  # Toolbar popup — daily timeline UI
├── popup.css
├── options.html / options.ts  # Options page — calendar selection
├── options.css
└── lib/
    ├── config.ts           # Constants (storage keys, API URLs, badge config)
    ├── date.ts             # Date utilities and CalendarEvent type
    ├── google-calendar.ts  # Google Calendar API client
    ├── badge.ts            # Badge text formatting
    └── i18n.ts             # Internationalization helper
tests/
├── date.test.ts
└── badge.test.ts
public/
├── manifest.json
├── icons/
└── _locales/
    ├── en/messages.json
    └── ja/messages.json
```

## License

MIT
