import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { usePlayer } from '../player.jsx';
import { Button, Page, Stat } from '../components/ui.jsx';
import { formatTime, val } from '../lib.js';

export default function Dashboard() {
  const nav = useNavigate();
  const { current, profile, refresh } = usePlayer();
  const [active, setActive] = useState(null);
  useEffect(() => { refresh(); }, []); // eslint-disable-line
  useEffect(() => { if (current) api.activeGame(current.playerId).then((r) => setActive(r.active)).catch(() => {}); }, [current]);
  if (!current) return <Navigate to="/" replace />;
  const p = profile;
  const returning = p && p.gamesPlayed > 0;

  return (
    <Page>
      <h1 className="font-display text-4xl text-gold-soft sm:text-5xl">{returning ? `Welcome back, ${current.username}!` : `Welcome, ${current.username}!`} 🀄</h1>
      <p className="mt-2 text-ivory/70">{returning ? 'Your records are waiting to be broken.' : 'Your first win sets the records to beat.'}</p>

      {active && (
        <Link to={`/game/${active.gameId}`} className="mt-6 flex items-center justify-between rounded-2xl border border-vermilion/60 bg-vermilion/15 px-5 py-4 hover:bg-vermilion/25">
          <span><b className="text-gold-soft">Game in progress.</b> <span className="text-ivory/75">Your timer kept running.</span></span>
          <span className="font-bold text-gold-soft">Resume →</span>
        </Link>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon="🏆" label="Best score" value={val(p?.bestScore)} accent />
        <Stat icon="⚡" label="Best time" value={p?.bestTime != null ? formatTime(p.bestTime) : '—'} accent />
        <Stat icon="🔥" label="Best moves" value={val(p?.bestMoves)} accent />
        <Stat icon="🎮" label="Games played" value={p?.gamesPlayed ?? 0} sub={p?.gamesPlayed ? `avg score ${p.averageScore}` : null} />
        <Stat icon="🀄" label="Wins" value={p?.gamesWon ?? 0} sub={p?.gamesPlayed ? `${p.gamesLost} not won` : null} />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button variant="red" className="sm:min-w-64 !py-4 text-lg" onClick={() => nav('/mode')}>Play Mahjong 🀄</Button>
        <Button variant="ghost" onClick={() => nav('/history')}>View my history 📊</Button>
        <Button variant="ghost" onClick={() => nav('/')}>Switch player</Button>
      </div>
    </Page>
  );
}
