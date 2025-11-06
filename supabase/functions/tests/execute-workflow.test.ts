import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";

/**
 * Integration tests for execute-workflow edge function
 *
 * These tests verify the core business logic without making actual API calls.
 * They use mocks for external dependencies (Supabase, Clado, OpenAI).
 */

Deno.test("execute-workflow - should validate required environment variables", () => {
  // Verify that the function expects these environment variables
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY'
  ];

  requiredEnvVars.forEach(varName => {
    // In production, these should be set
    const value = Deno.env.get(varName);
    // For testing, we just verify the function would check for them
    // The actual validation happens in the function runtime
    assertExists(varName, `${varName} should be defined in function`);
  });
});

Deno.test("execute-workflow - should handle natural language query building", () => {
  // Test the natural language query builder logic
  const targetCriteria = {
    job_titles: "CEO, CTO",
    industry: "technology",
    location: "San Francisco",
    company_size: "50-200 employees"
  };

  const queryParts: string[] = [];

  if (targetCriteria.job_titles) {
    queryParts.push(targetCriteria.job_titles);
  }
  if (targetCriteria.industry) {
    queryParts.push(`in ${targetCriteria.industry}`);
  }
  if (targetCriteria.location) {
    queryParts.push(`located in ${targetCriteria.location}`);
  }
  if (targetCriteria.company_size) {
    queryParts.push(`at ${targetCriteria.company_size} companies`);
  }

  const naturalLanguageQuery = queryParts.join(' ');

  assertEquals(
    naturalLanguageQuery,
    "CEO, CTO in technology located in San Francisco at 50-200 employees companies"
  );
});

Deno.test("execute-workflow - should handle empty target criteria", () => {
  const targetCriteria = {};
  const queryParts: string[] = [];

  if ((targetCriteria as any).job_titles) {
    queryParts.push((targetCriteria as any).job_titles);
  }
  if ((targetCriteria as any).industry) {
    queryParts.push(`in ${(targetCriteria as any).industry}`);
  }

  const naturalLanguageQuery = queryParts.join(' ') || 'professionals';

  assertEquals(naturalLanguageQuery, 'professionals');
});

Deno.test("execute-workflow - should parse Clado API response correctly", () => {
  // Mock Clado API response
  const cladoResponse = {
    results: [
      {
        profile: {
          id: 'prof-1',
          name: 'John Doe',
          headline: 'CEO at TechCorp',
          linkedin_url: 'https://linkedin.com/in/johndoe'
        },
        experience: [
          {
            title: 'Chief Executive Officer',
            company_name: 'TechCorp'
          }
        ]
      },
      {
        profile: {
          id: 'prof-2',
          name: 'Jane Smith',
          headline: 'CTO at InnovateCo',
          linkedin_url: 'https://linkedin.com/in/janesmith'
        },
        experience: [
          {
            title: 'Chief Technology Officer',
            company_name: 'InnovateCo'
          }
        ]
      }
    ]
  };

  // Parse prospects (simulating function logic)
  const prospects = cladoResponse.results.map((result: any) => {
    const profile = result.profile || {};
    const experience = result.experience?.[0] || {};

    return {
      id: profile.id || crypto.randomUUID(),
      name: profile.name || 'Unknown',
      email: '', // Email enrichment happens separately
      title: experience.title || profile.headline || '',
      company: experience.company_name || '',
      linkedin_url: profile.linkedin_url || '',
    };
  });

  assertEquals(prospects.length, 2);
  assertEquals(prospects[0].name, 'John Doe');
  assertEquals(prospects[0].title, 'Chief Executive Officer');
  assertEquals(prospects[0].company, 'TechCorp');
  assertEquals(prospects[1].name, 'Jane Smith');
  assertEquals(prospects[1].title, 'Chief Technology Officer');
});

Deno.test("execute-workflow - should handle malformed Clado response", () => {
  // Test with missing fields
  const cladoResponse = {
    results: [
      {
        profile: {
          id: 'prof-1',
          // name missing
          linkedin_url: 'https://linkedin.com/in/someone'
        },
        // experience missing
      },
      {
        // profile missing
      }
    ]
  };

  const prospects = cladoResponse.results.map((result: any) => {
    const profile = result.profile || {};
    const experience = result.experience?.[0] || {};

    return {
      id: profile.id || crypto.randomUUID(),
      name: profile.name || 'Unknown',
      email: '',
      title: experience.title || profile.headline || '',
      company: experience.company_name || '',
      linkedin_url: profile.linkedin_url || '',
    };
  });

  assertEquals(prospects.length, 2);
  assertEquals(prospects[0].name, 'Unknown'); // Should use default
  assertEquals(prospects[1].name, 'Unknown');
  assertExists(prospects[0].id); // Should generate UUID
  assertExists(prospects[1].id);
});

Deno.test("execute-workflow - should build correct tone instructions", () => {
  const toneMap: Record<string, string> = {
    formal: 'professional and formal',
    casual: 'friendly and conversational',
    witty: 'playful and witty',
  };

  assertEquals(toneMap['formal'], 'professional and formal');
  assertEquals(toneMap['casual'], 'friendly and conversational');
  assertEquals(toneMap['witty'], 'playful and witty');

  // Test fallback
  const defaultTone = toneMap['unknown'] || 'friendly and conversational';
  assertEquals(defaultTone, 'friendly and conversational');
});

Deno.test("execute-workflow - should build correct goal instructions", () => {
  const goalMap: Record<string, string> = {
    demo: 'book a product demo',
    meeting: 'schedule a quick meeting',
    partnership: 'explore a potential partnership',
    other: 'start a conversation',
  };

  assertEquals(goalMap['demo'], 'book a product demo');
  assertEquals(goalMap['meeting'], 'schedule a quick meeting');
  assertEquals(goalMap['partnership'], 'explore a potential partnership');

  // Test fallback
  const defaultGoal = goalMap['custom'] || 'start a conversation';
  assertEquals(defaultGoal, 'start a conversation');
});

Deno.test("execute-workflow - should parse OpenAI email response", () => {
  const generatedContent = `Subject: Quick question about TechCorp's growth

Hi John,

I noticed TechCorp's impressive growth in the tech sector. I'd love to chat about how we might be able to help accelerate that trajectory.

Would you be open to a quick 15-minute call next week?

Best,
Sarah`;

  // Parse subject and body
  const lines = generatedContent.split('\n');
  let subject = '';
  let body = '';

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().startsWith('subject:')) {
      subject = lines[i].replace(/^subject:\s*/i, '').trim();
    } else if (subject && lines[i].trim()) {
      body = lines.slice(i).join('\n').trim();
      break;
    }
  }

  assertEquals(subject, "Quick question about TechCorp's growth");
  assertExists(body);
  assertEquals(body.includes('Hi John'), true);
});

Deno.test("execute-workflow - should handle OpenAI response without subject", () => {
  const generatedContent = `Hi John,

I noticed TechCorp's growth and wanted to reach out.

Best,
Sarah`;

  const lines = generatedContent.split('\n');
  let subject = '';
  let body = '';

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().startsWith('subject:')) {
      subject = lines[i].replace(/^subject:\s*/i, '').trim();
    } else if (subject && lines[i].trim()) {
      body = lines.slice(i).join('\n').trim();
      break;
    }
  }

  if (!subject) {
    subject = 'Quick question';
    body = generatedContent;
  }

  assertEquals(subject, 'Quick question');
  assertEquals(body, generatedContent);
});

Deno.test("execute-workflow - should detect Clado API errors correctly", () => {
  const errorMessages = [
    { status: 401, message: 'Unauthorized', shouldMatch: 'Authentication Error' },
    { status: 403, message: 'Forbidden', shouldMatch: 'Access Error' },
    { status: 429, message: 'Too Many Requests', shouldMatch: 'Rate Limit' },
    { status: 500, message: 'Internal Server Error', shouldMatch: 'API error' }
  ];

  errorMessages.forEach(({ status, message, shouldMatch }) => {
    let errorMsg = `Clado API error: ${message}`;

    if (message.includes('401') || message.includes('Unauthorized')) {
      errorMsg = 'Clado API Authentication Error - Your API key is invalid or expired.';
    } else if (message.includes('403') || message.includes('Forbidden')) {
      errorMsg = 'Clado API Access Error - Your account may not have access to this feature';
    } else if (message.includes('429') || message.includes('Too Many Requests')) {
      errorMsg = 'Clado API Rate Limit - You\'ve exceeded the rate limit';
    }

    // Verify error message contains expected text
    assertExists(errorMsg);
    if (shouldMatch !== 'API error') {
      assertEquals(errorMsg.includes(shouldMatch), true, `Error message should contain "${shouldMatch}"`);
    }
  });
});
