import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo';
import GitHubIcon from './GitHubIcon';

const BRAND_COLORS = [
  '#4F6D7A', // Blue Slate
  '#DD6E42', // Burnt Peach
  '#B8C7B7', // Ash Grey
  '#D2BFDE', // Thistle
  '#805448', // Clay Soil
  '#575353', // Charcoal
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  // Randomize segment weights on initial page load
  const [paletteSegments] = useState(() => {
    return BRAND_COLORS.map((color) => ({
      color,
      weight: Math.floor(Math.random() * 40 + 10) / 10, // 1.0 to 5.0
    }));
  });

  // Close drawer on route navigation
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Handle subtle elevation shadow on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle Escape key and scroll locking without layout shift
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      // If the scrollbar gutter collapsed, compensate with paddingRight on body
      const remainingGutter = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0 && remainingGutter === 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      {/* Modern Left-Aligned Sticky Navbar */}
      <header
        className={`sticky top-0 z-40 bg-white border-b border-gray-200 transition-shadow duration-200 ${
          isScrolled ? 'shadow-sm' : ''
        }`}
      >
        {/* Subtle Brand Editorial Stripe (Randomized segment widths on load) */}
        <div className="flex h-1 w-full overflow-hidden" aria-hidden="true">
          {paletteSegments.map((seg, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: seg.color,
                flexGrow: seg.weight,
                flexBasis: 0,
              }}
            />
          ))}
        </div>

        <div className="max-w-3xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between">
          <h1 className="flex items-center">
            <Link to="/" className="inline-flex items-center gap-2.5 sm:gap-3 group">
              <Logo className="text-3xl sm:text-4xl" />
              <span
                className="text-gray-300 font-light text-xl leading-none select-none -translate-y-px"
                aria-hidden="true"
              >
                |
              </span>
              <span className="text-xs sm:text-sm font-medium text-gray-500 tracking-tight leading-none group-hover:text-gray-800 transition-colors">
                Neutral news
              </span>
              <span className="sr-only">Neus - Neutral news</span>
            </Link>
          </h1>
          <button
            type="button"
            onClick={toggleMenu}
            className="text-gray-600 hover:text-gray-900 transition-colors p-1.5 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
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
            {/* Drawer Header - Clean close action aligned with navbar burger position */}
            <div className="px-4 py-3 sm:py-3.5 flex items-center justify-end">
              <button
                type="button"
                onClick={closeMenu}
                className="text-gray-600 hover:text-gray-900 p-1.5 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                aria-label="Close menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto px-4 pt-2 pb-6 space-y-6">
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
                  <span>Neus Feed</span>
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
                <Link
                  to="/about#feedback"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <span>Contact & Feedback</span>
                </Link>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
              <Logo className="text-xl" />
              <p className="mt-1">© {new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
