import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);
export const usePlayer = () => useContext(Ctx);

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

/** The frontend only remembers WHICH player is selected - all stats and history live in MySQL. */
export function PlayerProvider({ children }) {
  const [current, setCurrent] = useState(() => read('mj.player', null)); // {playerId, username}
  const [known, setKnown] = useState(() => read('mj.known', []));
  const [profile, setProfile] = useState(null);

  const refresh = useCallback(async () => {
    if (!current) return setProfile(null);
    try { setProfile((await api.player(current.playerId)).player); } catch (e) { if (e.status === 404) logout(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  useEffect(() => { refresh(); }, [refresh]);

  const select = (p) => {
    const cur = { playerId: p.playerId, username: p.username };
    localStorage.setItem('mj.player', JSON.stringify(cur));
    const ids = [p.playerId, ...known.filter((i) => i !== p.playerId)];
    localStorage.setItem('mj.known', JSON.stringify(ids));
    setKnown(ids); setCurrent(cur); setProfile(p);
  };
  const logout = () => { localStorage.removeItem('mj.player'); setCurrent(null); setProfile(null); };

  return <Ctx.Provider value={{ current, profile, known, select, logout, refresh }}>{children}</Ctx.Provider>;
}
