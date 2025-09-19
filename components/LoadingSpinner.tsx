
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
        <div className="flex flex-col items-center justify-center space-y-4 p-8 w-full max-w-md">
            <div className="w-16 h-16 border-4 border-t-4 border-zinc-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-zinc-600 font-medium font-sans text-lg text-center">{message}</p>
            {progress && (
                <div className="w-full bg-zinc-200 rounded-full h-2.5">
                    <div
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progress.progress}%` }}
                    ></div>
                </div>
            )}
            <p className="text-sm text-zinc-500 text-center max-w-sm">{subMessage}</p>
        </div>
    );
};