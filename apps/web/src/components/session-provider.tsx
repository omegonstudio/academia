'use client';

import type { SessionUser } from '@academia/shared';
import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
  );
}

export function useSessionUser(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) {
    throw new Error('useSessionUser must be used within SessionProvider');
  }
  return user;
}
