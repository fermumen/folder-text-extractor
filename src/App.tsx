import React, { useState, useCallback } from 'react';
import { FolderTree, FileText } from 'lucide-react';

interface FileEntry {
  name: string;
  path: string;
  content?: string;
  size?: number;
  isDirectory: boolean;
  children?: FileEntry[];
}

function App() {
  const [folderStructure, setFolderStructure] = useState<FileEntry | null>(null);
  const [combinedText, setCombinedText] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [maxFileSize, setMaxFileSize] = useState<number>(1); // Size in MB
  const [showSizeWarning, setShowSizeWarning] = useState(false);

  const processFileEntry = async (entry: FileSystemEntry, path: string = ''): Promise<FileEntry> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      return new Promise((resolve) => {
        fileEntry.file(async (file) => {
          let content = '';
          const isTextFile = file.type.startsWith('text/') || file.name.match(/\.(txt|md|js|jsx|ts|tsx|css|html|json|yaml|yml|xml|csv)$/i);
          
          if (isTextFile && file.size < maxFileSize * 1024 * 1024) {
            content = await file.text();
          } else if (isTextFile) {
            setShowSizeWarning(true);
          }
          
          resolve({
            name: entry.name,
            path: `${path}/${entry.name}`,
            content,
            size: file.size,
            isDirectory: false
          });
        });
      });
    } else {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const dirReader = dirEntry.createReader();
      
      const entries: FileSystemEntry[] = await new Promise((resolve) => {
        const results: FileSystemEntry[] = [];
        function readEntries() {
          dirReader.readEntries((entries) => {
            if (entries.length === 0) {
              resolve(results);
            } else {
              results.push(...entries);
              readEntries();
            }
          });
        }
        readEntries();
      });

      const children = await Promise.all(
        entries.map(entry => processFileEntry(entry, `${path}/${dirEntry.name}`))
      );

      return {
        name: entry.name,
        path: `${path}/${entry.name}`,
        isDirectory: true,
        children
      };
    }
  };

  const generateTreeText = (entry: FileEntry, level: number = 0, isLast: boolean = true): string => {
    const indent = level === 0 ? '' : '  '.repeat(level - 1) + (isLast ? '└─ ' : '├─ ');
    let sizeInfo = entry.size ? ` (${(entry.size / 1024).toFixed(1)} KB)` : '';
    let result = `${indent}${entry.name}${sizeInfo}\n`;
    
    if (entry.children) {
      entry.children.forEach((child, index) => {
        result += generateTreeText(child, level + 1, index === entry.children!.length - 1);
      });
    }
    return result;
  };

  const generateCombinedText = (entry: FileEntry): string => {
    let result = '';
    
    if (entry.isDirectory && entry.children) {
      for (const child of entry.children) {
        result += generateCombinedText(child);
      }
    } else if (!entry.isDirectory && entry.content) {
      result += `\n${'='.repeat(80)}\n`;
      result += `File: ${entry.path}\n`;
      result += `${'='.repeat(80)}\n\n`;
      result += `${entry.content}\n`;
    }
    
    return result;
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setShowSizeWarning(false);

    const items = Array.from(e.dataTransfer.items);
    if (items.length === 0) return;

    const entry = items[0].webkitGetAsEntry();
    if (!entry) return;

    const structure = await processFileEntry(entry);
    setFolderStructure(structure);

    const treeText = `Folder Structure:\n${generateTreeText(structure)}`;
    const filesText = generateCombinedText(structure);
    setCombinedText(`${treeText}\n${filesText}`);
  }, [maxFileSize]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const downloadText = useCallback(() => {
    if (!combinedText) return;
    
    const blob = new Blob([combinedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'combined-files.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [combinedText]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            <FileText className="inline-block mr-2 mb-1" />
            Folder Text Processor
          </h1>
          <p className="text-gray-600">
            Drag and drop a folder to combine all text files into one document
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              Max file size:
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={maxFileSize}
              onChange={(e) => setMaxFileSize(Number(e.target.value))}
              className="w-48"
            />
            <span className="text-sm text-gray-600">{maxFileSize} MB</span>
          </div>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-12 mb-8 text-center transition-colors
            ${isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <FolderTree className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-600">
            {isDragging 
              ? 'Drop your folder here' 
              : 'Drag and drop a folder here'}
          </p>
        </div>

        {showSizeWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">
              Some text files were skipped because they exceed the maximum file size of {maxFileSize} MB.
              Adjust the slider above to include larger files.
            </p>
          </div>
        )}

        {folderStructure && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Combined Text Output
              </h2>
              <button
                onClick={downloadText}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Download
              </button>
            </div>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap">
              {combinedText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;