import { Link } from 'react-router-dom';
import GitHubIcon from './GitHubIcon';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-gray-200 bg-white py-10 px-4 text-sm text-gray-600">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link
              to="/"
              className="text-base font-semibold text-gray-900 hover:text-gray-700 transition-colors"
            >
              Neus
            </Link>
            <p className="text-xs text-gray-500 mt-0.5">
              Calm, multi-angle news aggregation for thoughtful consumption.
            </p>
          </div>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-gray-600"
          >
            <Link to="/" className="hover:text-gray-900 transition-colors">
              Stories
            </Link>
            <Link to="/about" className="hover:text-gray-900 transition-colors">
              About
            </Link>
            <a
              href="https://github.com/cobacious/neus"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 transition-colors inline-flex items-center gap-1.5"
            >
              <GitHubIcon className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://ko-fi.com/cobacious"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 transition-colors inline-flex items-center gap-1"
            >
              <span>Ko-fi</span>
            </a>
            <a
              href="https://github.com/cobacious/neus/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 transition-colors"
            >
              Feedback
            </a>
          </nav>
        </div>

        <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-400 gap-2">
          <p>© {currentYear} Neus. All rights reserved.</p>
          <p>Public repository for transparency. Not licensed for redistribution.</p>
        </div>
      </div>
    </footer>
  );
}
