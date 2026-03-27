import { db } from "./db";
import { systemNotifications, contracts, contractAcquirers, contractRewardDistributions, appUsers, subjects, sectorProducts, guardianConfirmationTokens } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

// ============================================================
// ArutsoK Email Notification System
// ============================================================
// Emails are stored in system_notifications table as "pending".
// When SendGrid is configured, activate sendPendingEmails()
// to process the queue.
// ============================================================

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@arutsok.sk";

export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.log(`[EMAIL] SendGrid not configured. Email queued but not sent: ${subject} → ${to}`);
    return false;
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: "ArutsoK (ATK)" },
        subject,
        content: [{ type: "text/html", value: htmlBody }],
      }),
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(`[EMAIL] Sent: ${subject} → ${to}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`[EMAIL] SendGrid error ${response.status}: ${errorText}`);
      return false;
    }
  } catch (err) {
    console.error(`[EMAIL] Send failed:`, err);
    return false;
  }
}

export async function sendPendingEmails(): Promise<number> {
  const pending = await db.select().from(systemNotifications)
    .where(and(
      eq(systemNotifications.status, "pending"),
      sql`${systemNotifications.notificationType} != 'guardian_sms_code'`
    ))
    .limit(50);

  let sentCount = 0;
  for (const notification of pending) {
    const success = await sendEmail(notification.recipientEmail, notification.subject, notification.bodyHtml);

    if (success) {
      await db.update(systemNotifications)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(systemNotifications.id, notification.id));
      sentCount++;
    } else {
      await db.update(systemNotifications)
        .set({
          status: SENDGRID_API_KEY ? "failed" : "pending",
          errorDetails: SENDGRID_API_KEY ? "SendGrid API error" : "SendGrid not configured",
        })
        .where(eq(systemNotifications.id, notification.id));
    }
  }

  return sentCount;
}

/**
 * Processes pending guardian SMS notifications via Twilio.
 * Looks up the SMS code from the guardian confirmation token and sends it to the target's phone.
 * If Twilio is not configured, marks notifications as failed with a clear error message.
 */
export async function processPendingSmsNotifications(): Promise<number> {
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;

  const pending = await db.select().from(systemNotifications)
    .where(and(
      eq(systemNotifications.status, "pending"),
      eq(systemNotifications.notificationType, "guardian_sms_code")
    ))
    .limit(20);

  let sentCount = 0;
  for (const notification of pending) {
    if (!notification.recipientUserId) {
      await db.update(systemNotifications)
        .set({ status: "failed", errorDetails: "No recipientUserId for SMS dispatch" })
        .where(eq(systemNotifications.id, notification.id));
      continue;
    }

    const [user] = await db.select({ phone: appUsers.phone })
      .from(appUsers).where(eq(appUsers.id, notification.recipientUserId));
    if (!user?.phone) {
      await db.update(systemNotifications)
        .set({ status: "failed", errorDetails: "Target user has no phone number" })
        .where(eq(systemNotifications.id, notification.id));
      continue;
    }

    // Resolve SMS code via batchId binding (guardian_token_{tokenId}) for exact match,
    // falling back to latest-pending for legacy notifications without batchId
    let tokenRecord: { smsCode: string } | undefined;
    const boundTokenId = notification.batchId?.startsWith("guardian_token_")
      ? parseInt(notification.batchId.replace("guardian_token_", ""), 10)
      : null;
    if (boundTokenId && !isNaN(boundTokenId)) {
      const [byId] = await db.select({ smsCode: guardianConfirmationTokens.smsCode })
        .from(guardianConfirmationTokens)
        .where(and(
          eq(guardianConfirmationTokens.id, boundTokenId),
          eq(guardianConfirmationTokens.rejected, false)
        ))
        .limit(1);
      tokenRecord = byId;
    } else {
      // Legacy fallback: latest non-rejected token for this target user
      const [byUser] = await db.select({ smsCode: guardianConfirmationTokens.smsCode })
        .from(guardianConfirmationTokens)
        .where(and(
          eq(guardianConfirmationTokens.targetUserId, notification.recipientUserId),
          eq(guardianConfirmationTokens.rejected, false)
        ))
        .orderBy(desc(guardianConfirmationTokens.id))
        .limit(1);
      tokenRecord = byUser;
    }
    const token = tokenRecord;

    if (!token?.smsCode) {
      await db.update(systemNotifications)
        .set({ status: "failed", errorDetails: "No pending guardian token with SMS code found" })
        .where(eq(systemNotifications.id, notification.id));
      continue;
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
      await db.update(systemNotifications)
        .set({ status: "failed", errorDetails: "SMS gateway (Twilio) not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER" })
        .where(eq(systemNotifications.id, notification.id));
      console.warn(`[SMS] Twilio not configured — cannot dispatch guardian SMS code to user ${notification.recipientUserId}`);
      continue;
    }

    const smsBody = `ArutsoK (ATK): Váš kód na potvrdenie opatrovníctva je ${token.smsCode}. Platnosť 72 hodín.`;
    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: user.phone, From: TWILIO_FROM, Body: smsBody }).toString(),
      });
      if (response.ok) {
        await db.update(systemNotifications)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(systemNotifications.id, notification.id));
        console.log(`[SMS] Sent guardian SMS code to user ${notification.recipientUserId}`);
        sentCount++;
      } else {
        const errText = await response.text();
        await db.update(systemNotifications)
          .set({ status: "failed", errorDetails: `Twilio error: ${errText.slice(0, 200)}` })
          .where(eq(systemNotifications.id, notification.id));
      }
    } catch (err: any) {
      await db.update(systemNotifications)
        .set({ status: "failed", errorDetails: `SMS send error: ${err?.message || "Unknown"}` })
        .where(eq(systemNotifications.id, notification.id));
    }
  }

  return sentCount;
}

interface ContractNotificationData {
  contractId: number;
  contractNumber: string;
  clientName: string;
  clientUid: string;
  partnerName: string;
}

async function getContractRecipients(contractId: number): Promise<{ email: string; name: string; userId: number; role: string }[]> {
  const recipients: { email: string; name: string; userId: number; role: string }[] = [];

  const acquirers = await db.select({
    userId: contractAcquirers.userId,
    email: appUsers.email,
    username: appUsers.username,
  })
    .from(contractAcquirers)
    .innerJoin(appUsers, eq(contractAcquirers.userId, appUsers.id))
    .where(eq(contractAcquirers.contractId, contractId));

  for (const a of acquirers) {
    if (a.email) {
      recipients.push({ email: a.email, name: a.username || "Špecialista", userId: a.userId, role: "specialist" });
    }
  }

  const distributions = await db.select({
    uid: contractRewardDistributions.uid,
    type: contractRewardDistributions.type,
  })
    .from(contractRewardDistributions)
    .where(eq(contractRewardDistributions.contractId, contractId));

  for (const d of distributions) {
    if (d.type === "recommender" && d.uid) {
      const matchingUser = await db.select({
        id: appUsers.id,
        email: appUsers.email,
        username: appUsers.username,
      })
        .from(appUsers)
        .where(eq(appUsers.uid, d.uid))
        .limit(1);

      if (matchingUser.length > 0 && matchingUser[0].email) {
        const alreadyAdded = recipients.some(r => r.userId === matchingUser[0].id);
        if (!alreadyAdded) {
          recipients.push({ email: matchingUser[0].email, name: matchingUser[0].username || "Odporúčateľ", userId: matchingUser[0].id, role: "recommender" });
        }
      }
    }
  }

  return recipients;
}

async function getContractNotificationData(contractId: number): Promise<ContractNotificationData | null> {
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
  if (!contract) return null;

  let clientName = "-";
  let clientUid = "-";
  if (contract.subjectId) {
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, contract.subjectId)).limit(1);
    if (subject) {
      clientName = subject.type === "person"
        ? `${subject.firstName || ""} ${subject.lastName || ""}`.trim() || "-"
        : subject.companyName || "-";
      clientUid = subject.uid || "-";
    }
  }

  let partnerName = "-";
  if (contract.partnerId) {
    const { partners } = await import("@shared/schema");
    const [partner] = await db.select().from(partners).where(eq(partners.id, contract.partnerId)).limit(1);
    if (partner) partnerName = partner.name || "-";
  }

  return {
    contractId: contract.id,
    contractNumber: contract.contractNumber || contract.proposalNumber || `ID ${contract.id}`,
    clientName,
    clientUid,
    partnerName,
  };
}

function wrapEmailTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="sk">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1923;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
<div style="max-width:640px;margin:0 auto;padding:32px 24px;">
<div style="background:#1a2332;border:1px solid #2d3748;border-radius:4px;padding:32px;">
<div style="text-align:center;margin-bottom:24px;">
<h2 style="margin:0;color:#63b3ed;font-size:18px;letter-spacing:1px;">ArutsoK (ATK)</h2>
</div>
${content}
<hr style="border:none;border-top:1px solid #2d3748;margin:24px 0;">
<p style="font-size:11px;color:#718096;text-align:center;margin:0;">
Tento e-mail bol vygenerovaný automaticky systémom ArutsoK na základe Vašej role v procese životného cyklu zmluvy.
</p>
</div>
</div>
</body>
</html>`;
}

// ============================================================
// NOTIFICATION TYPE 1: Okamžitá výhrada (Objection Alert)
// ============================================================
export async function notifyObjectionCreated(contractId: number, objectionDaysLimit: number): Promise<void> {
  const data = await getContractNotificationData(contractId);
  if (!data) return;

  const recipients = await getContractRecipients(contractId);
  if (recipients.length === 0) {
    console.log(`[EMAIL] No recipients found for objection notification, contract ${contractId}`);
    return;
  }

  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + objectionDaysLimit);
  const formattedExpDate = expirationDate.toLocaleDateString("sk-SK");

  const emailSubject = "⚠️ UPOZORNENIE: Zmluva nebola prijatá na centrálu – VÝHRADA (ArutsoK ATK)";

  const content = `
<p style="color:#e2e8f0;font-size:14px;line-height:1.6;">Vážený kolega,</p>
<p style="color:#e2e8f0;font-size:14px;line-height:1.6;">
oznamujeme Vám, že pri fyzickej kontrole doručenej sprievodky v systéme ArutsoK (ATK) bola zaznamenaná výhrada pri nasledujúcom zázname:
</p>
<div style="background:#0f1923;border-left:3px solid #e53e3e;padding:16px;margin:16px 0;border-radius:2px;">
<p style="margin:4px 0;font-size:13px;"><strong style="color:#a0aec0;">Zmluva:</strong> <span style="color:#63b3ed;">${data.contractNumber}</span></p>
<p style="margin:4px 0;font-size:13px;"><strong style="color:#a0aec0;">Klient:</strong> <span style="color:#e2e8f0;">${data.clientName} (${data.clientUid})</span></p>
<p style="margin:4px 0;font-size:13px;"><strong style="color:#a0aec0;">Partner:</strong> <span style="color:#e2e8f0;">${data.partnerName}</span></p>
<p style="margin:4px 0;font-size:13px;"><strong style="color:#a0aec0;">Stav v ATK:</strong> <span style="color:#e53e3e;">Neprijaté zmluvy – výhrady</span></p>
</div>
<p style="color:#e2e8f0;font-size:14px;line-height:1.6;">
<strong>Dôvod:</strong> Zmluva nebola fyzicky prítomná v doručenej zásielke alebo vykazuje vážne nedostatky brániace prijatiu.
</p>
<div style="background:#742a2a;border:1px solid #e53e3e;padding:16px;margin:16px 0;border-radius:4px;">
<p style="color:#feb2b2;font-size:13px;line-height:1.6;margin:0;">
<strong>⚠️ Upozornenie:</strong><br>
Od tohto momentu začína plynúť <strong>${objectionDaysLimit}-dňová lehota</strong> na doručenie zmluvy na centrálu.
Ak zmluva nebude doručená a potvrdená do <strong>${formattedExpDate}</strong>, bude automaticky presunutá do archívu výhrad a následne skartovaná.
</p>
</div>
<p style="color:#e2e8f0;font-size:14px;line-height:1.6;">
Prosím, preverte stav fyzického dokumentu a zabezpečte jeho opätovné zaslanie.
</p>
<p style="color:#a0aec0;font-size:14px;margin-top:24px;">Váš ArutsoK (ATK)</p>`;

  const htmlBody = wrapEmailTemplate(content);
  const batchId = `objection-${contractId}-${Date.now()}`;

  for (const recipient of recipients) {
    await db.insert(systemNotifications).values({
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      recipientUserId: recipient.userId,
      subject: emailSubject,
      bodyHtml: htmlBody,
      status: "pending",
      notificationType: "objection_created",
      relatedContractId: contractId,
      batchId,
    });
  }

  console.log(`[EMAIL] Objection notification queued for ${recipients.length} recipients, contract ${data.contractNumber}`);

  await sendPendingEmails();
  await processPendingSmsNotifications();
}

// ============================================================
// NOTIFICATION TYPE 2: Skartácia (Pre-deletion warning)
// ============================================================
export async function notifyPreDeletion(contractsToDelete: { id: number; sectorProductId: number | null }[]): Promise<void> {
  if (contractsToDelete.length === 0) return;

  const recipientMap = new Map<string, {
    email: string;
    name: string;
    userId: number;
    contracts: ContractNotificationData[];
  }>();

  for (const contract of contractsToDelete) {
    const data = await getContractNotificationData(contract.id);
    if (!data) continue;

    const recipients = await getContractRecipients(contract.id);

    for (const recipient of recipients) {
      const key = recipient.email;
      if (!recipientMap.has(key)) {
        recipientMap.set(key, {
          email: recipient.email,
          name: recipient.name,
          userId: recipient.userId,
          contracts: [],
        });
      }
      recipientMap.get(key)!.contracts.push(data);
    }
  }

  if (recipientMap.size === 0) {
    console.log(`[EMAIL] No recipients found for pre-deletion notification`);
    return;
  }

  const batchId = `predeletion-${Date.now()}`;

  for (const [, recipientData] of Array.from(recipientMap)) {
    const contractRows = recipientData.contracts.map((c: ContractNotificationData) =>
      `<p style="margin:4px 0;font-size:13px;">
        <strong style="color:#63b3ed;">Zmluva:</strong> ${c.contractNumber} |
        <strong style="color:#a0aec0;">Klient:</strong> ${c.clientName} (${c.clientUid}) |
        <strong style="color:#a0aec0;">Partner:</strong> ${c.partnerName}
      </p>`
    ).join("");

    const emailSubject = "⚠️ OZNÁMENIE: Koniec archivačnej lehoty a výmaz zmlúv (ArutsoK ATK)";

    const content = `
<p style="color:#e2e8f0;font-size:14px;line-height:1.6;">Vážený kolega,</p>
<p style="color:#e2e8f0;font-size:14px;line-height:1.6;">
oznamujeme Vám, že nasledujúce zmluvy, na ktorých figurujete ako špecialista alebo odporúčateľ, budú <strong>dnes o 23:59 hod.</strong> nenávratne vymazané zo systému ArutsoK (ATK).
</p>
<p style="color:#e2e8f0;font-size:14px;line-height:1.6;">
<strong>Dôvod:</strong> Uplynutie limitu archivačnej lehoty v Archíve výhrad bez fyzického doručenia dokumentov na centrálu.
</p>
<div style="background:#0f1923;border-left:3px solid #dd6b20;padding:16px;margin:16px 0;border-radius:2px;">
<p style="margin:0 0 8px 0;font-size:12px;color:#a0aec0;text-transform:uppercase;letter-spacing:1px;">Zoznam zmlúv na výmaz:</p>
${contractRows}
</div>
<div style="background:#742a2a;border:1px solid #e53e3e;padding:16px;margin:16px 0;border-radius:4px;">
<p style="color:#feb2b2;font-size:13px;line-height:1.6;margin:0;">
<strong>⚠️ Dôležité upozornenie:</strong><br>
Po dnešnej polnoci už nebude možné tieto dáta obnoviť ani dohľadať v histórii. Ak je potrebné v týchto prípadoch pokračovať, je nutné zmluvy spracovať nanovo ako úplne nové záznamy.
</p>
</div>
<p style="color:#a0aec0;font-size:14px;margin-top:24px;">Váš ArutsoK (ATK)</p>`;

    const htmlBody = wrapEmailTemplate(content);

    for (const contractData of recipientData.contracts) {
      await db.insert(systemNotifications).values({
        recipientEmail: recipientData.email,
        recipientName: recipientData.name,
        recipientUserId: recipientData.userId,
        subject: emailSubject,
        bodyHtml: htmlBody,
        status: "pending",
        notificationType: "pre_deletion_warning",
        relatedContractId: contractData.contractId,
        batchId,
      });
    }
  }

  console.log(`[EMAIL] Pre-deletion notification queued for ${recipientMap.size} recipients, ${contractsToDelete.length} contracts`);

  await sendPendingEmails();
  await processPendingSmsNotifications();
}

export async function getProductDaysLimits(sectorProductId: number | null): Promise<{ objectionDays: number; archiveDays: number }> {
  if (!sectorProductId) return { objectionDays: 100, archiveDays: 365 };

  const [product] = await db.select({
    objectionDaysLimit: sectorProducts.objectionDaysLimit,
    archiveDaysBeforeDelete: sectorProducts.archiveDaysBeforeDelete,
  })
    .from(sectorProducts)
    .where(eq(sectorProducts.id, sectorProductId))
    .limit(1);

  return {
    objectionDays: product?.objectionDaysLimit ?? 100,
    archiveDays: product?.archiveDaysBeforeDelete ?? 365,
  };
}
