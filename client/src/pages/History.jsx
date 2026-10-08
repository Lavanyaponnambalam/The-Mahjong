import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { usePlayer } from '../player.jsx';
import { Page, Stat } from '../components/ui.jsx';
import { formatDate, formatTime, val } from '../lib.js';

function Detail({ id, playerId }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.details(id, playerId).then(setD).catch(() => setD({ error: true })); }, [id, playerId]);
  if (!d) return <div className="px-4 py-3 text-ivory/60">Loading…</div>;
  if (d.error) return <div className="px-4 py-3 text-[#ff8f86]">Could not load this game.</div>;
  const s = d.summary;
  const mine = d.actions.filter((a) => a.byPlayer);
  const count = (t) => mine.filter((a) => a.type === t).length;
  return (
    <div className="grid gap-4 border-t border-gold/20 px-4 py-4 sm:grid-cols-2">
      <div>
        <h3 className="font-bold text-gold-soft">Score breakdown</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {s.breakdown.map((b, i) => <li key={i} className="flex justify-between"><span className="text-ivory/80">{b.label}</span><b className="tabular-nums">+{b.points}</b></li>)}
          <li className="flex justify-between border-t border-gold/20 pt-1 text-base"><span>Final</span><b className="text-gold-soft tabular-nums">{s.score}</b></li>
        </ul>
      </div>
      <div>
        <h3 className="font-bold text-gold-soft">Table</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {s.seats.map((x) => <li key={x.seat} className="flex justify-between"><span>{x.emoji} {x.name} {x.won && '🏆'}</span><b className="tabular-nums">{x.score}</b></li>)}
        </ul>
        <p className="mt-3 text-sm text-ivory/70">Your moves: {count('draw')} draws, {count('discard')} discards, {count('chow')} chow, {count('pong')} pong, {count('kong')} kong, {count('mahjong')} mahjong.</p>
        <p className="mt-1 text-xs text-ivory/50">{s.players} seats · {s.mode === 'solo' ? 'solo' : s.difficulty} AI</p>
      </div>
    </div>
  );
}

export default function History() {
  const { current } = usePlayer();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { if (current) api.history(current.playerId).then(setData).catch(() => setData({ games: [], player: null })); }, [current]);
  if (!current) return <Navigate to="/" replace />;
  const p = data?.player;

  return (
    <Page back={<Link className="text-gold-soft hover:underline" to="/dashboard">← Dashboard</Link>}>
      <h1 className="font-display text-4xl text-gold-soft sm:text-5xl">My Mahjong history</h1>
      <h2 className="mt-6 font-bold text-gold-soft">Personal records</h2>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <Stat icon="🏆" label="Highest score" value={val(p?.bestScore)} accent />
        <Stat icon="⚡" label="Fastest game" value={p?.bestTime != null ? formatTime(p.bestTime) : '—'} accent />
        <Stat icon="🔥" label="Fewest moves" value={val(p?.bestMoves)} accent />
      </div>
      {p && p.gamesPlayed > 0 && <p className="mt-3 text-sm text-ivory/65">{p.gamesPlayed} games · {p.gamesWon} wins · average score {p.averageScore} · {p.totalMoves} total moves · {formatTime(p.totalPlayTime)} total play time</p>}

      <h2 className="mt-8 font-bold text-gold-soft">Recent games</h2>
      {!data && <p className="mt-3 text-ivory/60">Loading…</p>}
      {data && !data.games.length && <p className="mt-3 rounded-xl border border-gold/20 p-5 text-ivory/70">No finished games yet. Your first game is waiting.</p>}
      <ul className="mt-3 space-y-2">
        {data?.games.map((g) => (
          <li key={g.gameId} className="overflow-hidden rounded-xl border border-gold/20 bg-jade-900/70">
            <button onClick={() => setOpen(open === g.gameId ? null : g.gameId)} aria-expanded={open === g.gameId} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-gold/5">
              <span className="font-bold text-gold-soft">Game #{g.gameNumber}</span>
              <span className="text-sm tabular-nums text-ivory/80">{g.score} pts · {formatTime(g.timeTaken)} · {g.moves} moves</span>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${g.result === 'WIN' ? 'bg-gold text-ink' : 'bg-ivory/10 text-ivory/80'}`}>{g.result === 'WIN' ? '🏆 WIN' : g.result}</span>
              <span className="col-span-3 text-xs text-ivory/50">{formatDate(g.completedAt)} · {g.winner ? `won by ${g.winner}` : 'no winner'}</span>
            </button>
            {open === g.gameId && <Detail id={g.gameId} playerId={current.playerId} />}
          </li>
        ))}
      </ul>
    </Page>
  );
}
