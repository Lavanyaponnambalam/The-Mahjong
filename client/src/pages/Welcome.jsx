import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { usePlayer } from '../player.jsx';
import { Button, Page } from '../components/ui.jsx';
import Tile from '../components/Tile.jsx';

const FAN = [['wan1', -18], ['bamboo3', -9], ['dots5', 0], ['east', 9], ['red', 18]];

export default function Welcome() {
  const nav = useNavigate();
  const { known, select, current } = usePlayer();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [players, setPlayers] = useState([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!known.length) return;
    api.players(known).then((r) => {
      const order = new Map(known.map((id, i) => [id, i]));
      setPlayers(r.players.sort((a, b) => order.get(a.playerId) - order.get(b.playerId)));
    }).catch(() => {});
  }, [known]);

  const go = (p) => { select(p); nav('/dashboard'); };
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { go((await api.enter(name)).player); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const showInput = !players.length || adding;

  return (
    <Page>
      <div className="grid items-center gap-10 pt-4 md:grid-cols-[1.1fr_1fr] md:pt-10">
        <section>
          <div className="mb-6 flex h-24 items-end sm:h-28" aria-hidden>
            {FAN.map(([k, r], i) => (
              <div key={k} style={{ transform: `rotate(${r}deg)`, transformOrigin: '50% 140%', marginLeft: i ? -14 : 0 }}>
                <Tile tile={{ key: k }} size="hand" />
              </div>
            ))}
          </div>
          <h1 className="font-display text-5xl leading-[1.05] text-gold-soft sm:text-6xl">Can you beat<br />your own record?</h1>
          <p className="mt-4 max-w-md text-lg text-ivory/75">Play real Chinese Mahjong against three AI opponents. Win with a higher score, in less time, using fewer moves.</p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold/15 px-4 py-2 text-sm font-semibold text-gold-soft">✓ No account required. Just a username.</p>
        </section>

        <section className="rounded-3xl border border-gold/30 bg-jade-900/80 p-6 shadow-2xl backdrop-blur sm:p-8">
          {players.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gold-soft">Who's playing?</h2>
              <ul className="mt-3 grid gap-2">
                {players.map((p) => (
                  <li key={p.playerId}>
                    <button onClick={() => go(p)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition hover:bg-gold/10 ${current?.playerId === p.playerId ? 'border-gold bg-gold/10' : 'border-gold/25'}`}>
                      <span className="flex items-center gap-3 text-lg font-semibold">👤 {p.username}</span>
                      <span className="text-sm text-ivory/60">{p.gamesPlayed ? `${p.gamesPlayed} games · best ${p.bestScore ?? '—'}` : 'New'}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {!adding && <button onClick={() => setAdding(true)} className="mt-3 w-full rounded-xl border border-dashed border-gold/40 py-3 font-semibold text-gold-soft hover:bg-gold/10">+ Add new player</button>}
            </div>
          )}
          {showInput && (
            <form onSubmit={submit}>
              <label htmlFor="u" className="text-xl font-bold text-gold-soft">What's your username?</label>
              <p className="mt-1 text-sm text-ivory/60">Type the same name later to pick up your records. Capital letters don't matter.</p>
              <input id="u" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="off" placeholder="e.g. Lavanya"
                className="mt-4 w-full rounded-xl border-2 border-gold/40 bg-ink/60 px-4 py-3.5 text-xl text-ivory placeholder:text-ivory/30 focus:border-gold focus:outline-none" />
              {err && <p role="alert" className="mt-2 text-sm font-semibold text-[#ff8f86]">{err}</p>}
              <Button type="submit" disabled={busy || !name.trim()} className="mt-4 w-full">{busy ? 'One moment…' : 'Continue →'}</Button>
            </form>
          )}
        </section>
      </div>
    </Page>
  );
}
