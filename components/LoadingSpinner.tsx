
import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <div className="w-16 h-16 border-4 border-t-4 border-zinc-200 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="text-zinc-600 font-medium font-sans text-lg">The AI is weaving your manga...</p>
      <p className="text-sm text-zinc-500 text-center max-w-sm">This can take a moment, especially for complex scenes. Please be patient while the magic happens!</p>
    </div>
  );
};
