import { useState, useEffect, useRef } from 'react';
import Logo from './Logo';
import GitHubIcon from './GitHubIcon';

export default function Header() {
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

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

  return (
    <>
      {/* Original header - scrolls away naturally */}
      <header
        ref={headerRef}
        className="my-6 px-4 py-4 border-b border-gray-200 pb-6 relative"
      >
        <div className="max-w-3xl mx-auto">
          <h1 className="flex justify-center">
            <a href="/" className="block">
              <Logo className="h-10 lg:h-14 w-auto" />
              <span className="sr-only">Neus</span>
            </a>
          </h1>
          <a
            href="https://github.com/cobacious/neus"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
            aria-label="View source on GitHub"
          >
            <GitHubIcon className="h-6 w-6" />
          </a>
        </div>
      </header>

      {/* Sticky header - slides in from top after original is off screen */}
      <header
        className={`
          fixed top-0 left-0 right-0 px-4 py-3 bg-white border-b border-gray-200 shadow-sm z-50
          transition-transform duration-300 ease-out
          ${showStickyHeader ? 'translate-y-0' : '-translate-y-full'}
        `}
        aria-hidden={!showStickyHeader}
      >
        <div className="max-w-3xl mx-auto flex items-center">
          <h1 className="flex">
            <a href="/" className="block">
              <Logo className="h-8 w-auto" />
              <span className="sr-only">Neus</span>
            </a>
          </h1>
          <a
            href="https://github.com/cobacious/neus"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-gray-500 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
            aria-label="View source on GitHub"
            tabIndex={showStickyHeader ? 0 : -1}
          >
            <GitHubIcon className="h-5 w-5" />
          </a>
        </div>
      </header>
    </>
  );
}
