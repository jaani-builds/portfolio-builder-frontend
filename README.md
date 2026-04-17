# Portfolio Builder Frontend

Static management UI for the portfolio builder.

Recommended production hosting:

- Frontend on Cloudflare Pages
- Backend on AWS Lambda + API Gateway

Responsibilities:
- OAuth login screen (GitHub, Google, LinkedIn)
- Resume upload and parse workflow
- Slug selection and publish flow
- Session token storage and API communication

## Backend integration

This frontend talks to the backend API at `http://localhost:8000` by default.

- Login redirect targets:
	- `GET /api/auth/github`
	- `GET /api/auth/google`
	- `GET /api/auth/linkedin`
- Exchange callback flow: `GET /api/auth/exchange`
- Resume + slug management routes under `/api/resume` and `/api/portfolio`

Override API base at runtime with query parameter:

- `http://localhost:5174/?apiBase=http://localhost:8000`

For production, the API base is:

- `https://api.portfolio.handytools.work`

The backend is expected to be configured with AWS-native services:

- Auth via OAuth providers (GitHub, Google, LinkedIn)
- Storage via Amazon S3
- Metadata via DynamoDB

## Deploy to Cloudflare Pages

This project is static and does not require a build step.

Suggested Pages settings:

- Framework preset: `None`
- Build command: leave empty
- Build output directory: `.`
- Root directory: `portfolio-builder-frontend` (if deploying from monorepo)

After deployment:

1. Use your Pages URL as Terraform `frontend_url` value in backend infra.
2. Ensure backend is deployed and GitHub OAuth callback is configured.
3. Set API base URL in `config.js`:
	window.__PB_API_BASE__ = "https://<your-api-gateway-domain>";
4. Optional one-off override: append `?apiBase=https://<your-api-gateway-domain>`.

## Custom domain (deployed)

This frontend is hosted at `https://app.portfolio.handytools.work`:

1. Custom domain `app.portfolio.handytools.work` added in Cloudflare Pages.
2. Backend Terraform variable:
	`frontend_url = "https://app.portfolio.handytools.work"`
3. GitHub OAuth App values:
	Homepage URL: https://app.portfolio.handytools.work
	Authorization callback URL: https://api.portfolio.handytools.work/api/auth/callback/github
4. In frontend `config.js`:
	`window.__PB_API_BASE__ = "https://api.portfolio.handytools.work";`

## Local Docker run

1. Start backend first (`portfolio-builder-backend/start-docker.sh`).
2. Start the frontend:

```bash
./start-docker.sh
```

Stop it with:

```bash
./stop-docker.sh
```

URL:
- App: http://localhost:5174
