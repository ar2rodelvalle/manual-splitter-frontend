'use client';

import { useState, useRef, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const STORAGE_KEY_SECTIONS = 'manual-splitter-sections';
const STORAGE_KEY_TEXT = 'manual-splitter-text';

interface UploadResponse {
  filename: string;
  lines: string[];
}

interface SectionMarker {
  start: number;
  end: number | null;
  tokenCount: number;
  title?: string;
  shouldSummarize: boolean;
}

interface TokenResponse {
  token_count: number;
  start_line: number;
  end_line: number;
}

const DEFAULT_MAX_TOKENS = 3000;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadedText, setUploadedText] = useState<UploadResponse | null>(null);
  const [currentSection, setCurrentSection] = useState<SectionMarker | null>(null);
  const [sections, setSections] = useState<SectionMarker[]>([]);
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [maxTokens, setMaxTokens] = useState<number>(DEFAULT_MAX_TOKENS);
  const [markingStatus, setMarkingStatus] = useState<string>('Click a line to start marking a section');
  const [useTitleBookmark, setUseTitleBookmark] = useState(true);
  const [manualTitle, setManualTitle] = useState<string>('');
  const savedSectionsRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const [jumpToRow, setJumpToRow] = useState<string>('');
  const [shouldSummarize, setShouldSummarize] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [midpoint, setMidpoint] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [replaceCount, setReplaceCount] = useState<number | null>(null);

  useEffect(() => {
    // Load saved sections and text from localStorage
    const savedSections = localStorage.getItem(STORAGE_KEY_SECTIONS);
    const savedText = localStorage.getItem(STORAGE_KEY_TEXT);
    
    if (savedSections) {
      setSections(JSON.parse(savedSections));
    }
    
    if (savedText) {
      setUploadedText(JSON.parse(savedText));
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFile(file);
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setUploadedText(data);
      localStorage.setItem(STORAGE_KEY_TEXT, JSON.stringify(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLineClick = async (lineNumber: number) => {
    if (!uploadedText) return;

    if (!currentSection) {
      // Starting a new section
      setCurrentSection({
        start: lineNumber,
        end: null,
        tokenCount: 0,
        shouldSummarize
      });
      setMarkingStatus('Click another line to mark the end of the section');
    } else {
      // Ending the current section
      const newSection = {
        ...currentSection,
        end: lineNumber,
        shouldSummarize
      };

      try {
        const response = await fetch(`${API_URL}/tokens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lines: uploadedText.lines,
            start: newSection.start,
            end: newSection.end,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to count tokens');
        }

        const data: TokenResponse = await response.json();
        newSection.tokenCount = data.token_count;

        setSections(prev => {
          const newSections = [...prev, newSection];
          localStorage.setItem(STORAGE_KEY_SECTIONS, JSON.stringify(newSections));
          return newSections;
        });

        setCurrentSection(null);
        setMarkingStatus('Click a line to start marking a section');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to count tokens');
      }
    }
  };

  const handleSaveSection = () => {
    if (!currentSection || !uploadedText) return;

    const newSection = {
      ...currentSection,
      end: uploadedText.lines.length - 1,
      shouldSummarize
    };

    setSections(prev => {
      const newSections = [...prev, newSection];
      localStorage.setItem(STORAGE_KEY_SECTIONS, JSON.stringify(newSections));
      return newSections;
    });

    setCurrentSection(null);
    setMarkingStatus('Click a line to start marking a section');
  };

  const handleDeleteSection = (index: number) => {
    setSections(prev => {
      const newSections = prev.filter((_, i) => i !== index);
      localStorage.setItem(STORAGE_KEY_SECTIONS, JSON.stringify(newSections));
      return newSections;
    });
  };

  const handleClear = () => {
    setSections([]);
    setCurrentSection(null);
    setUploadedText(null);
    setFile(null);
    localStorage.removeItem(STORAGE_KEY_SECTIONS);
    localStorage.removeItem(STORAGE_KEY_TEXT);
  };

  const handleExport = async () => {
    if (!sections.length || !uploadedText) return;

    setExporting(true);
    setExportSuccess(null);

    try {
      const response = await fetch(`${API_URL}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sections,
          lines: uploadedText.lines,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sections.zip';
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportSuccess('Export successful! Files downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-blue-400">Manual Book Splitter</h1>
        
        {uploadedText && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-4">
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded cursor-pointer"
                >
                  Upload New File
                </label>
                <button
                  onClick={handleClear}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                >
                  Clear All
                </button>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleExport}
                  disabled={exporting || !sections.length}
                  className={`px-4 py-2 rounded ${
                    exporting || !sections.length
                      ? 'bg-gray-500 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600'
                  } text-white`}
                >
                  {exporting ? 'Exporting...' : 'Export Sections'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500 text-white p-4 rounded mb-4">
                {error}
              </div>
            )}

            {exportSuccess && (
              <div className="bg-green-500 text-white p-4 rounded mb-4">
                {exportSuccess}
              </div>
            )}

            <div className="flex gap-8">
              <div className="flex-1">
                <div
                  ref={textContainerRef}
                  className="bg-gray-800 p-4 rounded-lg h-[600px] overflow-y-auto"
                >
                  {uploadedText.lines.map((line, index) => {
                    const isStart = currentSection?.start === index;
                    const isEnd = currentSection?.end === index;
                    const isInSection = sections.some(
                      section => index >= section.start && index <= (section.end || 0)
                    );

                    return (
                      <div
                        key={index}
                        onClick={() => handleLineClick(index)}
                        className={`p-1 cursor-pointer ${
                          isStart
                            ? 'bg-blue-500'
                            : isEnd
                            ? 'bg-green-500'
                            : isInSection
                            ? 'bg-gray-700'
                            : 'hover:bg-gray-700'
                        }`}
                      >
                        <span className="text-gray-400 mr-2">{index + 1}</span>
                        {line}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="w-80">
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h2 className="text-xl font-bold mb-4">Sections</h2>
                  <div ref={savedSectionsRef} className="space-y-4">
                    {sections.map((section, index) => (
                      <div
                        key={index}
                        className="bg-gray-700 p-3 rounded"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-bold">
                              Section {index + 1}
                            </div>
                            <div className="text-sm text-gray-300">
                              Lines {section.start + 1} - {section.end! + 1}
                            </div>
                            <div className="text-sm text-gray-300">
                              {section.tokenCount} tokens
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteSection(index)}
                            className="text-red-400 hover:text-red-300"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {!uploadedText && (
          <div className="flex flex-col items-center justify-center h-96">
            <input
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded cursor-pointer text-lg"
            >
              Upload a .txt File
            </label>
            {error && (
              <div className="bg-red-500 text-white p-4 rounded mt-4">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}