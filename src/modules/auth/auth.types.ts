export interface LoginBody {
  email: string;
  password: string;
  organizationSlug: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
}