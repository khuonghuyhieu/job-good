import type { AuthenticatedPrincipal } from '../auth/authenticated-principal.js';

declare module 'express-session' {
  interface SessionData {
    employeeId: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedPrincipal;
      requestId?: string;
    }
  }
}

export {};
