import { sendDiscordNotification } from "./discord";

export interface ParsedEmail {
  from: string;
  subject: string;
  text: string;
  links: string[];
  dates: string[];
}

export function parseEmail(rawEmail: any): ParsedEmail {
  const text = rawEmail.text || rawEmail.html?.replace(/<[^>]*>/g, "") || "";
  const links = text.match(/https?:\/\/[^\s]+/g) || [];
  const datePattern =
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\w+ \d{1,2}(?:st|nd|rd|th)?/gi;
  const dates = text.match(datePattern) || [];

  return {
    from: rawEmail.from || "Unknown",
    subject: rawEmail.subject || "No Subject",
    text: text.slice(0, 500),
    links,
    dates,
  };
}

export function categorizeEmail(email: ParsedEmail): "HOT" | "WARM" | "COLD" {
  const content = (email.subject + " " + email.text).toLowerCase();
  if (
    content.match(
      /(urgent|asap|buy|pricing|demo|quote|interested|let's do it)/i,
    )
  )
    return "HOT";
  if (content.match(/(maybe|question|how much|tell me more|considering)/i))
    return "WARM";
  return "COLD";
}

export function formatEmailNotification(
  email: ParsedEmail,
  category: "HOT" | "WARM" | "COLD",
): string {
  const emoji = category === "HOT" ? "🔥" : category === "WARM" ? "🟡" : "❄️";
  const ts = new Date().toLocaleString("en-US", {
    timeZone: "UTC",
    hour12: false,
  });
  return (
    `${emoji} **${category} LEAD** | From: ${email.from}\n` +
    `📝 Subject: ${email.subject}\n` +
    `🔗 Links: ${email.links.join(", ") || "None"}\n` +
    `📅 Dates: ${email.dates.join(", ") || "None"}\n` +
    `📄 Preview: ${email.text.slice(0, 150)} — ${ts} UTC`
  );
}

export async function processEmailAndNotify(rawEmail: any): Promise<void> {
  const parsed = parseEmail(rawEmail);
  const category = categorizeEmail(parsed);
  const message = formatEmailNotification(parsed, category);
  await sendDiscordNotification(message);
}
