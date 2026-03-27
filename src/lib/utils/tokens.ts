import crypto from "crypto";

const DEFAULT_EMAIL_TOKEN_TTL_MINUTES = 60 * 24;

function getEmailTokenTTLMinutes() {
  const raw = Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }

  return DEFAULT_EMAIL_TOKEN_TTL_MINUTES;
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(token);
  const ttlMinutes = getEmailTokenTTLMinutes();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  return {
    token,
    hashedToken,
    expiresAt,
  };
}
