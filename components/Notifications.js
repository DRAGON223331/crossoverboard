import { useState } from 'react';
import { useLanguage } from '../lib/i18n';

export default function Notifications() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const notifications = [
    { id: 1, title: t.notificationUpdateTitle, body: t.notificationUpdateBody },
    { id: 2, title: t.notificationFeatureTitle, body: t.notificationFeatureBody },
  ];

  return (
    <div className="notification-wrap">
      <button className="icon-btn notification-btn" type="button" onClick={() => setOpen(!open)} aria-label={t.notifications} aria-expanded={open}>
        🔔<span className="notification-dot" />
      </button>
      {open && (
        <div className="notification-panel">
          <div className="notification-head"><strong>{t.notifications}</strong><span>{notifications.length}</span></div>
          {notifications.map((item) => (
            <div className="notification-item" key={item.id}>
              <div className="notification-title">{item.title}</div>
              <div className="notification-body">{item.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
