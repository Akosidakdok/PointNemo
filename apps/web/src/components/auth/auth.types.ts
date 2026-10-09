export type AuthMode = "login" | "signup";

export type AuthViewState = "idle" | "editing" | "submitting" | "error" | "success";

export interface AuthenticatedUser {
  displayName: string;
  email: string;
  remembered: boolean;
}

export interface LocalExplorer {
  displayName: string;
  remembered: boolean;
}

export interface AuthValidationErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}
