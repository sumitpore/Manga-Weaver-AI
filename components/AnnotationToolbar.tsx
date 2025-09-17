
import React from 'react';
import type { Tool } from '../types';

interface ToolIconProps {
    isActive: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title: string;
}

const ToolIcon: React.FC<ToolIconProps> = ({ isActive, onClick, children, title }) => (
    <button
        title={title}
        onClick={onClick}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
    >
        {children}
    </button>
);

const ActionIcon: React.FC<Omit<ToolIconProps, 'isActive'> & { disabled?: boolean }> = ({ onClick, children, title, disabled }) => (
     <button
        title={title}
        onClick={onClick}
        disabled={disabled}
        className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400 disabled:cursor-not-allowed"
    >
        {children}
    </button>
);

interface AnnotationToolbarProps {
    tool: Tool | null;
    setTool: (tool: Tool | null) => void;
    color: string;
    setColor: (color: string) => void;
    handleUndo: () => void;
    clearCanvas: () => void;
    historyLength: number;
    hasAnnotations: boolean;
    handleRegenerateClick: () => void;
    handleDownload: () => void;
}

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
    tool,
    setTool,
    color,
    setColor,
    handleUndo,
    clearCanvas,
    historyLength,
    hasAnnotations,
    handleRegenerateClick,
    handleDownload
}) => {
    return (
        <div className="w-full lg:w-auto flex-shrink-0">
            <div className="p-4 bg-white rounded-lg border border-zinc-200 shadow-sm flex flex-col gap-6">
                
                {/* Tools Section */}
                <div>
                    <p className="text-sm font-medium text-zinc-600 text-center mb-2">Tools</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        <ToolIcon title="Arrow" isActive={tool === 'arrow'} onClick={() => setTool(tool === 'arrow' ? null : 'arrow')}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" stroke-linecap="round" strokeLinejoin="round"><path d="M11 19H5V13"/><path d="M19 5L5 19"/></svg>
                        </ToolIcon>
                        <ToolIcon title="Text" isActive={tool === 'text'} onClick={() => setTool(tool === 'text' ? null : 'text')}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>
                        </ToolIcon>
                        <ToolIcon title="Rectangle" isActive={tool === 'rectangle'} onClick={() => setTool(tool === 'rectangle' ? null : 'rectangle')}>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
                        </ToolIcon>
                        <ToolIcon title="Circle" isActive={tool === 'circle'} onClick={() => setTool(tool === 'circle' ? null : 'circle')}>
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                        </ToolIcon>
                    </div>
                </div>
                
                <div className="h-px bg-zinc-200 my-0"></div>

                {/* Colors Section */}
                <div>
                    <p className="text-sm font-medium text-zinc-600 text-center mb-2">Color</p>
                    <div className="flex flex-wrap justify-center gap-2 max-w-[120px] mx-auto">
                       {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'].map(c => (
                            <button key={c} onClick={() => setColor(c)} aria-label={`Set color to ${c}`} style={{backgroundColor: c}} className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`} />
                        ))}
                    </div>
                </div>
                
                <div className="h-px bg-zinc-200 my-0"></div>

                {/* Actions Section */}
                <div>
                    <p className="text-sm font-medium text-zinc-600 text-center mb-2">Actions</p>
                    <div className="flex flex-wrap justify-center items-center gap-2">
                         <ActionIcon title="Undo" onClick={handleUndo} disabled={historyLength === 0}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
                         </ActionIcon>
                         <ActionIcon title="Clear" onClick={clearCanvas} disabled={!hasAnnotations}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                         </ActionIcon>
                         <ActionIcon title="Regenerate Image" onClick={handleRegenerateClick} disabled={!hasAnnotations}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 18h-4"/><path d="M11 3H9"/></svg>
                         </ActionIcon>
                         <ActionIcon title="Download PDF" onClick={handleDownload}>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                         </ActionIcon>
                    </div>
                </div>
            </div>
        </div>
    );
};