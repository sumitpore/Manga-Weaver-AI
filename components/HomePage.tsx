
import React, { useState, useRef, DragEvent } from 'react';

interface HomePageProps {
  onGenerate: (prompt: string, files: File[]) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onGenerate }) => {
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(e.target.value);
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'; // Reset height
          const scrollHeight = textareaRef.current.scrollHeight;
          textareaRef.current.style.height = `${scrollHeight}px`;
      }
  };

  const handleFiles = (selectedFiles: FileList | null) => {
    if (selectedFiles) {
      const newFiles = Array.from(selectedFiles).filter(file => file.type.startsWith('image/'));
      setFiles(prevFiles => [...prevFiles, ...newFiles]);

      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prevPreviews => [...prevPreviews, ...newPreviews]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    if(event.target) event.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    const updatedFiles = [...files];
    const updatedPreviews = [...previews];

    updatedFiles.splice(index, 1);
    const removedPreview = updatedPreviews.splice(index, 1);

    setFiles(updatedFiles);
    setPreviews(updatedPreviews);
    URL.revokeObjectURL(removedPreview[0]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFiles(event.dataTransfer.files);
    }
  };
  
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };
  
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt, files);
    }
  };
  
  React.useEffect(() => {
    return () => {
      previews.forEach(preview => URL.revokeObjectURL(preview));
    };
  }, [previews]);

  return (
    <div className="w-full max-w-3xl text-center flex flex-col items-center px-4">
        <h1 className="text-5xl md:text-6xl font-heading font-bold tracking-tight mt-6 text-zinc-900">
            Manga Weaver AI
        </h1>
        <p className="text-lg md:text-xl text-zinc-600 max-w-3xl mt-4 leading-relaxed">
            Bring your story to life. Describe your comic, add characters, and let AI do the rest.
        </p>

        <form onSubmit={handleSubmit} className="w-full mt-12 flex flex-col items-center">
            <div 
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`relative w-full bg-white border border-zinc-200 rounded-3xl shadow-lg transition-all duration-300 ${isDragging ? 'border-indigo-400 ring-4 ring-indigo-500/20' : 'hover:shadow-xl focus-within:ring-4 focus-within:ring-indigo-500/20 focus-within:border-indigo-400'}`}
            >
                <div className="p-4 sm:p-6 flex flex-col">
                    <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={handlePromptChange}
                        placeholder="A shy wizard's cat accidentally casts a spell that brings all the garden gnomes to life..."
                        className="w-full bg-transparent focus:outline-none text-lg sm:text-xl text-zinc-800 placeholder:text-zinc-400 max-h-64"
                        rows={2}
                    />
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-200">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                                aria-label="Add character reference images"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M8 12h8"/>
                                    <path d="M12 8v8"/>
                                </svg>
                                <span className="hidden sm:inline">Add Characters</span>
                            </button>
                            <input id="file-upload" name="file-upload" type="file" className="hidden" ref={fileInputRef} multiple accept="image/*" onChange={handleFileChange} />
                        </div>
                        <button
                            type="submit"
                            disabled={!prompt.trim()}
                            className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                            aria-label="Generate Comic"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 6L12 2l4 4"/>
                                <path d="M12 2v20"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {previews.length > 0 && (
                <div className="mt-8 w-full">
                    <p className="text-sm font-medium text-zinc-600 mb-3 text-left">Character References:</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                        {previews.map((src, index) => (
                            <div key={index} className="relative group aspect-square">
                                <img src={src} alt={`Preview ${index}`} className="w-full h-full object-cover rounded-lg border border-zinc-200" />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveFile(index)}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-zinc-800 text-white rounded-full flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                    aria-label="Remove image"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </form>
    </div>
  );
};
