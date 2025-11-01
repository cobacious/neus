import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClusterList from './components/ClusterList';
import ClusterDetailPage from './ClusterDetailPage';
import BetaBanner from './components/BetaBanner';
import Logo from './components/Logo';

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-3xl mx-auto">
        <header className="my-6">
          <a href="/">
            <Logo className="h-8 lg:h-12 w-auto mx-auto" />
          </a>
        </header>
        <BetaBanner />
        <Routes>
          <Route path="/" element={<ClusterList />} />
          <Route path="/clusters/:id" element={<ClusterDetailPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
