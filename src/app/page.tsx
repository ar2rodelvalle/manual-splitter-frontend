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
  return <MainContent />;
}