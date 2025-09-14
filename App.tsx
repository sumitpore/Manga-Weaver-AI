
import React, { useState, useCallback } from 'react';
import { HomePage } from './components/HomePage';
import { ComicDisplay } from './components/ComicDisplay';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LoadingSpinner } from './components/LoadingSpinner';
import { generateComicStory, regeneratePage } from './services/geminiService';
import type { ComicPage, AppStatus } from './types';

const App: React.FC = () => {
  const [comicPages, setComicPages] = useState<ComicPage[]>([]);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleGeneration = useCallback(async (prompt: string, files: File[], numPages: number) => {
    setStatus('loading');
    setError(null);
    try {
      const pages = await generateComicStory(prompt, files, numPages);
      setComicPages(pages);
      setStatus('editing');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setStatus('idle');
    }
  }, []);

  const handleRegeneration = useCallback(async (pageId: string, annotatedImageB64: string, annotationText: string) => {
    const pageToUpdate = comicPages.find(p => p.id === pageId);
    if (!pageToUpdate) return;

    setStatus('loading');
    setError(null);
    try {
      const updatedPage = await regeneratePage(annotatedImageB64, annotationText);
      setComicPages(prevPages => 
        prevPages.map(p => (p.id === pageId ? { ...updatedPage, id: pageId } : p))
      );
      setStatus('editing');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during regeneration.');
      setStatus('editing'); // Return to editing even if there's an error
    }
  }, [comicPages]);

  const handleStartOver = () => {
    setComicPages([]);
    setStatus('idle');
    setError(null);
  };


  return (
    <div className="bg-white text-zinc-900 font-sans min-h-screen flex flex-col">
      <Header onStartOver={handleStartOver} showStartOver={status !== 'idle'}/>
      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        {status === 'loading' && <LoadingSpinner />}
        {status === 'idle' && <HomePage onGenerate={handleGeneration} />}
        {status === 'editing' && comicPages.length > 0 && (
          <ComicDisplay 
            pages={comicPages} 
            onRegeneratePage={handleRegeneration} 
          />
        )}
        {error && <div className="mt-4 text-red-600 bg-red-100 p-3 rounded-lg">{error}</div>}
      </main>
      <Footer />
    </div>
  );
};

export default App;