import { RefreshCw, LogOut } from 'lucide-react';

export type DashboardPage = 'tasks' | 'finance' | 'collections';

interface TopBarProps {
  page: DashboardPage;
  onNavigate: (page: DashboardPage) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onSignOut: () => void;
  userEmail?: string;
}

function initials(email?: string): string {
  if (!email) return 'U';
  const base = email.split('@')[0] ?? '';
  const parts = base.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

/**
 * Shared topbar: brand dot + nav tabs + (optional) refresh + user chip with
 * sign-out. Matches the widget-dashboard topbar pattern.
 */
export function TopBar({
  page,
  onNavigate,
  onRefresh,
  refreshing,
  onSignOut,
  userEmail,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <div className="brand-dot" />
          GIM Scoreboard
        </div>
        <nav className="page-nav">
          <button
            className={page === 'tasks' ? 'active' : ''}
            onClick={() => onNavigate('tasks')}
          >
            Tasks
          </button>
          <button
            className={page === 'finance' ? 'active' : ''}
            onClick={() => onNavigate('finance')}
          >
            Finance
          </button>
          <button
            className={page === 'collections' ? 'active' : ''}
            onClick={() => onNavigate('collections')}
          >
            Collections
          </button>
        </nav>
      </div>
      <div className="topbar-right">
        {onRefresh ? (
          <button className="icon-btn" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw
              size={14}
              strokeWidth={2}
              style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined}
            />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        ) : null}
        <div className="user-chip">
          <div className="avatar">{initials(userEmail)}</div>
          <span>{userEmail ?? 'Signed in'}</span>
          <div className="user-sep" />
          <button className="link-btn" onClick={onSignOut} title="Sign out">
            <LogOut size={12} strokeWidth={2} />
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </header>
  );
}
