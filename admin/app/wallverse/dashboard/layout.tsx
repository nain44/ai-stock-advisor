'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WallverseDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('wv_token');
    if (!token) {
      router.replace('/wallverse/login');
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0a0a0f', color: '#f1f0ff' }}>
        <p>Checking authorization...</p>
      </div>
    );
  }

  return <>{children}</>;
}
