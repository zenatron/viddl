'use client';

import React from 'react';
import { FaHeart } from 'react-icons/fa';
import Link from 'next/link';
import packageJson from '../../package.json';

export default function Footer() {
  return (
    <footer className="bg-card border-t border-border py-4 mt-auto">
      <div className="container mx-auto px-4 text-center text-sm text-foreground/70">
        <p className="text-sm flex items-center justify-center">
          © {new Date().getFullYear()} viddl 
          <span className="mx-2">•</span>
          {"Built with"} 
          <FaHeart size={14} className="mx-1" /> 
          {"by"} 
          <Link href="https://github.com/zenatron" className="ml-1">{"zenatron"}</Link>
          <span className="mx-2">•</span>
          <span>v{packageJson.version}</span>
        </p>
      </div>
    </footer>
  );
}