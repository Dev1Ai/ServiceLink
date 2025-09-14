import type { Request } from 'express';

export interface JwtUser {
  sub: string;
  role?: string;
  email?: string;
}

export type AuthedRequest = Request & { user: JwtUser };

