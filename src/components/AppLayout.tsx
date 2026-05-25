'use client'

import { BottomNavigation } from '@/components/BottomNavigation';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => (
  <>
    {children}
    <BottomNavigation />
  </>
);