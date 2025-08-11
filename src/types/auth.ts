export interface AuthUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url: string;
  access_token: string;
}

export interface JWTPayload {
  userId: number;
  login: string;
  iat: number;
  exp: number;
}

export interface OAuthState {
  state: string;
  redirect_uri?: string;
  created_at: number;
}