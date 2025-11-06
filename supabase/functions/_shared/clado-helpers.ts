// Clado API integration helpers

/**
 * Check remaining credits for Clado API key
 */
export async function checkCladoCredits(cladoApiKey: string): Promise<{ credits: number; last_topup_at?: string | null } | null> {
  try {
    const response = await fetch('https://search.clado.ai/api/credits', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cladoApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Clado credits check failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      credits: data.credits || 0,
      last_topup_at: data.last_topup_at || null
    };
  } catch (error) {
    console.error('Error checking Clado credits:', error);
    return null;
  }
}

export function buildCladoQuery(targetCriteria: any): string {
  const parts: string[] = [];

  // Match original's simple logic exactly
  if (targetCriteria.job_titles) {
    const titles = Array.isArray(targetCriteria.job_titles)
      ? targetCriteria.job_titles.join(' or ')
      : targetCriteria.job_titles;
    if (titles && titles.trim()) {
      parts.push(titles);
    }
  }
  
  if (targetCriteria.industry) {
    parts.push(`in ${targetCriteria.industry}`);
  }
  
  if (targetCriteria.location) {
    parts.push(`located in ${targetCriteria.location}`);
  }
  
  if (targetCriteria.company_size) {
    parts.push(`at ${targetCriteria.company_size} companies`);
  }

  const query = parts.join(' ') || 'professionals';
  console.log('Built Clado query:', query, 'from criteria:', JSON.stringify(targetCriteria));
  return query;
}

/**
 * Initiate deep research for a prospect
 * Returns job_id for tracking (async operation)
 */
export async function initiateDeepResearch(
  query: string,
  cladoApiKey: string,
  limit: number = 30
): Promise<{ job_id: string; status: string; message: string } | null> {
  try {
    const response = await fetch('https://search.clado.ai/api/search/deep_research', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${cladoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        limit
      })
    });
    
    if (!response.ok) {
      console.log(`Deep research initiation failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Deep research initiation error:', error);
    return null;
  }
}

/**
 * Enrich prospect with contact information (email and phone)
 * Returns contact info including email and phone if available
 * IMPROVED: Includes retry logic and accepts ANY email (not just work emails) if no work email found
 */
export async function enrichProspectContacts(
  linkedinUrl: string, 
  cladoApiKey: string,
  options: { 
    email_enrichment?: boolean; 
    phone_enrichment?: boolean;
    maxRetries?: number;
    retryDelay?: number;
  } = {}
): Promise<{ email: string | null; phone: string | null }> {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 1000; // 1 second default
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const params = new URLSearchParams();
      
      if (linkedinUrl) {
        params.append('linkedin_url', linkedinUrl);
      }
      
      // Always enable email enrichment (required by user)
      // Phone enrichment is optional but enabled by default
      params.append('email_enrichment', 'true'); // Always true - we need emails
      params.append('phone_enrichment', (options.phone_enrichment !== false).toString());
      
      const url = `https://search.clado.ai/api/enrich/contacts?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${cladoApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Retry on 429 (rate limit) or 500-level errors
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          const waitTime = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`Contact enrichment failed (${response.status}) for ${linkedinUrl}, retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        console.log(`Contact enrichment failed for ${linkedinUrl}: ${response.status} (final attempt)`);
        return { email: null, phone: null };
      }
      
      const data = await response.json();
      
      // Parse contact info from response
      let email: string | null = null;
      let phone: string | null = null;
      let allEmails: any[] = []; // Collect ALL emails as fallback
      
      console.log(`Contact enrichment response for ${linkedinUrl}:`, JSON.stringify(data, null, 2).substring(0, 1000));
      
      // Parse response according to Clado API documentation
      // Response format: { data: [{ error: false, contacts: [{ type: 'email', value: '...', rating: 100 }] }] }
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const contactInfo = data.data[0];
        
        // Check for error field
        if (contactInfo.error === true) {
          console.log(`Contact enrichment returned error for ${linkedinUrl}`);
          // Don't return yet - might retry
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            continue;
          }
          return { email: null, phone: null };
        }
        
        // Parse contacts array according to API docs
        if (contactInfo.contacts && Array.isArray(contactInfo.contacts)) {
          console.log(`Found ${contactInfo.contacts.length} contacts in response`);
          
          // Find the best email (highest rating) - prioritize work emails
          let bestEmail: any = null;
          let bestPhone: any = null;
          
          for (const contact of contactInfo.contacts) {
            if (contact.type === 'email' && contact.value && contact.value.trim()) {
              // Collect ALL emails as fallback
              allEmails.push(contact);
              
              // Prefer work emails, then higher rating
              const isWorkEmail = contact.subType === 'work' || contact.subType === 'verified';
              const currentIsWork = bestEmail?.subType === 'work' || bestEmail?.subType === 'verified';
              
              if (!bestEmail) {
                bestEmail = contact;
              } else if (isWorkEmail && !currentIsWork) {
                bestEmail = contact; // Work email takes priority
              } else if (isWorkEmail === currentIsWork && (contact.rating || 0) > (bestEmail.rating || 0)) {
                bestEmail = contact; // Higher rating if same type
              }
            } else if (contact.type === 'phone' && contact.value && contact.value.trim()) {
              // Prefer mobile phones, then higher rating
              const isMobile = contact.subType === 'mobile';
              const currentIsMobile = bestPhone?.subType === 'mobile';
              
              if (!bestPhone) {
                bestPhone = contact;
              } else if (isMobile && !currentIsMobile) {
                bestPhone = contact; // Mobile takes priority
              } else if (isMobile === currentIsMobile && (contact.rating || 0) > (bestPhone.rating || 0)) {
                bestPhone = contact; // Higher rating if same type
              }
            }
          }
          
          // Use best email, or fallback to ANY email if no work email found
          if (bestEmail) {
            email = bestEmail.value.trim();
            console.log(`✅ Found email with rating ${bestEmail.rating || 'N/A'} (${bestEmail.subType || 'unknown'}): ${email}`);
          } else if (allEmails.length > 0) {
            // Fallback: use the highest-rated email (even if personal)
            const highestRatedEmail = allEmails.reduce((best, current) => 
              (current.rating || 0) > (best.rating || 0) ? current : best
            );
            email = highestRatedEmail.value.trim();
            console.log(`✅ Found fallback email with rating ${highestRatedEmail.rating || 'N/A'} (${highestRatedEmail.subType || 'unknown'}): ${email}`);
          } else {
            console.log(`⚠️ No email found in contacts array for ${linkedinUrl}`);
          }
          
          if (bestPhone) {
            phone = bestPhone.value.trim();
            console.log(`✅ Found phone with rating ${bestPhone.rating || 'N/A'} (${bestPhone.subType || 'unknown'}): ${phone}`);
          }
        } else {
          console.log(`⚠️ No contacts array in response for ${linkedinUrl}`);
        }
      } else {
        console.log(`⚠️ No data array in response for ${linkedinUrl}`);
        console.log(`Full response structure:`, Object.keys(data));
      }
      
      // If we found an email, return it (success!)
      if (email) {
        return { email, phone };
      }
      
      // If no email found and we have retries left, try again
      if (attempt < maxRetries) {
        console.log(`No email found for ${linkedinUrl}, retrying (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        continue;
      }
      
      // Final attempt failed
      return { email: null, phone };
      
    } catch (error) {
      console.error(`Contact enrichment error (attempt ${attempt}/${maxRetries}):`, error);
      
      // Retry on network errors
      if (attempt < maxRetries) {
        const waitTime = retryDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Final attempt failed
      return { email: null, phone: null };
    }
  }
  
  // Should never reach here, but TypeScript needs it
  return { email: null, phone: null };
}

/**
 * Get LinkedIn profile data from Clado database (fast, 1 credit)
 * Use this for previously scraped profiles
 */
export async function enrichLinkedinProfile(
  linkedinUrl: string,
  cladoApiKey: string
): Promise<CladoProfileData | null> {
  try {
    const url = `https://search.clado.ai/api/enrich/linkedin?linkedin_url=${encodeURIComponent(linkedinUrl)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${cladoApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`LinkedIn profile enrichment (DB) failed for ${linkedinUrl}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ Enriched LinkedIn profile (DB) for ${linkedinUrl}`);
    return data;
  } catch (error) {
    console.error('LinkedIn profile enrichment (DB) error:', error);
    return null;
  }
}

/**
 * Scrape LinkedIn profile in real-time (slower, 2 credits, most current data)
 * Use this when you need the most up-to-date information
 */
export async function enrichLinkedinScrape(
  linkedinUrl: string,
  cladoApiKey: string
): Promise<CladoProfileData | null> {
  try {
    const url = `https://search.clado.ai/api/enrich/scrape?linkedin_url=${encodeURIComponent(linkedinUrl)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${cladoApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`LinkedIn profile scraping failed for ${linkedinUrl}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ Scraped LinkedIn profile (real-time) for ${linkedinUrl}`);
    return data;
  } catch (error) {
    console.error('LinkedIn profile scraping error:', error);
    return null;
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function enrichProspectEmail(
  linkedinUrl: string, 
  cladoApiKey: string
): Promise<string | null> {
  const { email } = await enrichProspectContacts(linkedinUrl, cladoApiKey, { 
    email_enrichment: true, 
    phone_enrichment: false 
  });
  return email;
}

export interface CladoProfileData {
  profile?: {
    name?: string;
    headline?: string;
    summary?: string;
    location?: string;
    skills?: string[];
    languages?: string[];
    posts?: string;
    recommendations?: string;
  };
  experience?: Array<{
    title?: string;
    company_name?: string;
    location?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
  }>;
  education?: Array<{
    school_name?: string;
    degree?: string;
    field_of_study?: string;
    start_date?: string;
    end_date?: string;
  }>;
  certifications?: Array<{
    name?: string;
    issuing_organization?: string;
    issue_date?: string;
  }>;
}

export interface CladoProspect {
  name: string;
  email: string;
  phone?: string;
  title: string;
  company: string;
  linkedin_url: string;
  deep_research_job_id?: string;
  // Enriched profile data for personalization
  profile_data?: CladoProfileData;
}

/**
 * Search for prospects using Clado API
 * Optionally initiates deep research, enriches contacts, and enriches profiles
 */
export async function searchCladoProspects(
  targetCriteria: any,
  cladoApiKey: string,
  options: {
    limit?: number;
    advanced_filtering?: boolean;
    companies?: string[];
    schools?: string[];
    initiateDeepResearch?: boolean;
    enrichContacts?: boolean;
    enrichProfiles?: boolean;  // New: enrich profile data for personalization
    useScrapeForProfiles?: boolean;  // New: use real-time scraping (2 credits) vs DB (1 credit)
  } = {}
): Promise<CladoProspect[]> {
  const query = buildCladoQuery(targetCriteria);
  const url = new URL('https://search.clado.ai/api/search');
  
  url.searchParams.append('query', query);
  url.searchParams.append('limit', (options.limit || 100).toString());
  url.searchParams.append('advanced_filtering', (options.advanced_filtering !== false).toString());
  
  if (options.companies?.length) {
    options.companies.forEach(company => {
      url.searchParams.append('companies', company);
    });
  }
  
  if (options.schools?.length) {
    options.schools.forEach(school => {
      url.searchParams.append('schools', school);
    });
  }
  
  console.log('Clado search query:', query);
  
  // Retry logic for search API calls (handle transient failures)
  const maxSearchRetries = 3;
  const searchRetryDelay = 2000; // 2 seconds base delay
  
  let lastError: Error | null = null;
  let response: Response | null = null;
  let data: any = null;
  
  for (let attempt = 1; attempt <= maxSearchRetries; attempt++) {
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${cladoApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Retry on 429 (rate limit) or 500-level errors
      if (!response.ok) {
        const status = response.status;
        const errorText = await response.text();
        
        // Retry on transient errors
        if ((status === 429 || status >= 500) && attempt < maxSearchRetries) {
          const waitTime = searchRetryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`Clado search failed (${status}), retrying in ${waitTime}ms (attempt ${attempt}/${maxSearchRetries})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          lastError = new Error(`Clado API error (${status}): ${errorText}`);
          continue;
        }
        
        // Don't retry on permanent errors (401, 402, 404)
        console.error(`Clado API error (${status}):`, errorText);
        throw new Error(`Clado API error (${status}): ${errorText}`);
      }
      
      // Success - parse response
      data = await response.json();
      break; // Exit retry loop on success
      
    } catch (error: any) {
      lastError = error;
      
      // Retry on network errors or transient failures
      if (attempt < maxSearchRetries && (error.message?.includes('fetch') || error.message?.includes('network'))) {
        const waitTime = searchRetryDelay * Math.pow(2, attempt - 1);
        console.log(`Clado search network error, retrying in ${waitTime}ms (attempt ${attempt}/${maxSearchRetries})...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Final attempt failed or non-retryable error
      throw error;
    }
  }
  
  // If we exhausted retries without success
  if (!data) {
    throw lastError || new Error('Clado search failed after all retries');
  }
  
  console.log(`Clado API response:`, {
    has_results: !!data.results,
    results_count: data.results?.length || 0,
    data_keys: Object.keys(data)
  });
  
  // Parse Clado API response format - extract ALL available data
  const prospects: CladoProspect[] = (data.results || []).map((result: any) => {
    // Extract name - try multiple sources
    const name = result.profile?.name || 
                 result.name || 
                 (result.profile?.headline ? result.profile.headline.split(' at ')[0] : null) ||
                 'Unknown';
    
    // Extract title - try multiple sources
    const title = result.experience?.[0]?.title || 
                  result.profile?.headline?.split(' at ')[0] ||
                  result.title ||
                  '';
    
    // Extract company - try multiple sources
    const company = result.experience?.[0]?.company_name || 
                   result.profile?.headline?.split(' at ')[1]?.split(' | ')[0] ||
                   result.company ||
                   '';
    
    // Extract LinkedIn URL
    const linkedin_url = result.profile?.linkedin_url || 
                        result.linkedin_url ||
                        '';
    
    return {
      name: name.trim() || 'Unknown',
      email: '', // Will be filled during enrichment
      phone: undefined, // Will be filled during enrichment
      title: title.trim(),
      company: company.trim(),
      linkedin_url: linkedin_url.trim(),
    };
  });
  
  // Run deep research and contact enrichment in PARALLEL for better performance
  const parallelPromises: Promise<any>[] = [];
  
  // Initiate deep research if requested (runs in parallel with enrichment)
  if (options.initiateDeepResearch && query) {
    console.log('Initiating deep research for prospects (in parallel with contact enrichment)...');
    parallelPromises.push(
      initiateDeepResearch(query, cladoApiKey, prospects.length).then((deepResearchJob) => {
        if (deepResearchJob) {
          console.log(`Deep research job initiated: ${deepResearchJob.job_id}`);
          // Store job_id in prospects metadata (optional)
          prospects.forEach(p => {
            p.deep_research_job_id = deepResearchJob.job_id;
          });
        }
        return deepResearchJob;
      })
    );
  }
  
  // Enrich contacts if requested (runs in parallel with deep research)
  if (options.enrichContacts) {
    console.log(`Enriching contacts for ${prospects.length} prospects (in parallel with deep research)...`);
    const enrichmentPromises = prospects.map(async (prospect, index) => {
      if (prospect.linkedin_url) {
        try {
          console.log(`[${index + 1}/${prospects.length}] Enriching contacts for ${prospect.name} (${prospect.linkedin_url})...`);
          // Always request email enrichment (required) and phone enrichment (optional)
          // Use retry logic with 3 attempts
          const contacts = await enrichProspectContacts(prospect.linkedin_url, cladoApiKey, {
            email_enrichment: true, // Always true - we need emails
            phone_enrichment: true, // Also get phone numbers
            maxRetries: 3, // Retry up to 3 times
            retryDelay: 1000 // 1 second base delay
          });
          
          // Only set email if we found one (don't set empty string)
          if (contacts.email && contacts.email.trim()) {
            prospect.email = contacts.email.trim();
            console.log(`✅ Found email for ${prospect.name}: ${prospect.email}`);
          } else {
            console.log(`⚠️ No email found for ${prospect.name} after retries`);
            prospect.email = ''; // Keep empty string for filtering later
          }
          
          if (contacts.phone && contacts.phone.trim()) {
            prospect.phone = contacts.phone.trim();
          }
        } catch (error) {
          console.error(`Error enriching contacts for ${prospect.name}:`, error);
          prospect.email = ''; // Ensure empty string on error
        }
      } else {
        console.log(`⚠️ No LinkedIn URL for ${prospect.name}, skipping enrichment`);
        prospect.email = ''; // No LinkedIn URL means no email
      }
      return prospect;
    });
    
    parallelPromises.push(
      Promise.allSettled(enrichmentPromises).then((results) => {
        const enrichedCount = results.filter(r => r.status === 'fulfilled').length;
        const emailCount = prospects.filter(p => p.email && p.email.trim() !== '').length;
        console.log(`Contact enrichment complete: ${enrichedCount}/${prospects.length} processed, ${emailCount} with emails`);
        return { enrichedCount, emailCount };
      })
    );
  }

  // Enrich profiles if requested (runs in parallel with other operations)
  // Also use profile data to fill missing fields (title, company, etc.)
  if (options.enrichProfiles) {
    console.log(`Enriching profiles for ${prospects.length} prospects (in parallel with other operations)...`);
    const profileEnrichmentPromises = prospects.map(async (prospect, index) => {
      if (prospect.linkedin_url) {
        try {
          console.log(`[${index + 1}/${prospects.length}] Enriching profile for ${prospect.name} (${prospect.linkedin_url})...`);
          
          // Use scraping for real-time data if requested, otherwise use DB lookup (faster, cheaper)
          const profileData = options.useScrapeForProfiles
            ? await enrichLinkedinScrape(prospect.linkedin_url, cladoApiKey)
            : await enrichLinkedinProfile(prospect.linkedin_url, cladoApiKey);
          
          if (profileData) {
            prospect.profile_data = profileData;
            
            // Fill missing fields from profile data
            // Fill title if missing
            if (!prospect.title || prospect.title.trim() === '') {
              prospect.title = profileData.profile?.headline?.split(' at ')[0] ||
                              profileData.experience?.[0]?.title ||
                              '';
            }
            
            // Fill company if missing
            if (!prospect.company || prospect.company.trim() === '') {
              prospect.company = profileData.experience?.[0]?.company_name ||
                                profileData.profile?.headline?.split(' at ')[1]?.split(' | ')[0] ||
                                '';
            }
            
            // Fill name if still Unknown
            if (prospect.name === 'Unknown' && profileData.profile?.name) {
              prospect.name = profileData.profile.name;
            }
            
            console.log(`✅ Enriched profile for ${prospect.name} (filled missing fields)`);
          } else {
            console.log(`⚠️ No profile data found for ${prospect.name}`);
          }
        } catch (error) {
          console.error(`Error enriching profile for ${prospect.name}:`, error);
        }
      } else {
        console.log(`⚠️ No LinkedIn URL for ${prospect.name}, skipping profile enrichment`);
      }
      return prospect;
    });
    
    parallelPromises.push(
      Promise.allSettled(profileEnrichmentPromises).then((results) => {
        const enrichedCount = results.filter(r => r.status === 'fulfilled' && r.value?.profile_data).length;
        console.log(`Profile enrichment complete: ${enrichedCount}/${prospects.length} prospects have enriched profile data`);
        return { enrichedCount };
      })
    );
  }
  
  // Final pass: ensure no empty strings where we have data, filter prospects without emails
  // Note: We'll filter after all parallel operations complete
  
  // Wait for all parallel operations to complete
  if (parallelPromises.length > 0) {
    const operationTypes = [];
    if (options.initiateDeepResearch) operationTypes.push('deep research');
    if (options.enrichContacts) operationTypes.push('contact enrichment');
    if (options.enrichProfiles) operationTypes.push('profile enrichment');
    console.log(`Running ${parallelPromises.length} parallel operations (${operationTypes.join(' + ')})...`);
    await Promise.allSettled(parallelPromises);
    console.log('All parallel operations completed');
  }
  
  // Final cleanup: ensure no empty strings where we have alternatives, and clean up data
  const cleanedProspects = prospects.map(prospect => {
    // Ensure name is never empty
    if (!prospect.name || prospect.name.trim() === '' || prospect.name === 'Unknown') {
      // Try to extract from LinkedIn URL
      const linkedinMatch = prospect.linkedin_url.match(/linkedin\.com\/in\/([^\/\?]+)/);
      if (linkedinMatch) {
        const linkedinSlug = linkedinMatch[1];
        // Convert slug to readable name (e.g., "john-doe" -> "John Doe")
        prospect.name = linkedinSlug.split('-').map((word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      } else {
        prospect.name = 'Unknown';
      }
    }
    
    // Ensure title has a fallback
    if (!prospect.title || prospect.title.trim() === '') {
      prospect.title = 'Professional'; // Better than empty string
    }
    
    // Ensure company has a fallback
    if (!prospect.company || prospect.company.trim() === '') {
      prospect.company = 'their organization'; // Better than empty string
    }
    
    return prospect;
  });
  
  // Filter out prospects without emails if enrichContacts was enabled
  // Only filter if we actually tried to enrich (otherwise keep all)
  if (options.enrichContacts) {
    const prospectsWithEmails = cleanedProspects.filter(p => p.email && p.email.trim() !== '');
    const filteredCount = cleanedProspects.length - prospectsWithEmails.length;
    
    if (filteredCount > 0) {
      console.log(`⚠️ Filtered out ${filteredCount} prospects without email addresses`);
    }
    
    return prospectsWithEmails;
  }
  
  return cleanedProspects;
}
