'use client';

import { useState, useRef, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const STORAGE_KEY_SECTIONS = 'manual-splitter-sections';
const STORAGE_KEY_TEXT = 'manual-splitter-text';

export default function Home() {
  return <MainContent />;
}