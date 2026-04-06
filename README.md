## AI Roadmap Generator

An AI-powered learning roadmap generator web app. Enter your goals, timeframe, and constraints, and the app uses NVIDIA NIM (meta/llama3-8b-instruct) to build a tailored, phase-based learning plan.

### 1. Prerequisites

- Node.js (v18 or newer recommended)
- An NVIDIA API key (starts with `nvapi-`)

### 2. Setup

1. Open a terminal in this folder:

   ```bash
   cd "C:\Users\dines\OneDrive\Desktop\Roadmap Generate"
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file (you can copy from `.env.example`):

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and set:

   ```bash
   NVIDIA_API_KEY=nvapi-...
   NVIDIA_MODEL=meta/llama3-8b-instruct
   NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
   PORT=3000
   ```

### 3. Run the app

```bash
npm start
```

Then open `http://localhost:3000` in your browser.

### 4. How it works

- `server.js` exposes `POST /api/generate-roadmap`, which calls NVIDIA's OpenAI-compatible chat endpoint.
- The frontend (in `public/index.html` and `public/app.js`) collects your inputs and displays the generated roadmap.
# A commit just o stay cinsistent....
