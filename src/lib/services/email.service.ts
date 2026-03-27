import nodemailer from "nodemailer";

type VerificationEmailInput = {
  to: string;
  name?: string;
  verificationLink: string;
};

function getEmailAuth() {
  const user = process.env.SMTP_USER ?? process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASSWORD ?? process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error(
      "Email credentials are missing. Set SMTP_USER/SMTP_PASSWORD or EMAIL_USER/EMAIL_PASS."
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

export async function sendVerificationEmail({
  to,
  name,
  verificationLink,
}: VerificationEmailInput) {
  const auth = getEmailAuth();
  const from = process.env.EMAIL_FROM ?? auth.user;
  const greeting = name ? `Hi ${name},` : "Hi,";

  const transporter = getTransporter();

  await transporter.sendMail({
    from,
    to,
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
  });
}
