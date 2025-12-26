//src/app/dashboard/company-load/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const CompanyLoadClient = dynamic(() => import('./CompanyLoadClient'), { ssr: false });

export default function CompanyLoadPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <CompanyLoadClient />
    </Suspense>
  );
}
