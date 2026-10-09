import { type AuthValidationErrors } from "./auth.types";

export function validateLogin(email: string, password: string): AuthValidationErrors {
  const errors: AuthValidationErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = "Enter your email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Enter your password.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  return errors;
}

export function validateSignup(
  displayName: string,
  email: string,
  password: string,
  confirmPassword: string
): AuthValidationErrors {
  const errors: AuthValidationErrors = {};
  const trimmedName = displayName.trim();
  const trimmedEmail = email.trim();

  if (!trimmedName) {
    errors.displayName = "Enter an explorer name.";
  }

  if (!trimmedEmail) {
    errors.email = "Enter your email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
