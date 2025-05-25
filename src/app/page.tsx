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

  return <MainContent />;
}