import { useEffect, useState } from 'react';
import Tile from '../components/Tile.jsx';

const WIND_CH = { east: '東', south: '南', west: '西', north: '北' };
const EMO = (n) => `/assets/emotions/panda_${n}.png`;

export function useMedia(q) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => { const mq = matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [q]);
  return m;
}

export function positions(view) {
  const n = view.config.numPlayers, you = view.you.seat;
  const POS = n === 2 ? ['bottom', 'top'] : n === 3 ? ['bottom', 'right', 'left'] : ['bottom', 'right', 'top', 'left'];
  const byPos = {};
  POS.forEach((p, k) => { byPos[p] = view.seats[(you + k) % n]; });
  return byPos;
}

export function Badges({ seat }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span title={`Seat wind: ${seat.wind}`} className="grid h-6 w-6 place-items-center rounded bg-ivory font-display text-base leading-none text-ink">{WIND_CH[seat.wind]}</span>
      {seat.isDealer && <span title="Dealer" className="grid h-6 w-6 place-items-center rounded bg-vermilion font-display text-base leading-none text-ivory">莊</span>}
    </span>
  );
}

export function Melds({ seat, size = 'xs' }) {
  if (!seat.melds.length && !seat.flowers.length) return null;
  return (
    <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
      {seat.melds.map((m, i) => (
        <div key={i} className="flex gap-px rounded bg-black/20 p-0.5">{m.tiles.map((t) => <Tile key={t.id} tile={t} size={size} faceDown={!t.key} />)}</div>
      ))}
      {seat.flowers.length > 0 && <div className="flex gap-px opacity-90" title="Bonus tiles">{seat.flowers.map((t) => <Tile key={t.id} tile={t} size={size} />)}</div>}
    </div>
  );
}

/** Opponent avatar: Lucky Panda reacts with the expression pack; others use their portraits. */
export function Avatar({ seat, mood, size = 'h-14 w-14', active }) {
  const p = seat.persona;
  const src = p.id === 'panda' && mood ? EMO(mood) : p.avatar;
  return <img src={src} alt={p.name} className={`${size} rounded-full bg-ivory/90 object-cover object-top ring-2 transition ${active ? 'ring-gold-soft turn-glow' : 'ring-gold/40'}`} />;
}

export function Opponent({ seat, pos, active, thinking, mood, bubble }) {
  const vertical = pos === 'left' || pos === 'right';
  const hand = Array.from({ length: seat.handCount }, (_, i) => i);
  return (
    <div className={`flex ${vertical ? 'flex-col items-center gap-2' : 'items-center justify-center gap-4'}`}>
      <div className="flex shrink-0 items-center gap-2.5">
        <Avatar seat={seat} mood={mood} active={active} />
        <div className={vertical ? 'hidden' : ''}>
          <div className="font-bold leading-tight">{seat.persona.emoji} {seat.persona.name}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-ivory/70"><Badges seat={seat} /> {seat.persona.style}</div>
        </div>
      </div>
      {vertical && <div className="text-center text-sm font-bold leading-tight">{seat.persona.name}<div className="mt-1 flex justify-center"><Badges seat={seat} /></div></div>}
      <div className={`flex ${vertical ? 'flex-col -space-y-9' : '-space-x-3'}`} aria-label={`${seat.handCount} hidden tiles`}>
        {hand.map((i) => <div key={i} className={vertical ? 'rotate-90 w-5' : ''}><Tile tile={{ key: null }} faceDown size={vertical ? 'xs' : 'sm'} /></div>)}
      </div>
      <Melds seat={seat} />
      {(bubble || thinking) && <div className="max-w-40 rounded-xl bg-ivory px-3 py-1.5 text-xs font-semibold text-ink shadow-lg">{thinking ? 'Thinking…' : bubble}</div>}
    </div>
  );
}

export function Pool({ seat, lastId, name, className = '' }) {
  return (
    <div className={`flex flex-wrap content-start gap-[2px] ${className}`} aria-label={`${name} discards`}>
      {seat.discards.map((t) => <Tile key={t.id} tile={t} size="xs" glow={t.id === lastId} animate={t.id === lastId ? 'anim-discard' : ''} />)}
    </div>
  );
}
