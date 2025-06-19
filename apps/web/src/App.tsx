import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClusterList from './components/ClusterList';
import ClusterDetailPage from './ClusterDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Neus Clusters</h1>
        <Routes>
          <Route path="/" element={<ClusterList />} />
          <Route path="/clusters/:id" element={<ClusterDetailPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
