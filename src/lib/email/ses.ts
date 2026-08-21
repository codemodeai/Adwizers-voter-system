import "server-only";

import { createHash, createHmac } from "node:crypto";

import type { Email, SendResult } from "@/lib/email/resend";

/**
 * Amazon SES v2, signed by hand (Final Plan section 8).
 *
 * SigV4 over `fetch` rather than `@aws-sdk/client-sesv2`, matching how Resend
 * is called here: this is one POST to one endpoint, and the SDK would add
 * several megabytes to a function whose entire job is to send a six-digit
 * number.
 *
 * Why SES at all, when Resend is already wired: verification codes scale with
 * visitors during a live voting window, potentially tens of thousands, where
 * SES's metered rate fits and Resend's free tier (100/day) does not. Nominee
 * notifications stay on Resend -- low volume, and the domain is already
 * verified there. That two-provider split is the plan's own.
 *
 * The credentials are deliberately NOT named AWS_ACCESS_KEY_ID /
 * AWS_SECRET_ACCESS_KEY. Vercel functions run on Lambda, whose runtime sets
 * those exact variables to its own role credentials -- our values would be
 * silently overwritten and every send would fail signature validation.
 */

const ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "ses";

type Credentials = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  from: string;
};

function credentials(): Credentials | null {
  const region = process.env.SES_REGION?.trim();
  const accessKeyId = process.env.SES_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY?.trim();
  const from = process.env.SES_FROM?.trim();

  if (!region || !accessKeyId || !secretAccessKey || !from) return null;
  return { region, accessKeyId, secretAccessKey, from };
}

export function sesConfigured(): boolean {
  return credentials() !== null;
}

/** For the dashboard: which region is in use, or null when unconfigured. */
export function sesRegion(): string | null {
  return credentials()?.region ?? null;
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * The SigV4 signing key: four chained HMACs, each keyed by the previous one.
 * Deriving it per request is cheap and avoids caching a long-lived secret.
 */
function signingKey(secret: string, date: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

export async function sendViaSes(email: Email): Promise<SendResult> {
  const creds = credentials();
  if (!creds) return { status: "skipped", reason: "SES is not configured." };

  const to = email.to.trim();
  if (!to) return { status: "skipped", reason: "No email address on file." };

  const host = `email.${creds.region}.amazonaws.com`;
  const path = "/v2/email/outbound-emails";

  const payload = JSON.stringify({
    FromEmailAddress: creds.from,
    Destination: { ToAddresses: [to] },
    ...(email.replyTo ? { ReplyToAddresses: [email.replyTo] } : {}),
    Content: {
      Simple: {
        Subject: { Data: email.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: email.html, Charset: "UTF-8" },
          Text: { Data: email.text, Charset: "UTF-8" },
        },
      },
    },
  });

  // 20260821T134500Z and 20260821 -- SigV4 wants both forms.
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(payload);

  // Header names lowercased and sorted; values trimmed. Getting either wrong
  // produces SignatureDoesNotMatch and nothing more specific.
  const canonicalHeaders =
    `content-type:application/json\n` + `host:${host}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";

  const canonicalRequest = [
    "POST",
    path,
    "", // no query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${creds.region}/${SERVICE}/aws4_request`;
  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  const signature = createHmac("sha256", signingKey(creds.secretAccessKey, dateStamp, creds.region))
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `${ALGORITHM} Credential=${creds.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const response = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Amz-Date": amzDate,
        Authorization: authorization,
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const data = (await response.json()) as { MessageId?: string };
      return { status: "sent", id: data.MessageId ?? null };
    }

    const body = await response.text();
    return { status: "failed", error: explain(response.status, body) };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "TimeoutError"
          ? "SES did not respond in time."
          : error.message
        : "Unknown error sending via SES.";
    return { status: "failed", error: message };
  }
}

/**
 * SES failures are mostly setup problems, and its raw messages do not say which
 * one. These three are the ones that actually happen, and each has a different
 * fix -- worth naming rather than surfacing "400 Bad Request" to an admin.
 */
function explain(status: number, body: string): string {
  let message = `SES returned ${status}`;
  try {
    const parsed = JSON.parse(body) as { message?: string; Message?: string; __type?: string };
    message = parsed.message ?? parsed.Message ?? message;

    if (/not verified/i.test(message)) {
      return `${message} — verify the sending domain in SES, or the account is still in the sandbox and can only email verified addresses.`;
    }
    if (/SignatureDoesNotMatch/i.test(message) || /SignatureDoesNotMatch/i.test(body)) {
      return "SES rejected the signature. Check SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY and SES_REGION.";
    }
    if (/Throttl/i.test(message) || status === 429) {
      return "SES is throttling. The account may still be in the sandbox, which allows 1 email per second.";
    }
  } catch {
    if (body) message = body.slice(0, 200);
  }
  return message;
}
