import React from 'react';
import type { ProgressUpdate } from '../types';

interface LoadingSpinnerProps {
    progress?: ProgressUpdate | null;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ progress }) => {
    const message = progress?.message || 'The AI is weaving your story...';
    const subMessage = progress
        ? 'This can take a few minutes. Please be patient!'
        : 'This can take some time, especially for multi-page comics. Please be patient while the magic happens!';

    return (
        <div className="flex flex-col items-center justify-center space-y-4 p-8 w-full max-w-lg">
            <div className="w-16 h-16 border-4 border-t-4 border-zinc-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-zinc-600 font-medium font-sans text-lg text-center">{message}</p>
            
            {progress && (
                 <div className="w-full">
                    {/* Main progress bar container */}
                    <div className="w-full bg-zinc-200 rounded-full h-2.5 relative">
                        <div
                            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${progress.progress}%` }}
                        ></div>
                    </div>

                    {/* Branching UI for page generation stage */}
                    {progress.stage === 'pages' && progress.pageDetails && progress.pageDetails.length > 0 && (
                        <div className="mt-6 relative">
                            {/* Connector line from main bar to the branch box */}
                            <div className="absolute -top-6 left-[10%] h-6 w-[80%]">
                                <div className="h-full w-px bg-zinc-300 mx-auto"></div>
                            </div>
                            
                            {/* Box containing individual page progress bars */}
                            <div className="border border-zinc-200 bg-white/50 rounded-lg p-3 space-y-3 shadow-sm">
                                {progress.pageDetails.map(page => (
                                    <div key={page.pageNum} className="transition-opacity duration-300">
                                        <div className="flex justify-between items-center text-xs mb-1 text-zinc-500 font-medium">
                                            <span>Page {page.pageNum}</span>
                                            <span className="truncate max-w-[100px]">{page.message}</span>
                                        </div>
                                        <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-sky-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                                                style={{ width: `${page.progress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            <p className="text-sm text-zinc-500 text-center max-w-sm">{subMessage}</p>
        </div>
    );
};
