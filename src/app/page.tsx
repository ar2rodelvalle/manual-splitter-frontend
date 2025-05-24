'use client';

import { useState, useRef } from 'react';

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

const DEFAULT_MAX_TOKENS = 3000; // Default maximum tokens per section

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
  const [exportPath, setExportPath] = useState('/Users/arturodelvalle/Documents/websites/bookstore/manual-splitter/output');
  const [midpoint, setMidpoint] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [replaceCount, setReplaceCount] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.txt')) {
        setError('Please select a .txt file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleClear = () => {
    setFile(null);
    setUploadedText(null);
    setCurrentSection(null);
    setSections([]);
    setError(null);
    setTokenCount(null);
    // Reset the file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Upload successful:', data);
      setUploadedText(data);
      // Reset sections when new file is uploaded
      setCurrentSection(null);
      setSections([]);
      setTokenCount(null);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const countTokens = async (start: number, end: number) => {
    if (!uploadedText) return;

    try {
      const response = await fetch('http://localhost:8000/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lines: uploadedText.lines,
          start,
          end,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Token counting failed: ${response.statusText}`);
      }

      const data: TokenResponse = await response.json();
      setTokenCount(data.token_count);
      return data.token_count;
    } catch (err) {
      console.error('Token counting error:', err);
      setError(err instanceof Error ? err.message : 'Token counting failed');
      return null;
    }
  };

  const handleLineClick = async (lineNumber: number) => {
    if (!uploadedText) return;

    // If no current section, start a new one
    if (!currentSection) {
      const title = useTitleBookmark ? uploadedText.lines[lineNumber].trim() : undefined;
      // Set default title to previous section's title if available, otherwise use detected title
      const defaultTitle = sections.length > 0 
        ? (sections[sections.length - 1].title || '') 
        : (title || '');
      setManualTitle(title || defaultTitle);
      setCurrentSection({ start: lineNumber, end: null, tokenCount: 0, title, shouldSummarize });
      setMarkingStatus('Click another line to mark the end of the section');
      setMidpoint(null); // Clear midpoint when starting new section
      return;
    }

    // If we have a start but no end, and the clicked line is after the start
    if (currentSection.end === null && lineNumber > currentSection.start) {
      const tokenCount = await countTokens(currentSection.start, lineNumber);
      if (tokenCount !== null) {
        const finalTokenCount = tokenCount || 0;
        setCurrentSection({ ...currentSection, end: lineNumber, tokenCount: finalTokenCount });
        setMarkingStatus('Section marked. Save or clear to continue.');
        
        // Calculate midpoint if token count exceeds max
        if (finalTokenCount > maxTokens) {
          const mid = Math.floor((lineNumber + currentSection.start) / 2);
          setMidpoint(mid);
        } else {
          setMidpoint(null);
        }
      }
    }
  };

  const handleSaveSection = () => {
    if (currentSection && currentSection.end !== null) {
      // Use manual title if provided, otherwise use the auto-detected title
      const title = manualTitle.trim() || currentSection.title;
      setSections([...sections, { ...currentSection, title, shouldSummarize }]);
      setCurrentSection(null);
      setTokenCount(null);
      setManualTitle('');
      setMidpoint(null); // Clear the midpoint when saving a section
      setMarkingStatus('Click a line to start marking a section');
      
      // Scroll to the latest section after a short delay to ensure the DOM has updated
      setTimeout(() => {
        if (savedSectionsRef.current) {
          savedSectionsRef.current.scrollTop = savedSectionsRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const handleClearSection = () => {
    setCurrentSection(null);
    setTokenCount(null);
    setMarkingStatus('Click a line to start marking a section');
  };

  const isLineMarked = (lineNumber: number) => {
    if (!currentSection) return false;
    
    // If we only have a start, only highlight that line
    if (currentSection.end === null) {
      return lineNumber === currentSection.start;
    }
    
    // If we have both start and end, highlight the range
    return lineNumber >= currentSection.start && lineNumber <= currentSection.end;
  };

  const getLineStyle = (lineNumber: number) => {
    // Get the last section's end line
    const lastSectionEnd = sections.length > 0 ? sections[sections.length - 1].end : -1;
    
    // If this line is before the last section's end, apply dimming
    if (lastSectionEnd !== null && lineNumber <= lastSectionEnd) {
      return 'text-gray-500';
    }
    
    // Apply current section highlighting
    if (!isLineMarked(lineNumber)) return '';
    
    if (currentSection && lineNumber === currentSection.start) {
      return 'bg-blue-900/50 border-l-4 border-blue-400';
    }
    
    if (currentSection && currentSection.end === lineNumber) {
      return 'bg-blue-900/50 border-l-4 border-blue-400';
    }
    
    return 'bg-blue-900/30';
  };

  const handleMaxTokensChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setMaxTokens(value);
    }
  };

  const getTokenCountColor = () => {
    if (tokenCount === null) return 'bg-gray-700';
    const percentage = (tokenCount / maxTokens) * 100;
    if (percentage < 50) return 'bg-green-600';
    if (percentage < 80) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const handleDeleteSection = (index: number) => {
    // Remove the section at the specified index
    const newSections = sections.filter((_, i) => i !== index);
    setSections(newSections);
  };

  const handleJumpToRow = () => {
    const rowNumber = parseInt(jumpToRow);
    if (!isNaN(rowNumber) && rowNumber > 0 && uploadedText && rowNumber <= uploadedText.lines.length) {
      const lineElement = document.getElementById(`line-${rowNumber - 1}`);
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the line briefly
        lineElement.classList.add('bg-blue-900/50');
        setTimeout(() => {
          lineElement.classList.remove('bg-blue-900/50');
        }, 1000);
      }
    } else {
      setError('Please enter a valid row number');
    }
  };

  const handleJumpToMidpoint = () => {
    if (midpoint !== null && currentSection) {
      // Clear the end marker but keep the start
      setCurrentSection({ ...currentSection, end: null, tokenCount: 0 });
      setTokenCount(null);
      setMarkingStatus('Click another line to mark the end of the section');
      
      const lineElement = document.getElementById(`line-${midpoint}`);
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the line briefly
        lineElement.classList.add('bg-blue-900/50');
        setTimeout(() => {
          lineElement.classList.remove('bg-blue-900/50');
        }, 1000);
      }
    }
  };

  const handleExport = async () => {
    if (sections.length === 0) {
      alert('No sections to export');
      return;
    }

    if (!uploadedText) {
      alert('No text content available');
      return;
    }

    setExporting(true);
    setExportSuccess(null);
    try {
      const response = await fetch('http://localhost:8000/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sections,
          lines: uploadedText.lines,
          outputPath: exportPath
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      const data = await response.json();
      setExportSuccess(`Files exported successfully to ${data.outputPath}`);
    } catch (error) {
      console.error('Export error:', error);
      alert(error instanceof Error ? error.message : 'Failed to export sections');
    } finally {
      setExporting(false);
    }
  };

  const handleReplace = async () => {
    if (!uploadedText || !searchText) return;

    setReplacing(true);
    setReplaceCount(null);
    try {
      const response = await fetch('http://localhost:8000/replace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lines: uploadedText.lines,
          search: searchText,
          replace: replaceText
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Replace failed');
      }

      const data = await response.json();
      setUploadedText({ ...uploadedText, lines: data.lines });
      setReplaceCount(data.replacements);
    } catch (error) {
      console.error('Replace error:', error);
      alert(error instanceof Error ? error.message : 'Failed to replace text');
    } finally {
      setReplacing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-blue-400">Manual Book Splitter</h1>
        {uploadedText && (
          <h2 className="text-xl font-semibold text-blue-300 mb-4">{uploadedText.filename}</h2>
        )}
        <div className="flex items-start gap-8">
          {/* Main text area */}
          <div className="flex-[2] flex flex-col">
            {uploadedText && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex-1">
                <div ref={textContainerRef} className="overflow-auto max-h-[800px] font-mono text-sm">
                  {uploadedText.lines.map((line, index) => {
                    const lastSectionEnd = sections.length > 0 ? sections[sections.length - 1].end : -1;
                    const showDivider = lastSectionEnd !== null && index === lastSectionEnd + 1;
                    return (
                      <div key={index}>
                        {showDivider && (
                          <div className="h-px bg-blue-500/50 my-2 mx-4" />
                        )}
                        <div
                          id={`line-${index}`}
                          onClick={() => handleLineClick(index)}
                          className={`flex hover:bg-gray-700/50 cursor-pointer ${getLineStyle(index)}`}
                        >
                          <div className="w-16 px-4 py-1 text-right text-gray-400 border-r border-gray-700 select-none">
                            {index + 1}
                          </div>
                          <div className="flex-1 px-4 py-1 whitespace-pre">
                            {line}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar with all controls */}
          <div className="w-96 flex-shrink-0 space-y-6">
            {/* Upload controls */}
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 bg-gray-800 mb-2">
              <input
                type="file"
                accept=".txt"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-300
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-900 file:text-blue-200
                  hover:file:bg-blue-800"
              />
              <div className="flex gap-4 mt-4">
                <button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold
                    ${!file || loading
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {loading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  onClick={handleClear}
                  disabled={!uploadedText && !file}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold
                    ${!uploadedText && !file
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                >
                  Clear Text
                </button>
              </div>
              {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded mt-4">
                  {error}
                </div>
              )}
            </div>

            {/* Section Marking Controls */}
            {uploadedText && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-300 mb-2">Section Marking</h3>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <label htmlFor="jumpToRow" className="text-sm text-gray-400">Jump to row:</label>
                    <input
                      type="number"
                      id="jumpToRow"
                      value={jumpToRow}
                      onChange={(e) => setJumpToRow(e.target.value)}
                      min="1"
                      max={uploadedText.lines.length}
                      className="w-20 px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600 focus:border-blue-500 focus:outline-none"
                      placeholder="Row #"
                    />
                    <button
                      onClick={handleJumpToRow}
                      className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
                    >
                      Jump
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="maxTokens" className="text-sm text-gray-400">Max Tokens:</label>
                    <input
                      type="number"
                      id="maxTokens"
                      value={maxTokens}
                      onChange={handleMaxTokensChange}
                      min="1"
                      className="w-24 px-2 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  {tokenCount !== null && (
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-gray-400">Tokens:</div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getTokenCountColor()}`}>{tokenCount} / {maxTokens}</div>
                    </div>
                  )}
                  <div className="text-sm text-gray-400 mb-2">{markingStatus}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useTitleBookmark"
                      checked={useTitleBookmark}
                      onChange={(e) => setUseTitleBookmark(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="useTitleBookmark" className="text-sm text-gray-300">Use clicked line as section title</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="shouldSummarize"
                      checked={shouldSummarize}
                      onChange={(e) => setShouldSummarize(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="shouldSummarize" className="text-sm text-gray-300">Summarize this section</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="manualTitle" className="text-sm text-gray-300 whitespace-nowrap">Section Title:</label>
                    <input
                      type="text"
                      id="manualTitle"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Enter section title"
                      disabled={!currentSection}
                      className={`flex-1 px-3 py-1 rounded bg-gray-700 text-gray-200 border border-gray-600 focus:border-blue-500 focus:outline-none ${!currentSection ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={handleSaveSection}
                      disabled={!currentSection || currentSection.end === null}
                      className={`flex-1 py-2 px-4 rounded-lg font-semibold ${!currentSection || currentSection.end === null ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                    >
                      Save Section
                    </button>
                    <button
                      onClick={handleClearSection}
                      disabled={!currentSection}
                      className={`flex-1 py-2 px-4 rounded-lg font-semibold ${!currentSection ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                    >
                      Clear Section
                    </button>
                  </div>
                  {midpoint !== null && (
                    <button
                      onClick={handleJumpToMidpoint}
                      className="w-full py-2 px-4 rounded-lg font-semibold bg-yellow-600 text-white hover:bg-yellow-700"
                      title="Jump to suggested midpoint for splitting this section"
                    >
                      Jump to Midpoint
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Replace Text Controls */}
            {uploadedText && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-300 mb-2">Replace Text</h3>
                <div className="flex flex-col gap-2 mb-2">
                  <div className="flex gap-2 w-full">
                    <input
                      type="text"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Text to replace"
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm min-w-0"
                    />
                    <span className="text-gray-400 self-center">→</span>
                    <input
                      type="text"
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      placeholder="Replace with"
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm min-w-0"
                    />
                  </div>
                </div>
                <button
                  onClick={handleReplace}
                  disabled={replacing || !searchText}
                  className={`w-full px-4 py-2 rounded ${replacing || !searchText ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium transition-colors`}
                >
                  {replacing ? 'Replacing...' : 'Replace'}
                </button>
                {replaceCount !== null && (
                  <div className="mt-2 text-sm text-gray-400">Replaced {replaceCount} occurrences</div>
                )}
              </div>
            )}

            {/* Export Controls */}
            {uploadedText && sections.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-300 mb-2">Export Sections</h3>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={exportPath}
                    onChange={(e) => setExportPath(e.target.value)}
                    placeholder="Enter output path"
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                  />
                  <button
                    onClick={() => setExportPath('/Users/arturodelvalle/Documents/websites/bookstore/manual-splitter/output')}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    title="Reset to default path"
                  >
                    Reset
                  </button>
                </div>
                <div className="text-xs text-gray-400 mb-2">Enter the full path where you want to save the files</div>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className={`w-full px-4 py-2 rounded ${exporting ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium transition-colors`}
                >
                  {exporting ? 'Exporting...' : 'Export Sections'}
                </button>
                {exportSuccess && (
                  <div className="mt-2 p-2 bg-green-900/50 border border-green-700 rounded text-sm">{exportSuccess}</div>
                )}
              </div>
            )}

            {/* Saved Sections */}
            {uploadedText && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sticky top-8">
                <h3 className="text-lg font-semibold text-blue-300 mb-4">Saved Sections</h3>
                {sections.length === 0 ? (
                  <div className="text-sm text-gray-400 italic">No sections saved yet</div>
                ) : (
                  <div ref={savedSectionsRef} className="space-y-3 max-h-[300px] overflow-y-auto">
                    {sections.map((section, index) => (
                      <div key={index} className="bg-gray-700/50 p-3 rounded-lg relative group">
                        <button
                          onClick={() => handleDeleteSection(index)}
                          className="absolute top-2 right-2 p-1 rounded-full bg-gray-600/50 hover:bg-red-600/50 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove section"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <div className="text-sm text-gray-300 font-medium mb-1">{section.title ? section.title : `Section ${index + 1}`}</div>
                        <div className="text-sm text-gray-400">Lines {section.start + 1} to {section.end !== null ? section.end + 1 : '?'}</div>
                        <div className="text-sm text-gray-300 mt-1">Tokens: {section.tokenCount}</div>
                        <div className="text-sm text-gray-400 mt-1">{section.shouldSummarize ? 'Will be summarized' : 'Will not be summarized'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
    </main>
  );
}
