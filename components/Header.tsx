
import React from 'react';

interface HeaderProps {
    onStartOver: () => void;
    showStartOver: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onStartOver, showStartOver }) => {
  return (
    <header className="w-full p-4 flex justify-center sticky top-0 z-50">
      <nav className="w-full max-w-7xl mx-auto bg-white/70 border border-zinc-200 rounded-full py-3 px-6 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 2 7 5-7 5-7-5 7-5Z"/>
                <path d="m2 17 7 5 7-5"/>
                <path d="m2 12 7 5 7-5"/>
            </svg>
            <span className="ml-2 text-lg font-bold font-sans text-zinc-800">Manga Weaver AI</span>
          </div>
          {showStartOver && (
            <button
              onClick={onStartOver}
              className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-full hover:bg-indigo-700 transition-all duration-300 shadow-sm hover:shadow-md text-sm text-center"
            >
              Start Over
            </button>
          )}
        </div>
      </nav>
    </header>
  );
};
