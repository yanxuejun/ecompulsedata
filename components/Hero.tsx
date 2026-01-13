'use client';

import React from 'react';
import { Button } from './ui/button';
import { useI18n } from '@/lib/i18n/context';
import Link from "next/link";

export default function Hero() {
  const { t } = useI18n();

  return (
    <section
      className="w-full py-20 flex flex-col items-center text-center"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <h1
        className="text-4xl md:text-5xl font-bold mb-4"
        style={{
          fontFamily: 'var(--font-family-heading)',
          color: 'var(--color-primary)'
        }}
      >
        {t.hero.title}
      </h1>
      <h2
        className="text-lg md:text-2xl mb-8"
        style={{
          fontFamily: 'var(--font-family-body)',
          color: 'var(--color-dark)'
        }}
      >
        {t.hero.subtitle}
      </h2>
      <div className="flex flex-col md:flex-row gap-4 justify-center">
        <Link
          href="#explore"
          className="text-white font-bold px-8 py-3 text-lg rounded transition shadow"
          style={{
            backgroundColor: 'var(--color-accent)',
            border: 'none',
            display: 'inline-block',
            textAlign: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-cta)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-accent)'; }}
        >
          {t.hero.primaryCTA}
        </Link>
        <a
          href="/how-it-works"
          className="underline text-lg self-center"
          style={{ color: 'var(--color-primary)' }}
        >
          {t.hero.secondaryCTA}
        </a>
      </div>
    </section>
  );
} 