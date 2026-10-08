import { Link } from 'react-router-dom';
import { usePlayer } from '../player.jsx';

export function Button({ children, variant = 'gold', className = '', ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold tracking-wide transition active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none';
  const v = {
    gold: 'bg-gradient-to-b from-gold-soft to-gold text-ink shadow-[0_4px_0_#a9822f,0_10px_24px_rgba(0,0,0,.35)] hover:brightness-105',
    red: 'bg-gradient-to-b from-[#e0473f] to-vermilion text-ivory shadow-[0_4px_0_#7d1a16,0_10px_24px_rgba(0,0,0,.35)] hover:brightness-110',
    ghost: 'border border-gold/40 text-gold-soft hover:bg-gold/10',
  }[variant];
  return <button className={`${base} ${v} ${className}`} {...rest}>{children}</button>;
}

export function Stat({ icon, label, value, sub, accent }) {
  return (
    <div className={`rounded-2xl border border-gold/25 bg-jade-900/70 px-4 py-4 backdrop-blur ${accent ? 'ring-1 ring-gold/40' : ''}`}>
      <div className="text-sm text-gold-soft/80">{icon} {label}</div>
      <div className="mt-1 font-display text-4xl leading-none text-ivory tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-ivory/60">{sub}</div>}
    </div>
  );
}

export function Header({ back }) {
  const { current } = usePlayer();
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
      <Link to={current ? '/dashboard' : '/'} className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-ivory text-vermilion shadow-[0_3px_0_#b09a62] font-display text-2xl leading-none">中</span>
        <span className="font-display text-2xl text-gold-soft">One Shot Mahjong</span>
      </Link>
      <div className="flex items-center gap-3 text-sm">
        {back}
        {current && <Link to="/" onClick={() => {}} className="rounded-full border border-gold/30 px-3 py-1.5 text-gold-soft hover:bg-gold/10">👤 {current.username}</Link>}
      </div>
    </header>
  );
}

export function Page({ children, back, wide }) {
  return (
    <div className="flex min-h-full flex-col pb-[env(safe-area-inset-bottom)]">
      <Header back={back} />
      <main className={`mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-5xl'} flex-1 px-4 pb-10 pt-4`}>{children}</main>
    </div>
  );
}
