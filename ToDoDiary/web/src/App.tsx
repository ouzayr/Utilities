import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './firebase';
import { SignIn } from './components/SignIn';
import { DailyView } from './components/DailyView';
import { WeeklyView } from './components/WeeklyView';
import { todayIso } from './dates';

type View = 'daily' | 'weekly';
type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [view, setView] = useState<View>('daily');
  const [date, setDate] = useState(todayIso());
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  if (user === undefined) {
    return <div className="loading">Loading…</div>;
  }
  if (!user) {
    return <SignIn />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">🖋️ ToDoDiary</span>
        <nav>
          <button className={`chip ${view === 'daily' ? 'primary' : ''}`} onClick={() => setView('daily')}>
            Daily
          </button>
          <button className={`chip ${view === 'weekly' ? 'primary' : ''}`} onClick={() => setView('weekly')}>
            Weekly
          </button>
        </nav>
        <div className="topbar-right">
          <button
            className="icon-btn"
            title="Toggle dark mode"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <span className="user" title={user.email ?? ''}>
            {user.displayName ?? user.email}
          </span>
          <button className="chip" onClick={() => void signOut(auth)}>
            Sign out
          </button>
        </div>
      </header>

      {view === 'daily' ? (
        <DailyView uid={user.uid} date={date} onDateChange={setDate} />
      ) : (
        <WeeklyView
          uid={user.uid}
          anchor={date}
          onAnchorChange={setDate}
          onOpenDay={(d) => {
            setDate(d);
            setView('daily');
          }}
        />
      )}
    </div>
  );
}
