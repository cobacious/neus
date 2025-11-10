import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClusterList from './components/ClusterList';
import ClusterDetailPage from './ClusterDetailPage';
import ClusterRedirect from './ClusterRedirect';
import BetaBanner from './components/BetaBanner';
import Logo from './components/Logo';
import GitHubIcon from './components/GitHubIcon';

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-3xl mx-auto">
        <header className="my-6 flex items-center justify-between">
          <h1 className="flex-1 flex justify-center">
            <a href="/" className="block">
              <Logo className="h-8 lg:h-12 w-auto" />
              <span className="sr-only">Neus</span>
            </a>
          </h1>
          <a
            href="https://github.com/cobacious/neus"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="View source on GitHub"
          >
            <GitHubIcon className="h-6 w-6" />
          </a>
        </header>
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
