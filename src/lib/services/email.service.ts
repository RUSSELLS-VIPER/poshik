import nodemailer from "nodemailer";

type VerificationEmailInput = {
  to: string;
  name?: string;
  verificationLink: string;
};

type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

function buildVerificationEmailContent({
  name,
  verificationLink,
}: {
  name?: string;
  verificationLink: string;
}): EmailContent {
  const greeting = name ? `Hi ${name},` : "Hi,";

  return {
    subject: "Verify your Poshik account",
    text: `${greeting}\n\nPlease verify your email by clicking this link:\n${verificationLink}\n\nIf you did not create this account, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <p>${greeting}</p>
        <p>Please verify your email by clicking the button below:</p>
        <p>
          <a href="${verificationLink}" style="display: inline-block; padding: 10px 16px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 6px;">
            Verify Email
          </a>
        </p>
        <p>Or copy and paste this URL into your browser:</p>
        <p><a href="${verificationLink}">${verificationLink}</a></p>
        <p>If you did not create this account, you can ignore this email.</p>
      </div>
    `,
  };
}

function getEmailAuth() {
  const user =
    process.env.SMTP_USER ??
    process.env.EMAIL_USER ??
    process.env.EMAIL_FROM;
  const pass =
    process.env.SMTP_PASSWORD ??
    process.env.EMAIL_PASS ??
    process.env.PASS;
  const gmailClientId =
    process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  const gmailClientSecret =
    process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  const gmailRefreshToken =
    process.env.GMAIL_REFRESH_TOKEN ?? process.env.GOOGLE_REFRESH_TOKEN;
  const gmailAccessToken =
    process.env.GMAIL_ACCESS_TOKEN ?? process.env.GOOGLE_ACCESS_TOKEN;

  if (
    user &&
    gmailClientId &&
    gmailClientSecret &&
    (gmailRefreshToken || gmailAccessToken)
  ) {
    return {
      type: "OAuth2" as const,
      user,
      clientId: gmailClientId,
      clientSecret: gmailClientSecret,
      refreshToken: gmailRefreshToken,
      accessToken: gmailAccessToken,
    };
  }

  if (!user || !pass) {
    throw new Error(
      "Email credentials are missing. Provide SMTP_USER/SMTP_PASSWORD (or EMAIL_USER/EMAIL_PASS). If using Gmail OAuth, also provide GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET with GOOGLE_REFRESH_TOKEN (recommended) or GOOGLE_ACCESS_TOKEN."
    );
  }

  return { user, pass };
}

function getTransporter() {
  const auth = getEmailAuth();
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpTimeoutMs = Number(process.env.SMTP_TIMEOUT_MS ?? 10000);

  if (smtpHost) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth,
      connectionTimeout: smtpTimeoutMs,
      greetingTimeout: smtpTimeoutMs,
      socketTimeout: smtpTimeoutMs,
    });
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE ?? "gmail",
    auth,
    connectionTimeout: smtpTimeoutMs,
    greetingTimeout: smtpTimeoutMs,
    socketTimeout: smtpTimeoutMs,
  });
}

async function sendVerificationEmailWithResend({
  to,
  from,
  subject,
  text,
  html,
}: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const hasLikelyValidResendKey =
    Boolean(apiKey) && apiKey !== "re_..." && apiKey!.startsWith("re_");
  if (!hasLikelyValidResendKey) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Resend API request failed with status ${response.status}: ${errorBody}`
    );
  }

  return true;
}

export async function sendVerificationEmail({
  to,
  name,
  verificationLink,
}: VerificationEmailInput) {
  const { subject, text, html } = buildVerificationEmailContent({
    name,
    verificationLink,
  });
  const from = process.env.EMAIL_FROM?.trim();

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const hasLikelyValidResendKey =
    typeof resendApiKey === "string" &&
    resendApiKey !== "re_..." &&
    resendApiKey.startsWith("re_");

  // Prefer Resend when configured with a real key, but gracefully fall back to SMTP.
  if (hasLikelyValidResendKey) {
    if (!from) {
      throw new Error(
        "EMAIL_FROM is required when using RESEND_API_KEY for email delivery."
      );
    }

    try {
      await sendVerificationEmailWithResend({
        to,
        from,
        subject,
        text,
        html,
      });
      return;
    } catch (error) {
      console.error("Resend delivery failed, falling back to SMTP:", error);
    }
  }

  const auth = getEmailAuth();
  const smtpFrom = from ?? auth.user;

  const transporter = getTransporter();

  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
    html,
  });
}
