/**
 * Reusable branded email templates for HomeKeys Liberty.
 *
 * Emails must use table-based HTML with inline styles (Gmail and Outlook
 * requirements), a 600px max-width card, web-safe fonts, and a plain-text
 * alternative part. The logo is embedded by the mailer as a CID attachment
 * (see EMAIL_LOGO_CID) so it renders even when clients block remote images.
 */

export const EMAIL_LOGO_CID = "homekeys-logo";

// Brand palette derived from the HomeKeys Liberty logo.
const BRAND_COLORS = {
  primary: "#2b6cb8",
  accent: "#d4b44a",
  heading: "#223a4e",
  bodyText: "#3e4c59",
  muted: "#6b7a88",
  pageBackground: "#eef2f6",
  cardBackground: "#ffffff",
  softBackground: "#eaf2fa",
  noticeBackground: "#fbf6e7",
  border: "#d5dee6",
} as const;

const FONT_STACK = "Arial, Helvetica, sans-serif";

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

export interface EmailLayoutAction {
  label: string;
  url: string;
  fallbackLabel: string;
}

export interface EmailLayoutInput {
  heading: string;
  greeting: string;
  paragraphs: string[];
  action?: EmailLayoutAction;
  notice?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

const renderActionHtml = (action: EmailLayoutAction): string => {
  const safeUrl = escapeHtml(action.url);

  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 8px;">`,
    `<tr><td align="center" bgcolor="${BRAND_COLORS.primary}" style="border-radius:6px;">`,
    `<a href="${safeUrl}" style="display:inline-block; padding:14px 32px; font-family:${FONT_STACK}; font-size:16px; line-height:20px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:6px;">${escapeHtml(action.label)}</a>`,
    `</td></tr></table>`,
    `<p style="margin:20px 0 0; font-size:13px; line-height:20px; color:${BRAND_COLORS.muted};">${escapeHtml(action.fallbackLabel)}</p>`,
    `<p style="margin:8px 0 0; padding:12px 16px; background-color:${BRAND_COLORS.softBackground}; border:1px solid ${BRAND_COLORS.border}; border-radius:6px; font-size:13px; line-height:20px; word-break:break-all; color:${BRAND_COLORS.bodyText};"><a href="${safeUrl}" style="color:${BRAND_COLORS.primary}; text-decoration:none;">${safeUrl}</a></p>`,
  ].join("");
};

const renderNoticeHtml = (notice: string): string => {
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">`,
    `<tr><td style="background-color:${BRAND_COLORS.noticeBackground}; border-left:4px solid ${BRAND_COLORS.accent}; border-radius:6px; padding:16px 20px;">`,
    `<p style="margin:0; font-size:14px; line-height:22px; color:${BRAND_COLORS.bodyText};"><strong style="color:${BRAND_COLORS.heading};">Importante:</strong> ${escapeHtml(notice)}</p>`,
    `</td></tr></table>`,
  ].join("");
};

const renderHtml = (input: EmailLayoutInput): string => {
  const heading = escapeHtml(input.heading);
  const greeting = escapeHtml(input.greeting);
  const paragraphs = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:16px 0 0; font-size:16px; line-height:26px; color:${BRAND_COLORS.bodyText};">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  const action = input.action ? renderActionHtml(input.action) : "";
  const notice = input.notice ? renderNoticeHtml(input.notice) : "";
  const year = new Date().getFullYear();

  return [
    `<!DOCTYPE html>`,
    `<html lang="es">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
    `<meta name="color-scheme" content="light only">`,
    `<meta name="supported-color-schemes" content="light only">`,
    `<title>${heading}</title>`,
    `</head>`,
    `<body style="margin:0; padding:0; background-color:${BRAND_COLORS.pageBackground}; font-family:${FONT_STACK}; color:${BRAND_COLORS.bodyText};">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_COLORS.pageBackground};">`,
    `<tr><td align="center" style="padding:32px 16px;">`,
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:100%; background-color:${BRAND_COLORS.cardBackground}; border-radius:10px;">`,
    `<tr><td align="center" style="padding:36px 32px 24px;">`,
    `<img src="cid:${EMAIL_LOGO_CID}" width="96" height="96" alt="Logotipo de HomeKeys Liberty" style="display:block; width:96px; height:96px; border:0;">`,
    `<p style="margin:16px 0 0; font-size:20px; line-height:24px; font-weight:bold; letter-spacing:3px; color:${BRAND_COLORS.heading};">HOMEKEYS LIBERTY</p>`,
    `</td></tr>`,
    `<tr><td style="padding:0 32px;"><div style="height:4px; line-height:4px; background-color:${BRAND_COLORS.primary}; border-radius:2px;">&nbsp;</div></td></tr>`,
    `<tr><td style="padding:28px 32px 8px;">`,
    `<h1 style="margin:0; font-size:22px; line-height:28px; font-weight:bold; color:${BRAND_COLORS.heading};">${heading}</h1>`,
    `<p style="margin:16px 0 0; font-size:16px; line-height:26px; color:${BRAND_COLORS.bodyText};">${greeting}</p>`,
    paragraphs,
    action,
    notice,
    `</td></tr>`,
    `<tr><td style="padding:24px 32px 36px;">`,
    `<p style="margin:0; font-size:12px; line-height:18px; color:${BRAND_COLORS.muted};">Este es un mensaje automático de HomeKeys Liberty; por favor no respondas a este correo.<br>© ${year} HomeKeys Liberty. Todos los derechos reservados.</p>`,
    `</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `</table>`,
    `</body>`,
    `</html>`,
  ].join("\n");
};

const renderText = (input: EmailLayoutInput): string => {
  const lines = [
    "HOMEKEYS LIBERTY",
    "",
    input.heading,
    "",
    input.greeting,
    "",
    ...input.paragraphs.flatMap((paragraph) => [paragraph, ""]),
  ];

  if (input.action) {
    lines.push(`${input.action.label}:`, input.action.url, "");
  }

  if (input.notice) {
    lines.push(`Importante: ${input.notice}`, "");
  }

  lines.push(
    "Este es un mensaje automático de HomeKeys Liberty; por favor no respondas a este correo.",
    `© ${new Date().getFullYear()} HomeKeys Liberty. Todos los derechos reservados.`,
  );

  return lines.join("\n");
};

// Shared branded layout reused by every HomeKeys Liberty email.
export const renderEmailLayout = (input: EmailLayoutInput): RenderedEmail => {
  return {
    html: renderHtml(input),
    text: renderText(input),
  };
};

export interface PasswordResetEmailContent {
  firstName: string;
  resetUrl: string;
  expirationMinutes: number;
}

export const renderPasswordResetEmail = (
  content: PasswordResetEmailContent,
): RenderedEmail & { subject: string } => {
  const subject = "Restablece tu contraseña - HomeKeys Liberty";
  const rendered = renderEmailLayout({
    heading: "Restablece tu contraseña",
    greeting: `Hola ${content.firstName},`,
    paragraphs: [
      "Recibimos una solicitud para restablecer la contraseña de tu cuenta en HomeKeys Liberty.",
      `Para restablecerla, presiona el botón. Este enlace es válido por ${content.expirationMinutes} minutos y solo puede usarse una vez.`,
    ],
    action: {
      label: "Restablecer mi contraseña",
      url: content.resetUrl,
      fallbackLabel:
        "Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:",
    },
    notice:
      "Si no solicitaste este cambio, puedes ignorar este correo; tu contraseña no se modificará.",
  });

  return { subject, ...rendered };
};

export interface InvitationEmailContent {
  firstName: string;
  activationUrl: string;
  expirationHours: number;
}

export const renderInvitationEmail = (
  content: InvitationEmailContent,
): RenderedEmail & { subject: string } => {
  const subject = "Bienvenido a HomeKeys Liberty - Activa tu cuenta";
  const rendered = renderEmailLayout({
    heading: "Bienvenido a HomeKeys Liberty",
    greeting: `Hola ${content.firstName},`,
    paragraphs: [
      "Tu cuenta en HomeKeys Liberty fue creada. Para activarla, define tu contraseña personal presionando el botón.",
      `El enlace es válido por ${content.expirationHours} horas y solo puede usarse una vez. Con tu contraseña definida, podrás iniciar sesión normalmente.`,
    ],
    action: {
      label: "Activar mi cuenta",
      url: content.activationUrl,
      fallbackLabel:
        "Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:",
    },
    notice:
      "Si no esperabas este correo, puedes ignorarlo; no se creará ninguna contraseña hasta que actives tu cuenta.",
  });

  return { subject, ...rendered };
};

export interface PasswordResetNoticeEmailContent {
  firstName: string;
  loginUrl: string;
}

export const renderPasswordResetNoticeEmail = (
  content: PasswordResetNoticeEmailContent,
): RenderedEmail & { subject: string } => {
  const subject = "Tu contraseña fue restablecida - HomeKeys Liberty";
  const rendered = renderEmailLayout({
    heading: "Tu contraseña fue restablecida",
    greeting: `Hola ${content.firstName},`,
    paragraphs: [
      "Un administrador restableció la contraseña de tu cuenta en HomeKeys Liberty.",
      "Por seguridad, deberás definir una contraseña nueva en tu próximo inicio de sesión antes de continuar usando el sistema.",
    ],
    action: {
      label: "Iniciar sesión",
      url: content.loginUrl,
      fallbackLabel:
        "Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:",
    },
    notice:
      "Si no esperabas este cambio, contacta de inmediato a tu administrador.",
  });

  return { subject, ...rendered };
};
