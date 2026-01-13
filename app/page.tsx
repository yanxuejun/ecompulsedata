
export const runtime = 'edge'; // 必须声明以支持 Cloudflare

import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import DataStats from '@/components/DataStats';
import SocialProof from '@/components/SocialProof';
import Features from '@/components/Features';
import TrendPreview from '@/components/TrendPreview';
import Footer from '@/components/Footer';
import HomeGrowthSection from "./components/HomeGrowthSection";
import CategoryGrid from '@/components/CategoryGrid'; // 1. 引入新组件
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from 'react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <DataStats />
        <Suspense fallback={<div className="py-20 text-center">Loading trends...</div>}>
          <CategoryGrid />
        </Suspense>
        <SocialProof />
        <Features />
      </main>
      <Footer />
    </div>
  );
}
