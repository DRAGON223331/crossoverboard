// Temporary diagnostic route: reports which required environment variables
// are visible to this running deployment — NEVER their values. Delete this
// file (or leave it, it leaks no secrets) once everything works.

const REQUIRED = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_BOT_TOKEN',
  'DASHBOARD_BASE_URL',
  'SESSION_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

export default function handler(req, res) {
  const status = Object.fromEntries(REQUIRED.map((name) => [name, Boolean(process.env[name])]));
  res.status(200).json({
    vercelEnv: process.env.VERCEL_ENV || 'unknown', // "production" | "preview" | "development"
    vercelUrl: process.env.VERCEL_URL || null,
    variables: status,
  });
}
