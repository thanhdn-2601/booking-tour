export interface ForgotPasswordResponse {
  status: 'RESET_EMAIL_SENT';
  resetToken?: string;
}
