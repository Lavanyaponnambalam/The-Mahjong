import { useState } from 'react';
import { Button } from '../components/ui.jsx';
import Confetti from '../components/Confetti.jsx';
import { formatTime } from '../lib.js';

const SPECIAL = ['Seven Pairs', 'Thirteen Orphans', 'All honors', 'Pure one suit', 'Mixed one suit', 'Big Three Dragons', 'Little Three Dragons', 'All Pongs', 'All Chows'];

function Breakdown({ items, won }) {
  const base = items.filter((i) => i.label === 'Winning hand' || i.label.startsWith('Hand progress'));
  const special = items.filter((i) => SPECIAL.includes(i.label));
  const bonus = items.filter((i) => !base.includes(i) && !special.includes(i));
  const sum = (a) => a.reduce((t, i) => t + i.points, 0);
  const Group = ({ title, rows }) => rows.length > 0 && (
    <div className="py-2">
      <div className="text-sm font-bold text-gold-soft">{title} <span className="tabular-nums">+{sum(rows)}</span></div>
      {rows.map((r, i) => <div key={i} className="flex justify-between text-sm text-ivory/80"><span>{r.label}</span><span className="tabular-nums">+{r.points}</span></div>)}
    </div>
  );
  return (
    <div className="divide-y divide-gold/15 rounded-xl border border-gold/20 bg-ink/40 px-4 py-1">
      <Group title={won ? 'Base score' : 'No win - hand progress'} rows={base} />
      <Group title="Bonuses" rows={bonus} />
      <Group title="Special hands" rows={special} />
      <div className="flex justify-between py-2 text-lg font-extrabold"><span>Final score</span><span className="tabular-nums text-gold-soft">{sum(items)}</span></div>
    </div>
  );
}

function Compare({ icon, label, now, best, better, fmt = (v) => v, isNew }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${isNew ? 'border-gold bg-gold/15' : 'border-gold/20 bg-ink/30'}`}>
      <div className="text-sm text-gold-soft/90">{icon} {label}</div>
      <div className="text-2xl font-extrabold tabular-nums">{fmt(now)} {isNew && <span className="text-gold-soft">{better}</span>}</div>
      {!isNew && best != null && <div className="text-xs text-ivory/60">Your best: {fmt(best)}</div>}
      {isNew && best != null && <div className="text-xs text-ivory/60">Previous: {fmt(best)}</div>}
    </div>
  );
}

export default function Result({ summary: s, onAgain, onHistory, onDashboard, onSwitch, busy }) {
  const [rules, setRules] = useState(false);
  const won = s.result === 'WIN';
  const { previous: prev, newBest, anyNew, firstWin } = s.records;
  const headline = won ? '🏆 WIN' : s.result === 'DRAW' ? 'DRAW' : 'LOSS';
  const bestScore = prev.score;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/85 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Game over">
      {won && anyNew && <Confetti gold count={170} />}
      <div className="mx-auto my-6 w-[min(94vw,640px)] rounded-3xl border border-gold/40 bg-jade-900 p-5 shadow-2xl anim-rise sm:p-7">
        <h2 className="text-center font-display text-4xl text-gold-soft sm:text-5xl">🀄 Game over</h2>
        <p className="mt-1 text-center text-ivory/70">{s.username} · {s.winner ? (won ? 'you declared Mahjong' : `${s.winner} won${s.winType === 'self' ? ' by self-draw' : ' on a discard'}`) : 'the wall ran out'}</p>

        <div className="mt-5 grid grid-cols-4 gap-2 text-center">
          {[['Score', s.score], ['Time', formatTime(s.timeTaken)], ['Moves', s.moves], ['Result', headline]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-ink/50 px-1 py-3"><div className="text-xs text-gold-soft/80">{k}</div><div className={`font-extrabold tabular-nums ${k === 'Result' ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'}`}>{v}</div></div>
          ))}
        </div>

        {won && anyNew && (
          <div className="mt-5 anim-mj">
            <h3 className="text-center text-2xl font-extrabold shimmer-gold">{firstWin ? '🏆 Your first records!' : '🏆 New personal best!'}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Compare icon="🏆" label="Highest score" now={s.score} best={prev.score} better="↑" isNew={newBest.score} />
              <Compare icon="⚡" label="Fastest time" now={s.timeTaken} best={prev.time} better="⚡" fmt={formatTime} isNew={newBest.time} />
              <Compare icon="🔥" label="Fewest moves" now={s.moves} best={prev.moves} better="🔥" isNew={newBest.moves} />
            </div>
            <p className="mt-2 text-center text-sm text-ivory/70">{[newBest.score && 'NEW BEST SCORE! 🏆', newBest.time && 'NEW BEST TIME! ⚡', newBest.moves && 'NEW BEST MOVE COUNT! 🔥'].filter(Boolean).join('  ')}</p>
          </div>
        )}
        {won && !anyNew && (
          <div className="mt-5 text-center">
            <p className="text-lg font-bold text-gold-soft">So close! 👀</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Compare icon="🏆" label={`Score (best ${bestScore})`} now={s.score} />
              <Compare icon="⚡" label={`Time (best ${formatTime(prev.time)})`} now={s.timeTaken} fmt={formatTime} />
              <Compare icon="🔥" label={`Moves (best ${prev.moves})`} now={s.moves} />
            </div>
          </div>
        )}
        {!won && (
          <div className="mt-5 rounded-xl border border-gold/20 bg-ink/30 p-4 text-center">
            {bestScore != null ? (<>
              <p>You scored <b className="tabular-nums">{s.score}</b>. Your best: <b className="tabular-nums text-gold-soft">{bestScore}</b></p>
              <p className="mt-1 font-bold text-gold-soft">You're getting closer. 👀</p>
            </>) : <p>Win a game to set your first personal records.</p>}
            <p className="mt-1 text-xs text-ivory/55">Records (best score, time and moves) are set by winning hands.</p>
          </div>
        )}

        <h3 className="mb-2 mt-6 font-bold text-gold-soft">How your score was made</h3>
        <Breakdown items={s.breakdown} won={won} />

        <h3 className="mb-2 mt-5 font-bold text-gold-soft">The table</h3>
        <ul className="space-y-1 text-sm">{s.seats.map((x) => <li key={x.seat} className="flex justify-between rounded-lg bg-ink/30 px-3 py-1.5"><span>{x.emoji} {x.name} {x.won && '🏆'}</span><b className="tabular-nums">{x.score}</b></li>)}</ul>

        <button onClick={() => setRules(!rules)} className="mt-4 text-sm font-semibold text-gold-soft underline-offset-4 hover:underline" aria-expanded={rules}>{rules ? 'Hide' : 'Show'} supported scoring rules</button>
        {rules && (
          <div className="mt-2 rounded-xl bg-ink/40 p-3 text-xs text-ivory/75">
            <b className="text-gold-soft">Implemented:</b> {s.rules.supported.join(', ')}.
            <div className="mt-2"><b className="text-gold-soft">Not implemented:</b> {s.rules.unsupported.join('; ')}.</div>
          </div>
        )}

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button variant="red" onClick={onAgain} disabled={busy} className="sm:col-span-2 !py-4 text-lg">{busy ? 'Shuffling…' : 'Play again 🔄'}</Button>
          <Button variant="ghost" onClick={onHistory}>My history 📊</Button>
          <Button variant="ghost" onClick={onDashboard}>Dashboard</Button>
          <Button variant="ghost" onClick={onSwitch} className="sm:col-span-2">Switch player</Button>
        </div>
      </div>
    </div>
  );
}
