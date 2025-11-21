import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClusterList from './components/ClusterList';
import ClusterDetailPage from './ClusterDetailPage';
import ClusterRedirect from './ClusterRedirect';
import BetaBanner from './components/BetaBanner';
import Header from './components/Header';

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <div className="max-w-3xl mx-auto">
        <BetaBanner />
        <Routes>
          <Route path="/" element={<ClusterList />} />
          <Route path="/clusters/:id" element={<ClusterRedirect />} />
          <Route path="/:slug" element={<ClusterDetailPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
