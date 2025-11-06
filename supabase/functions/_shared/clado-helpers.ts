// Clado API integration helpers

export function buildCladoQuery(targetCriteria: any): string {
  const parts: string[] = [];
  
  if (targetCriteria.job_titles?.length) {
    parts.push(targetCriteria.job_titles.join(' or '));
  }
  
  if (targetCriteria.companies?.length) {
    parts.push(`at ${targetCriteria.companies.join(' or ')}`);
  }
  
  if (targetCriteria.location) {
    parts.push(`in ${targetCriteria.location}`);
  }
  
  if (targetCriteria.industry) {
    parts.push(`in ${targetCriteria.industry} industry`);
  }
  
  return parts.join(' ') || 'professionals';
}

export async function enrichProspectEmail(
  linkedinUrl: string, 
  cladoApiKey: string
): Promise<string | null> {
  try {
    const url = `https://search.clado.ai/api/enrich/contacts?linkedin_url=${encodeURIComponent(linkedinUrl)}&email_enrichment=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${cladoApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`Email enrichment failed for ${linkedinUrl}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data.data?.work_email || data.data?.personal_email || null;
  } catch (error) {
    console.error('Email enrichment error:', error);
    return null;
  }
}

export interface CladoProspect {
  name: string;
  email: string;
  title: string;
  company: string;
  linkedin_url: string;
}

export async function searchCladoProspects(
  targetCriteria: any,
  cladoApiKey: string,
  limit: number = 100
): Promise<CladoProspect[]> {
  const query = buildCladoQuery(targetCriteria);
  const url = `https://search.clado.ai/api/search?query=${encodeURIComponent(query)}&limit=${limit}&advanced_filtering=true`;
  
  console.log('Clado search query:', query);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 
      'Authorization': `Bearer ${cladoApiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Clado API error (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  
  // Parse new Clado API response format
  return (data.results || []).map((result: any) => ({
    name: result.profile?.name || 'Unknown',
    email: '', // Will be enriched separately if needed
    title: result.experience?.[0]?.title || '',
    company: result.experience?.[0]?.company_name || '',
    linkedin_url: result.profile?.linkedin_url || '',
  }));
}
