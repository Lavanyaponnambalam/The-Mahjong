import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { usePlayer } from '../player.jsx';
import { Button, Page } from '../components/ui.jsx';

const AVATARS = { chen: '/assets/characters/ai_master_chen.png', panda: '/assets/characters/ai_panda.png', ninja: '/assets/characters/ai_tile_ninja.png' };
const MODES = [
  { id: 'solo', title: 'Solo', blurb: 'Play alone against gentle AI opponents. Great for practice.', ai: ['chen', 'panda', 'ninja'], note: 'Easy AI' },
  { id: 'two', title: '2 players', blurb: 'You and one AI. A quieter, faster table.', ai: ['chen'] },
  { id: 'three', title: '3 players', blurb: 'You and two AI opponents.', ai: ['chen', 'panda'] },
  { id: 'four', title: 'You + 3 AI', blurb: 'The complete four-seat Mahjong experience.', ai: ['chen', 'panda', 'ninja'], rec: true },
];

export default function Mode() {
  const nav = useNavigate();
  const { current } = usePlayer();
  const [mode, setMode] = useState('four');
  const [difficulty, setDifficulty] = useState('normal');
  const [tileSet, setTileSet] = useState(136);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!current) return <Navigate to="/" replace />;

  const start = async () => {
    setBusy(true); setErr('');
    try {
      const g = await api.startGame(current.playerId, { mode, difficulty, tileSet });
      nav(`/game/${g.gameId}`, { state: { frames: g.frames, view: g.view } });
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <Page back={<Link className="text-gold-soft underline-offset-4 hover:underline" to="/dashboard">← Dashboard</Link>}>
      <h1 className="font-display text-4xl text-gold-soft sm:text-5xl">How do you want to play?</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
            className={`relative rounded-2xl border-2 p-5 text-left transition ${mode === m.id ? 'border-gold bg-gold/15 shadow-[0_0_0_4px_rgba(225,185,92,.15)]' : 'border-gold/20 bg-jade-900/70 hover:border-gold/50'}`}>
            {m.rec && <span className="absolute right-4 top-4 rounded-full bg-vermilion px-3 py-1 text-xs font-bold">Recommended</span>}
            <div className="text-2xl font-bold text-ivory">{m.title}</div>
            <p className="mt-1 text-ivory/70">{m.blurb}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gold text-sm font-extrabold text-ink ring-2 ring-gold-soft">You</span>
              {m.ai.map((a) => <img key={a} src={AVATARS[a]} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-gold/50" />)}
              {m.note && <span className="ml-1 text-sm text-gold-soft">{m.note}</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 rounded-2xl border border-gold/20 bg-jade-900/60 p-5 sm:grid-cols-2">
        <fieldset disabled={mode === 'solo'} className="disabled:opacity-50">
          <legend className="mb-2 font-bold text-gold-soft">AI strength</legend>
          <div className="flex gap-2">
            {['easy', 'normal', 'hard'].map((d) => (
              <button key={d} onClick={() => setDifficulty(d)} aria-pressed={difficulty === d} className={`flex-1 rounded-lg border px-3 py-2.5 font-semibold capitalize ${difficulty === d ? 'border-gold bg-gold text-ink' : 'border-gold/30 hover:bg-gold/10'}`}>{d}</button>
            ))}
          </div>
          {mode === 'solo' && <p className="mt-2 text-xs text-ivory/60">Solo always uses Easy AI.</p>}
        </fieldset>
        <fieldset>
          <legend className="mb-2 font-bold text-gold-soft">Tile set</legend>
          <div className="flex gap-2">
            {[[136, '136 tiles'], [144, '144 + flowers']].map(([n, l]) => (
              <button key={n} onClick={() => setTileSet(n)} aria-pressed={tileSet === n} className={`flex-1 rounded-lg border px-3 py-2.5 font-semibold ${tileSet === n ? 'border-gold bg-gold text-ink' : 'border-gold/30 hover:bg-gold/10'}`}>{l}</button>
            ))}
          </div>
        </fieldset>
      </div>

      {err && <p role="alert" className="mt-3 font-semibold text-[#ff8f86]">{err}</p>}
      <Button variant="red" onClick={start} disabled={busy} className="mt-6 w-full !py-4 text-lg sm:w-auto sm:min-w-64">{busy ? 'Shuffling the wall…' : 'Deal the tiles 🀄'}</Button>
    </Page>
  );
}
