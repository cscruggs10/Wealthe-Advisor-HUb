import { Resend } from 'resend';

// Lazy initialization to avoid crashing on startup if API key is missing
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface LeadNotificationData {
  // Lead info
  userName: string;
  userEmail: string;
  message?: string;
  estimatedRevenue?: string;
  interestedInCaptives: boolean;
  hasStrategicCpa?: string;
  // Advisor info
  advisorName: string;
  advisorDesignation: string;
  advisorCity: string;
  advisorState: string;
  // Meta
  createdAt: Date;
}

/**
 * Send a professional lead notification email
 */
export async function sendLeadNotification(data: LeadNotificationData): Promise<{ success: boolean; error?: string }> {
  const notificationEmail = process.env.NOTIFICATION_EMAIL;

  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not configured, skipping notification');
    return { success: false, error: 'Email not configured' };
  }

  if (!notificationEmail) {
    console.warn('[Email] NOTIFICATION_EMAIL not configured, skipping notification');
    return { success: false, error: 'Notification email not configured' };
  }

  // Determine lead quality indicators
  const isHighValue = data.estimatedRevenue === '$5M+';
  const isHotLead = data.hasStrategicCpa === 'looking-to-replace' || data.interestedInCaptives;
  const leadScore = calculateLeadScore(data);

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); padding: 32px 24px; text-align: center;">
        <h1 style="color: #fbbf24; margin: 0; font-size: 24px; font-weight: 700;">
          🎯 New Lead Alert
        </h1>
        <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">
          The Alpha Directory
        </p>
      </td>
    </tr>

    <!-- Lead Score Badge -->
    <tr>
      <td style="padding: 24px 24px 0 24px; text-align: center;">
        <span style="display: inline-block; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; ${
          leadScore >= 80 ? 'background-color: #dcfce7; color: #166534;' :
          leadScore >= 50 ? 'background-color: #fef3c7; color: #92400e;' :
          'background-color: #f1f5f9; color: #475569;'
        }">
          ${leadScore >= 80 ? '🔥 Hot Lead' : leadScore >= 50 ? '⭐ Qualified Lead' : '📋 New Lead'} • Score: ${leadScore}/100
        </span>
      </td>
    </tr>

    <!-- Prospect Information -->
    <tr>
      <td style="padding: 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; padding: 20px;">
          <tr>
            <td>
              <h2 style="color: #1e3a5f; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
                Prospect Information
              </h2>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 13px;">Name</span><br>
                    <span style="color: #1e293b; font-size: 16px; font-weight: 600;">${data.userName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 13px;">Email</span><br>
                    <a href="mailto:${data.userEmail}" style="color: #2563eb; font-size: 16px; text-decoration: none;">${data.userEmail}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 13px;">Business Revenue</span><br>
                    <span style="color: #1e293b; font-size: 16px; font-weight: 600; ${isHighValue ? 'color: #16a34a;' : ''}">${data.estimatedRevenue || 'Not specified'}</span>
                    ${isHighValue ? ' <span style="color: #16a34a;">💰</span>' : ''}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 13px;">Working with Strategic CPA?</span><br>
                    <span style="color: #1e293b; font-size: 16px; font-weight: 600; ${data.hasStrategicCpa === 'looking-to-replace' ? 'color: #dc2626;' : ''}">${
                      data.hasStrategicCpa === 'yes' ? '✓ Yes' :
                      data.hasStrategicCpa === 'no' ? '✗ No' :
                      data.hasStrategicCpa === 'looking-to-replace' ? '🔄 Looking to Replace' :
                      'Not specified'
                    }</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; ${data.message ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
                    <span style="color: #64748b; font-size: 13px;">Interested in Captives/Reinsurance</span><br>
                    <span style="color: #1e293b; font-size: 16px; font-weight: 600;">${data.interestedInCaptives ? '✓ Yes' : '✗ No'}</span>
                  </td>
                </tr>
                ${data.message ? `
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #64748b; font-size: 13px;">Message</span><br>
                    <span style="color: #1e293b; font-size: 14px; line-height: 1.5;">"${data.message}"</span>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Advisor Information -->
    <tr>
      <td style="padding: 0 24px 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1e3a5f; border-radius: 12px; padding: 20px;">
          <tr>
            <td>
              <h2 style="color: #fbbf24; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
                Lead Submitted For
              </h2>
              <p style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">
                ${data.advisorName}
              </p>
              <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 14px;">
                ${data.advisorDesignation} • ${data.advisorCity}, ${data.advisorState}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 24px; background-color: #f1f5f9; text-align: center;">
        <p style="color: #64748b; margin: 0; font-size: 12px;">
          Lead submitted on ${data.createdAt.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          })}
        </p>
        <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 11px;">
          The Alpha Directory • Strategic CPA & Wealth Advisor Network
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    const client = getResendClient();
    if (!client) {
      console.warn('[Email] Resend client not available');
      return { success: false, error: 'Email service not configured' };
    }

    const { data: emailResult, error } = await client.emails.send({
      from: 'The Alpha Directory <notifications@resend.dev>',
      to: notificationEmail,
      subject: `${isHotLead ? '🔥 ' : ''}New Lead: ${data.userName} (${data.estimatedRevenue || 'Revenue N/A'})`,
      html: emailHtml,
    });

    if (error) {
      console.error('[Email] Failed to send notification:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Lead notification sent successfully: ${emailResult?.id}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending notification:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Calculate a lead quality score (0-100)
 */
function calculateLeadScore(data: LeadNotificationData): number {
  let score = 20; // Base score for any lead

  // Revenue scoring
  if (data.estimatedRevenue === '$5M+') score += 40;
  else if (data.estimatedRevenue === '$1M-5M') score += 25;
  else if (data.estimatedRevenue === '$0-1M') score += 10;

  // CPA status scoring
  if (data.hasStrategicCpa === 'looking-to-replace') score += 25;
  else if (data.hasStrategicCpa === 'no') score += 15;

  // Interest in captives
  if (data.interestedInCaptives) score += 15;

  // Message provided (engagement indicator)
  if (data.message && data.message.length > 20) score += 5;

  return Math.min(100, score);
}
