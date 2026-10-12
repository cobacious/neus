import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo';
import GitHubIcon from './GitHubIcon';

export default function Header() {
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const location = useLocation();

  // Close drawer on route navigation
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Handle sticky header scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (headerRef.current) {
        const headerBottom = headerRef.current.getBoundingClientRect().bottom;
        setShowStickyHeader(headerBottom < 0);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle Escape key to close menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      {/* Original header - scrolls away naturally */}
      <header
        ref={headerRef}
        className="my-6 px-4 py-4 border-b border-gray-200 pb-6 relative"
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="w-10"></div> {/* Spacer to center the logo */}
          <h1 className="flex justify-center flex-1">
            <Link to="/" className="block">
              <Logo className="h-10 lg:h-14 w-auto" />
              <span className="sr-only">Neus</span>
            </Link>
          </h1>
          <button
            type="button"
            onClick={toggleMenu}
            className="text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Sticky header - slides in from top after original is off screen */}
      <header
        className={`
          fixed top-0 left-0 right-0 px-4 py-2 bg-white border-b border-gray-200 shadow-sm z-40
          transition-transform duration-300 ease-out
          ${showStickyHeader ? 'translate-y-0' : '-translate-y-full'}
        `}
        aria-hidden={!showStickyHeader}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="flex">
            <Link to="/" tabIndex={showStickyHeader ? 0 : -1} className="block">
              <Logo className="h-6 w-auto" />
              <span className="sr-only">Neus</span>
            </Link>
          </h1>
          <button
            type="button"
            onClick={toggleMenu}
            className="text-gray-600 hover:text-gray-900 transition-colors p-1.5 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
            tabIndex={showStickyHeader ? 0 : -1}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile / Desktop Slide-over Drawer Backdrop & Panel */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={closeMenu}
            aria-hidden="true"
          />

          {/* Drawer container */}
          <div className="fixed inset-y-0 right-0 max-w-xs w-full bg-white shadow-2xl flex flex-col z-50">
            {/* Drawer Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <Link to="/" onClick={closeMenu} className="block">
                <Logo className="h-6 w-auto" />
                <span className="sr-only">Neus</span>
              </Link>
              <button
                type="button"
                onClick={closeMenu}
                className="text-gray-500 hover:text-gray-900 p-1.5 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
              <div className="space-y-1">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Navigation
                </p>
                <Link
                  to="/"
                  onClick={closeMenu}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${location.pathname === '/' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  <span>Stories Feed</span>
                </Link>
                <Link
                  to="/about"
                  onClick={closeMenu}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${location.pathname === '/about' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>About Neus</span>
                </Link>
              </div>

              <div className="border-t border-gray-100 pt-5 space-y-1">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Community & Code
                </p>
                <a
                  href="https://github.com/cobacious/neus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <GitHubIcon className="h-4 w-4 text-gray-500" />
                  <span>GitHub Repository</span>
                </a>
                <a
                  href="https://ko-fi.com/cobacious"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <svg className="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-.781-1.638-.394-.475-.898-.847-1.465-1.082C17.27 2.793 16.643 2.667 16 2.667H4c-.796 0-1.559.316-2.121.879C1.316 4.108 1 4.871 1 5.667v10.666c0 .796.316 1.559.879 2.122.562.562 1.325.878 2.121.878h10c.796 0 1.559-.316 2.121-.878.563-.563.879-1.326.879-2.122v-1.334h3.2c.742 0 1.454-.295 1.979-.82.525-.526.82-1.237.82-1.979V8.415a4.01 4.01 0 00-.783-2zm-3.216 6.252v-6.66h1c.477 0 .935.19 1.273.527.337.338.527.796.527 1.273v2.86c0 .478-.19.936-.527 1.273a1.799 1.799 0 01-1.273.527h-1z" />
                  </svg>
                  <span>Support on Ko-fi</span>
                </a>
                <a
                  href="https://github.com/cobacious/neus/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <span>Feedback & Issues</span>
                </a>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
              <p className="font-medium text-gray-600">Neus</p>
              <p className="mt-0.5">© {new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
