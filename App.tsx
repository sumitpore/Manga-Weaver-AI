
import React, { useState, useCallback, useEffect } from 'react';
import { HomePage } from './components/HomePage';
import { ComicDisplay } from './components/ComicDisplay';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LoadingSpinner } from './components/LoadingSpinner';
import { generateComicStory, regeneratePage } from './services/geminiService';
import type { ComicPage, AppStatus, TextElement, ProgressUpdate } from './types';

const App: React.FC = () => {
  const [comicPages, setComicPages] = useState<ComicPage[]>([]);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);

  const handleGeneration = useCallback(async (prompt: string, files: File[], numPages: number) => {
    setStatus('loading');
    setError(null);
    // FIX: The ProgressUpdate type requires a 'stage' property. Set to 'outline' for initial state.
    setProgress({ message: 'Warming up the AI...', progress: 0, stage: 'outline' });

    const onProgressCallback = (update: ProgressUpdate) => {
        setProgress(update);
    };

    try {
      const newPages = await generateComicStory(prompt, files, numPages, onProgressCallback);
      setComicPages(newPages);
      setStatus('editing');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setStatus('idle');
    } finally {
        setProgress(null);
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
        prevPages.map(p => (p.id === pageId ? { ...p, imageUrl: updatedPage.imageUrl } : p))
      );
      setStatus('editing');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during regeneration.');
      setStatus('editing'); // Return to editing even if there's an error
    }
  }, [comicPages]);

  const handleUpdateTextElements = useCallback((pageId: string, updatedTextElements: TextElement[]) => {
      setComicPages(prevPages =>
          prevPages.map(p => (p.id === pageId ? { ...p, textElements: updatedTextElements } : p))
      );
  }, []);

  const handleStartOver = () => {
    setComicPages([]);
    setStatus('idle');
    setError(null);
  };


  return (
    <div className="bg-white text-zinc-900 font-sans min-h-screen flex flex-col relative">
      {isDownloadingPdf && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="w-16 h-16 border-4 border-t-4 border-zinc-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-white font-medium font-sans text-lg mt-4">Generating PDF...</p>
            <p className="text-sm text-zinc-300 text-center max-w-sm">Capturing each page, please wait a moment.</p>
        </div>
      )}
      <Header onStartOver={handleStartOver} showStartOver={status !== 'idle'}/>
      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        {status === 'loading' && <LoadingSpinner progress={progress} />}
        {status === 'idle' && <HomePage onGenerate={handleGeneration} />}
        {status === 'editing' && comicPages.length > 0 && (
          <ComicDisplay 
            pages={comicPages} 
            onRegeneratePage={handleRegeneration}
            onUpdateTextElements={handleUpdateTextElements}
            setIsDownloadingPdf={setIsDownloadingPdf}
          />
        )}
        {error && <div className="mt-4 text-red-600 bg-red-100 p-3 rounded-lg">{error}</div>}
      </main>
      <Footer />
    </div>
  );
};

export default App;