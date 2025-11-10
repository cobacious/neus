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
        <header className="my-6 px-4 py-4 flex items-center justify-between border-b border-gray-200 pb-6">
          <h1 className="flex-1 flex justify-center">
            <a href="/" className="block">
              <Logo className="h-10 lg:h-14 w-auto" />
              <span className="sr-only">Neus</span>
            </a>
          </h1>
          <a
            href="https://github.com/cobacious/neus"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
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
