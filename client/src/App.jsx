import { Navigate, Route, Routes } from 'react-router-dom';
import { PlayerProvider } from './player.jsx';
import Welcome from './pages/Welcome.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Mode from './pages/Mode.jsx';
import Game from './pages/Game.jsx';
import History from './pages/History.jsx';

export default function App() {
  return (
    <PlayerProvider>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/mode" element={<Mode />} />
        <Route path="/game/:id" element={<Game />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PlayerProvider>
  );
}
