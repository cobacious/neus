import { useState, useEffect } from 'react';
import Logo from './Logo';
import GitHubIcon from './GitHubIcon';

const SCROLL_THRESHOLD = 50;

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Spacer to prevent content jump when header becomes fixed */}
      <div
        className={`transition-all duration-300 ${
          isScrolled ? 'h-16' : 'h-0'
        }`}
      />
      <header
        className={`
          px-4 border-b border-gray-200 bg-white transition-all duration-300 ease-in-out
          ${isScrolled
            ? 'fixed top-0 left-0 right-0 py-3 shadow-sm z-50'
            : 'relative my-6 py-4 pb-6'
          }
        `}
      >
        <div
          className={`
            max-w-3xl mx-auto flex items-center transition-all duration-300
            ${isScrolled ? 'justify-start' : 'justify-center'}
          `}
        >
          <h1 className="flex">
            <a href="/" className="block">
              <Logo
                className={`w-auto transition-all duration-300 ${
                  isScrolled ? 'h-8' : 'h-10 lg:h-14'
                }`}
              />
              <span className="sr-only">Neus</span>
            </a>
          </h1>
          <a
            href="https://github.com/cobacious/neus"
            target="_blank"
            rel="noopener noreferrer"
            className={`
              text-gray-500 hover:text-gray-900 transition-all duration-300
              p-2 rounded-lg hover:bg-gray-100
              ${isScrolled
                ? 'ml-auto'
                : 'absolute right-4 top-1/2 -translate-y-1/2'
              }
            `}
            aria-label="View source on GitHub"
          >
            <GitHubIcon
              className={`transition-all duration-300 ${
                isScrolled ? 'h-5 w-5' : 'h-6 w-6'
              }`}
            />
          </a>
        </div>
      </header>
    </>
  );
}
