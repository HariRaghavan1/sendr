/**
 * Standardized Email Template Structure
 * This ensures all emails follow the same format for consistency
 */

export interface EmailTemplate {
  greeting: string;      // "Hi {first_name}," or "Dear {mr_ms} {last_name},"
  opening: string;       // Opening line (value/insight)
  body: string;          // Main content (2-3 sentences)
  cta: string;           // Call to action
  closing: string;        // "Best," "Regards," etc.
  signature: string;      // Sender name (will be replaced)
}

/**
 * Standardized email template structure
 * ALL emails must follow this exact format
 */
export const STANDARD_EMAIL_TEMPLATE = {
  structure: `
EMAIL STRUCTURE (MANDATORY - MUST FOLLOW EXACTLY):

1. GREETING (1 line):
   - Use: "Hi {first_name}," OR "Dear {mr_ms} {last_name}," based on tone
   - Casual tone: "Hi {first_name},"
   - Formal tone: "Dear {mr_ms} {last_name},"

2. OPENING LINE (1 sentence, 15-25 words):
   - Lead with value or insight about their role/company
   - Reference something specific from their profile/company
   - NEVER start with "I noticed" or "I came across"

3. BODY (2-3 sentences, 40-60 words total):
   - First sentence: Expand on the opening insight
   - Second sentence: Connect to potential value/benefit
   - Optional third sentence: Add credibility or context

4. CALL TO ACTION (1 sentence, 10-15 words):
   - Low-pressure ask
   - Clear and specific
   - Examples: "Would you be open to a quick 15-minute chat next week?" or "Could we schedule a brief call to explore this?"

5. CLOSING (1 line):
   - Use: "Best," OR "Regards," OR "Thanks," based on tone
   - Always followed by signature name

6. SIGNATURE (1 line):
   - Sender name (will be replaced automatically)
   - Use placeholder: {signature} (will be replaced)

EXAMPLE OUTPUT FORMAT:
{
  "subject": "Quick question about {company}'s approach",
  "body": "Hi {first_name},\n\n{opening_sentence}\n\n{body_sentences}\n\n{cta_sentence}\n\nBest,\n{signature}"
}
`,

  /**
   * Validate and enforce template structure
   */
  validateStructure(emailBody: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const lines = emailBody.split('\n').filter(l => l.trim());

    // Check for greeting
    if (!emailBody.match(/^(Hi|Dear|Hello)/i)) {
      errors.push('Missing greeting (Hi/Dear/Hello)');
    }

    // Check for closing
    if (!emailBody.match(/(Best|Regards|Thanks|Thank you|Sincerely)[,\s]*$/i)) {
      errors.push('Missing closing (Best/Regards/Thanks)');
    }

    // Check word count (should be 80-120 words)
    const wordCount = emailBody.split(/\s+/).length;
    if (wordCount < 60) {
      errors.push(`Email too short (${wordCount} words, minimum 60)`);
    }
    if (wordCount > 150) {
      errors.push(`Email too long (${wordCount} words, maximum 150)`);
    }

    // Check for CTA indicators
    const ctaIndicators = /(chat|call|meeting|schedule|explore|discuss|connect)/i;
    if (!ctaIndicators.test(emailBody)) {
      errors.push('Missing clear call to action');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Format email body according to standard template
   * Ensures consistent structure
   */
  formatEmail(
    greeting: string,
    opening: string,
    body: string,
    cta: string,
    closing: string = 'Best',
    signature: string = '{signature}'
  ): string {
    // Clean up and format
    const cleanGreeting = greeting.trim();
    const cleanOpening = opening.trim();
    const cleanBody = body.trim();
    const cleanCta = cta.trim();
    const cleanClosing = closing.trim();

    // Ensure greeting ends with comma
    const formattedGreeting = cleanGreeting.endsWith(',') 
      ? cleanGreeting 
      : cleanGreeting + ',';

    // Ensure closing ends with comma
    const formattedClosing = cleanClosing.endsWith(',')
      ? cleanClosing
      : cleanClosing + ',';

    // Build email following exact template structure
    return `${formattedGreeting}

${cleanOpening}

${cleanBody}

${cleanCta}

${formattedClosing}
${signature}`;
  },

  /**
   * Extract components from email body (for validation)
   */
  parseEmailBody(emailBody: string): Partial<EmailTemplate> {
    const lines = emailBody.split('\n').filter(l => l.trim());
    
    return {
      greeting: lines[0] || '',
      opening: lines[1] || '',
      body: lines.slice(2, -3).join('\n'),
      cta: lines[lines.length - 3] || '',
      closing: lines[lines.length - 2] || '',
      signature: lines[lines.length - 1] || ''
    };
  }
};

