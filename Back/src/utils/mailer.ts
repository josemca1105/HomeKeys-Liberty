import { existsSync } from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { environment } from "../config/env";
import {
  EMAIL_LOGO_CID,
  renderPasswordResetEmail,
} from "./email-template";

export interface OutgoingMailAttachment {
  filename: string;
  path: string;
  cid: string;
}

export interface OutgoingMail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: OutgoingMailAttachment[];
}

export interface MailSender {
  sendMail(options: OutgoingMail): Promise<unknown>;
}

let mailSender: MailSender | null = null;

const createSmtpMailSender = (): MailSender => {
  const transporter: Transporter = nodemailer.createTransport({
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    secure: environment.SMTP_SECURE,
    auth: {
      user: environment.SMTP_USER,
      pass: environment.SMTP_APP_PASSWORD,
    },
  });

  return {
    sendMail: (options: OutgoingMail): Promise<unknown> => {
      return transporter.sendMail(options);
    },
  };
};

const getMailSender = (): MailSender => {
  if (!mailSender) {
    mailSender = createSmtpMailSender();
  }

  return mailSender;
};

// Allows tests and live checks to capture or replace outgoing mail without
// ever sending real emails during the automated suite.
export const setMailSenderForTesting = (sender: MailSender | null): void => {
  mailSender = sender;
};

// Resolves Back/assets/logo.png both when running from source (tsx) and from
// the compiled output in dist.
const resolveLogoPath = (): string | null => {
  const candidates = [
    path.join(process.cwd(), "assets", "logo.png"),
    path.join(process.cwd(), "Back", "assets", "logo.png"),
    path.resolve(__dirname, "..", "..", "..", "assets", "logo.png"),
    path.resolve(__dirname, "..", "..", "assets", "logo.png"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

export interface PasswordResetEmailData {
  to: string;
  firstName: string;
  resetUrl: string;
  expirationMinutes: number;
}

export const sendPasswordResetEmail = async ({
  to,
  firstName,
  resetUrl,
  expirationMinutes,
}: PasswordResetEmailData): Promise<void> => {
  const from =
    environment.SMTP_FROM !== ""
      ? environment.SMTP_FROM
      : environment.SMTP_USER;

  const { subject, html, text } = renderPasswordResetEmail({
    firstName,
    resetUrl,
    expirationMinutes,
  });

  const logoPath = resolveLogoPath();

  if (!logoPath) {
    console.warn(
      "Email logo not found at assets/logo.png; sending the email without it.",
    );
  }

  await getMailSender().sendMail({
    from,
    to,
    subject,
    text,
    html,
    ...(logoPath
      ? {
          attachments: [
            { filename: "logo.png", path: logoPath, cid: EMAIL_LOGO_CID },
          ],
        }
      : {}),
  });
};
