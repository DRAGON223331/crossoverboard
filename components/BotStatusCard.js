import { useLanguage } from '../lib/i18n';

export default function BotStatusCard({ status }) {
  const { t } = useLanguage();
  const online = status?.online;
  return (
    <section className="bot-status-card fade-in-up d1">
      <div className="bot-status-main">
        <div className={`status-orb ${online ? 'online' : 'offline'}`} />
        <div>
          <div className="bot-status-title">{online ? t.botOnline : t.botOffline}</div>
          <div className="bot-status-sub">Crossover</div>
        </div>
      </div>
      <div className="bot-status-stats">
        <div><span>{t.ping}</span><strong>{status?.ping != null ? `${status.ping}ms` : '—'}</strong></div>
        <div><span>{t.uptime}</span><strong>{status?.uptime || '—'}</strong></div>
        <div><span>{t.version}</span><strong>{status?.version || 'v0.1'}</strong></div>
      </div>
    </section>
  );
}
