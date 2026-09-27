// Gate for pages that show data with no per-server scope (e.g. the personal,
// player-to-player block list — see lib/redis.js#getAllBlocks). Anyone who
// manages a Discord server can log into this dashboard, but only the bot's
// own owner should see data that isn't tied to a server they manage.
//
// Defaults to the same Discord user ID hardcoded as BOT_OWNER_ID in the
// bot's own handlers/ownerTools.js, so this stays in sync with the bot
// without extra setup. Override with OWNER_DISCORD_ID in your env vars if
// the bot's owner ID ever changes.
const OWNER_DISCORD_ID = process.env.OWNER_DISCORD_ID || '1286035404323164172';

function isOwner(session) {
  return Boolean(session?.user?.id && session.user.id === OWNER_DISCORD_ID);
}

module.exports = { OWNER_DISCORD_ID, isOwner };
