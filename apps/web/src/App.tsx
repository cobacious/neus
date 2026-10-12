import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClusterList from './components/ClusterList';
import ClusterDetailPage from './ClusterDetailPage';
import ClusterRedirect from './ClusterRedirect';
import AboutPage from './AboutPage';
import Header from './components/Header';
import Footer from './components/Footer';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-gray-100">
        <Header />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 pb-12">
          <Routes>
            <Route path="/" element={<ClusterList />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/clusters/:id" element={<ClusterRedirect />} />
            <Route path="/:slug" element={<ClusterDetailPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
