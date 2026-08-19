export type AuthPayload = {
  isValid: boolean;
  user_id?: string;
  role?: string;
  customer_id?: string;
  seller_id?: string;
  api_key_id?: string;
  error?: string;
};
