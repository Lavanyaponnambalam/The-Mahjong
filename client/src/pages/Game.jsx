import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { usePlayer } from '../player.jsx';
import Tile from '../components/Tile.jsx';
import Confetti from '../components/Confetti.jsx';
import { Button } from '../components/ui.jsx';
import Result from '../game/Result.jsx';
import { Opponent, Pool, Melds, Badges, positions, useMedia, Avatar } from '../game/Table.jsx';
import { formatTime, tileName } from '../lib.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DELAY = { thinking: 550, draw: 320, flower: 450, discard: 650, pong: 1100, chow: 1100, kong: 1200, win: 1000, drawGame: 800 };
const BANNER = { pong: 'PONG!', chow: 'CHOW!', kong: 'KONG!', win: '🀄 MAHJONG!' };

function Hud({ time, moves, score, wall, turnLabel }) {
  const Cell = ({ k, v, big }) => (
    <div className="min-w-0 text-center"><div className="text-[11px] leading-none text-gold-soft/80">{k}</div><div className={`mt-1 font-extrabold tabular-nums leading-none ${big ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>{v}</div></div>
  );
  return (
    <div className="sticky top-0 z-30 border-b border-gold/25 bg-ink/90 px-3 pb-2 pt-[max(.5rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link to="/dashboard" className="shrink-0 font-display text-xl text-gold-soft" aria-label="Leave table">中</Link>
        <div className="grid flex-1 grid-cols-4 items-center gap-2">
          <Cell k="⏱ Time" v={time} big />
          <Cell k="Moves" v={moves} />
          <Cell k="Score" v={score} />
          <Cell k="Wall" v={wall} />
        </div>
      </div>
      <div className="mx-auto mt-1 max-w-6xl text-center text-xs font-semibold text-gold-soft" aria-live="polite">{turnLabel}</div>
    </div>
  );
}

function ClaimPanel({ view, onAct, busy, fromName }) {
  const c = view.you.claim;
  const [pickChow, setPickChow] = useState(false);
  const hand = view.seats.find((s) => s.isYou).hand;
  const byId = Object.fromEntries(hand.map((t) => [t.id, t]));
  return (
    <div className="mx-auto mb-3 w-full max-w-2xl rounded-2xl border border-gold/50 bg-ink/80 p-3 anim-rise">
      <div className="flex items-center justify-center gap-3 text-sm sm:text-base">
        <Tile tile={{ key: c.tile.key }} size="md" glow />
        <span><b>{fromName}</b> discarded <b className="text-gold-soft">{tileName(c.tile.key)}</b>. Claim it?</span>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {c.win && <Button variant="red" disabled={busy} onClick={() => onAct({ type: 'win' })}>🀄 Mahjong!</Button>}
        {c.kong && <Button disabled={busy} onClick={() => onAct({ type: 'kong' })}>Kong</Button>}
        {c.pong && <Button disabled={busy} onClick={() => onAct({ type: 'pong' })}>Pong</Button>}
        {c.chow.length === 1 && <Button disabled={busy} onClick={() => onAct({ type: 'chow', tiles: c.chow[0] })}>Chow</Button>}
        {c.chow.length > 1 && <Button disabled={busy} onClick={() => setPickChow(!pickChow)}>Chow ▾</Button>}
        <Button variant="ghost" disabled={busy} onClick={() => onAct({ type: 'pass' })}>Pass</Button>
      </div>
      {pickChow && (
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          {c.chow.map((ids) => {
            const tiles = [...ids.map((i) => byId[i]), { key: c.tile.key, id: -1 }].sort((a, b) => a.key.localeCompare(b.key));
            return (
              <button key={ids.join()} onClick={() => onAct({ type: 'chow', tiles: ids })} className="flex gap-0.5 rounded-lg border border-gold/40 bg-jade-800 p-1.5 hover:bg-gold/20" aria-label="Choose this Chow">
                {tiles.map((t, i) => <Tile key={i} tile={t} size="sm" />)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Game() {
  const { id } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const { current, refresh, logout } = usePlayer();
  const wide = useMedia('(min-width: 768px)');

  const [view, setView] = useState(loc.state?.view || null);
  const [summary, setSummary] = useState(null);
  const [event, setEvent] = useState(null);
  const [banner, setBanner] = useState(null);
  const [bubbles, setBubbles] = useState({});
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [, tick] = useState(0);
  const timing = useRef(null);
  const liveScore = useRef(0);
  const alive = useRef(true);
  const loadedFor = useRef(null);
  const playerId = current?.playerId;

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(t); }, []);

  const noteView = (v) => {
    if (v?.startedAt) timing.current = { startedAt: v.startedAt, skew: v.serverNow - Date.now() };
    if (v?.liveScore != null) liveScore.current = v.liveScore;
  };

  const say = (e) => {
    if (e.msg) setLog((l) => [...l.slice(-2), e.msg]);
    if (e.chat && e.seat != null) { setBubbles((b) => ({ ...b, [e.seat]: e.chat })); setTimeout(() => setBubbles((b) => { const n = { ...b }; delete n[e.seat]; return n; }), 2400); }
    if (BANNER[e.type]) { setBanner({ text: BANNER[e.type], seat: e.seat, k: Math.random() }); setTimeout(() => setBanner(null), e.type === 'win' ? 1800 : 1000); }
  };

  const play = useCallback(async (frames, finalView, sum) => {
    setBusy(true);
    for (const f of frames || []) {
      if (!alive.current) return;
      noteView(f.view); setView(f.view); setEvent(f.event); say(f.event);
      const mine = f.event.seat === f.view.you.seat;
      await sleep(Math.round((DELAY[f.event.type] ?? 400) * (mine && f.event.type !== 'win' ? 0.55 : 1)));
    }
    if (!alive.current) return;
    if (finalView) { noteView(finalView); setView(finalView); }
    setEvent(null); setBusy(false);
    if (sum) {
      setSummary(sum); refresh();
      if (sum.result === 'WIN') setCelebrate(true);
      await sleep(sum.result === 'WIN' ? 2200 : 1200);
      if (alive.current) setShowResult(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load (or restore after refresh) the authoritative state from the server.
  useEffect(() => {
    if (!playerId || loadedFor.current === id) return; // StrictMode runs effects twice in dev
    loadedFor.current = id;
    (async () => {
      try {
        if (loc.state?.view) { noteView(loc.state.view); await play(loc.state.frames, loc.state.view); return; }
        const g = await api.game(id, playerId);
        if (g.status === 'completed') { setSummary(g.summary); setShowResult(true); return; }
        noteView(g.view); setView(g.view);
      } catch (e) { setError(e.message); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, playerId]);

  const act = async (action) => {
    if (busy || !view) return;
    setError(''); setSelected(null);
    try {
      const r = await api.act(id, playerId, action);
      await play(r.frames, r.view, r.summary);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const again = async () => {
    setRestarting(true);
    try {
      const g = await api.startGame(playerId, { mode: summary.mode, difficulty: summary.difficulty, tileSet: view?.config?.tileSet || 136 });
      setShowResult(false); setCelebrate(false); setSummary(null); setLog([]); setView(null); setRestarting(false);
      nav(`/game/${g.gameId}`, { replace: true, state: { frames: g.frames, view: g.view } });
    } catch (e) { setError(e.message); setRestarting(false); }
  };

  const me = view?.seats.find((s) => s.isYou);
  const pos = useMemo(() => (view ? positions(view) : {}), [view]);
  const ended = view?.phase === 'ended';
  const myTurn = view && view.phase === 'turn' && view.turn === view.you.seat;
  const canDiscard = myTurn && !busy;
  const timeMs = view?.timeMs ?? (timing.current ? Date.now() + timing.current.skew - timing.current.startedAt : 0);
  const turnSeat = view?.seats[view?.turn];
  const turnLabel = !view ? '' : ended ? 'Game over' : view.phase === 'claim' ? 'Claim window' : myTurn ? (busy ? '…' : 'Your turn: tap a tile twice to discard') : `${turnSeat?.persona?.name ?? ''}'s turn`;
  const moodFor = (seat) => {
    if (ended) return view.result.winner === seat.seat ? 'win' : view.result.winner === view.you.seat ? 'lose' : 'idle';
    if (event?.type === 'thinking' && event.seat === seat.seat) return 'thinking';
    if (banner && banner.seat === seat.seat) return banner.text.includes('MAHJONG') ? 'win' : 'surprised';
    if (event?.type === 'discard' && event.seat !== seat.seat) return 'happy';
    return 'idle';
  };
  const lastId = view?.lastDiscard?.id;
  const opp = (p) => {
    const s = pos[p]; if (!s) return null;
    return <Opponent seat={s} pos={p} active={view.turn === s.seat && !ended} thinking={event?.type === 'thinking' && event.seat === s.seat} mood={moodFor(s)} bubble={bubbles[s.seat]} />;
  };

  // --- player's hand -------------------------------------------------------
  const hand = me?.hand || [];
  const drawn = hand.find((t) => t.id === view?.you.drawnId);
  const rest = hand.filter((t) => t !== drawn);
  const onTile = (t) => { if (!canDiscard) return; if (selected === t.id) act({ type: 'discard', tileId: t.id }); else setSelected(t.id); };
  const opts = view?.you.turnOptions;

  const myArea = view && (
    <div className="relative">
      {view.phase === 'claim' && view.you.claim && !busy && <ClaimPanel view={view} onAct={act} busy={busy} fromName={view.seats[view.you.claim.from].persona?.name} />}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 pb-1 text-sm">
        <span className={`inline-flex items-center gap-2 font-bold ${myTurn ? 'text-gold-soft' : 'text-ivory/80'}`}><Badges seat={me} /> {current?.username}</span>
        <Melds seat={me} size="sm" />
      </div>
      <div className="hand-scroll overflow-x-auto px-2 pt-4 pb-2">
        <div className="mx-auto flex w-max items-end gap-1">
          {rest.map((t) => <Tile key={t.id} tile={t} size="hand" selected={selected === t.id} onClick={() => onTile(t)} disabled={!canDiscard} />)}
          {drawn && <div className="ml-3 sm:ml-5"><Tile key={drawn.id} tile={drawn} size="hand" selected={selected === drawn.id} onClick={() => onTile(drawn)} disabled={!canDiscard} animate="anim-draw" glow={myTurn} /></div>}
        </div>
      </div>
      <div className="flex min-h-14 flex-wrap items-center justify-center gap-2 px-2 pb-2">
        {myTurn && !busy && opts?.canWin && <Button variant="red" onClick={() => act({ type: 'win' })} className="!px-8 !py-4 text-lg">🀄 Mahjong!</Button>}
        {myTurn && !busy && opts?.kongs.map((k) => <Button key={k.key} onClick={() => act({ type: 'kong', key: k.key })}>Kong {tileName(k.key)}</Button>)}
        {canDiscard && selected != null && <Button variant="ghost" onClick={() => act({ type: 'discard', tileId: selected })}>Discard selected</Button>}
        {myTurn && !busy && selected == null && !opts?.canWin && <span className="text-sm text-ivory/60">Tap a tile to select it, tap again to discard.</span>}
      </div>
    </div>
  );

  const center = view && (
    <div className="grid h-full w-full grid-cols-[1fr_auto_1fr] grid-rows-[auto_1fr_auto] gap-2 p-2">
      <div className="col-start-2 row-start-1 min-h-8 max-w-[26rem] justify-self-center">{pos.top && <Pool seat={pos.top} lastId={lastId} name={pos.top.persona?.name} className="justify-center" />}</div>
      <div className="col-start-1 row-start-2 min-w-0 max-w-[10.5rem] self-center justify-self-end">{pos.left && <Pool seat={pos.left} lastId={lastId} name={pos.left.persona?.name} className="justify-end" />}</div>
      <div className="col-start-2 row-start-2 grid place-items-center">
        <div className="rounded-2xl bg-black/25 px-5 py-3 text-center ring-1 ring-gold/30">
          <div className="text-xs text-gold-soft/80">Tiles in the wall</div>
          <div className="font-display text-5xl leading-none tabular-nums text-ivory">{view.wallLeft}</div>
          <div className="mt-1 text-xs text-ivory/70">Round wind 東 · {view.seats[view.dealer].isYou ? 'you deal' : `${view.seats[view.dealer].persona.name} deals`}</div>
        </div>
      </div>
      <div className="col-start-3 row-start-2 min-w-0 max-w-[10.5rem] self-center justify-self-start">{pos.right && <Pool seat={pos.right} lastId={lastId} name={pos.right.persona?.name} />}</div>
      <div className="col-start-2 row-start-3 min-h-8 max-w-[26rem] justify-self-center">{pos.bottom && <Pool seat={pos.bottom} lastId={lastId} name="Your" className="justify-center" />}</div>
    </div>
  );

  if (!current) { return <div className="grid min-h-full place-items-center p-6"><div className="text-center"><p className="mb-4 text-lg">Choose a player to continue this game.</p><Button onClick={() => nav('/')}>Choose player</Button></div></div>; }
  if (!view && !summary) {
    return <div className="grid min-h-full place-items-center p-6 text-center">{error ? <div><p className="mb-4 text-[#ff8f86]">{error}</p><Button onClick={() => nav('/dashboard')}>Dashboard</Button></div> : <p className="font-display text-3xl text-gold-soft">Setting the table…</p>}</div>;
  }

  return (
    <div className="flex min-h-full flex-col">
      {view && <Hud time={formatTime(timeMs)} moves={view.moves} score={liveScore.current} wall={view.wallLeft} turnLabel={turnLabel} />}
      {view && (
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-2 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mb-2 min-h-5 text-center text-sm text-ivory/80" aria-live="polite">{log[log.length - 1]}</div>

          {wide ? (
            <div className="felt relative grid flex-1 grid-cols-[11rem_1fr_11rem] grid-rows-[auto_1fr_auto] rounded-[2.2rem] p-6">
              <div className="col-span-3 flex min-h-[7rem] justify-center">{opp('top')}</div>
              <div className="flex items-center justify-center">{opp('left')}</div>
              <div className="relative min-h-[16rem]">{center}</div>
              <div className="flex items-center justify-center">{opp('right')}</div>
              <div className="col-span-3 mt-2 rounded-2xl bg-black/20 pt-1 ring-1 ring-gold/20">{myArea}</div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-2">
              <div className={`grid gap-1 ${Object.keys(pos).length === 2 ? 'grid-cols-1' : Object.keys(pos).length === 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {['left', 'top', 'right'].filter((p) => pos[p]).map((p) => {
                  const s = pos[p]; const act_ = view.turn === s.seat && !ended;
                  return (
                    <div key={p} className="rounded-xl bg-jade-800/80 p-2 ring-1 ring-gold/20">
                      <div className="flex items-center gap-2">
                        <Avatar seat={s} mood={moodFor(s)} size="h-10 w-10" active={act_} />
                        <div className="min-w-0 text-xs"><div className="truncate font-bold">{s.persona.name}</div><div className="flex items-center gap-1 text-ivory/70"><Badges seat={s} /> {s.handCount}</div></div>
                      </div>
                      <div className="mt-1"><Melds seat={s} /></div>
                      {(bubbles[s.seat] || (event?.type === 'thinking' && event.seat === s.seat)) && <div className="mt-1 rounded-lg bg-ivory px-2 py-1 text-[11px] font-semibold text-ink">{event?.type === 'thinking' && event.seat === s.seat ? 'Thinking…' : bubbles[s.seat]}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="felt relative rounded-2xl p-2">
                <div className="mb-1 text-center text-xs text-ivory/80">Discards · wall {view.wallLeft}</div>
                <div className="space-y-1">
                  {view.seats.map((s) => <div key={s.seat} className="flex items-start gap-2"><span className="w-12 shrink-0 truncate pt-1 text-[10px] text-ivory/70">{s.isYou ? 'You' : s.persona.name.split(' ')[1]}</span><Pool seat={s} lastId={lastId} name={s.persona?.name || 'Your'} className="flex-1" /></div>)}
                </div>
              </div>
              <div className="felt relative mt-auto rounded-2xl pt-1">{myArea}</div>
            </div>
          )}
          {error && <p role="alert" className="mt-2 text-center font-semibold text-[#ff8f86]">{error}</p>}
          {banner && <div key={banner.k} className="pointer-events-none fixed inset-0 z-40 grid place-items-center"><div className="anim-claim rounded-3xl bg-ink/70 px-10 py-5 font-display text-6xl text-gold-soft shadow-2xl ring-2 ring-gold sm:text-8xl">{banner.text}</div></div>}
        </div>
      )}
      {celebrate && <Confetti count={150} />}
      {showResult && summary && (
        <Result summary={summary} busy={restarting} onAgain={again} onHistory={() => nav('/history')} onDashboard={() => nav('/dashboard')} onSwitch={() => { logout(); nav('/'); }} />
      )}
    </div>
  );
}
