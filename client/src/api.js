async function call(path, opts = {}) {
  const res = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) { const e = new Error(data?.error || 'Request failed'); e.status = res.status; e.code = data?.code; throw e; }
  return data;
}
const post = (p, body) => call(p, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  enter: (username) => post('/players', { username }),
  players: (ids) => call(`/players?ids=${ids.join(',')}`),
  player: (id) => call(`/players/${id}`),
  history: (id) => call(`/players/${id}/history`),
  activeGame: (id) => call(`/players/${id}/active-game`),
  rules: () => call('/rules'),
  startGame: (playerId, opts) => post('/games', { playerId, ...opts }),
  game: (id, playerId) => call(`/games/${id}?playerId=${playerId}`),
  details: (id, playerId) => call(`/games/${id}/details?playerId=${playerId}`),
  act: (id, playerId, action) => post(`/games/${id}/actions`, { playerId, action }),
};
