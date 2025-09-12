// Utility functions for timezone handling

export function formatTimezone(timezone: string): string {
  const timezoneMap: Record<string, string> = {
    // Australia & New Zealand
    'Australia/Sydney': 'Sydney (AEDT/AEST)',
    'Australia/Melbourne': 'Melbourne (AEDT/AEST)',
    'Australia/Brisbane': 'Brisbane (AEST)',
    'Australia/Perth': 'Perth (AWST)',
    'Australia/Adelaide': 'Adelaide (ACDT/ACST)',
    'Australia/Darwin': 'Darwin (ACST)',
    'Pacific/Auckland': 'Auckland (NZDT/NZST)',
    
    // Asia
    'Asia/Ho_Chi_Minh': 'Ho Chi Minh City (ICT)',
    'Asia/Bangkok': 'Bangkok (ICT)',
    'Asia/Singapore': 'Singapore (SGT)',
    'Asia/Kuala_Lumpur': 'Kuala Lumpur (MYT)',
    'Asia/Jakarta': 'Jakarta (WIB)',
    'Asia/Manila': 'Manila (PHT)',
    'Asia/Tokyo': 'Tokyo (JST)',
    'Asia/Seoul': 'Seoul (KST)',
    'Asia/Shanghai': 'Shanghai (CST)',
    'Asia/Hong_Kong': 'Hong Kong (HKT)',
    'Asia/Taipei': 'Taipei (CST)',
    'Asia/Kolkata': 'India (IST)',
    
    // Americas
    'America/New_York': 'New York (EST/EDT)',
    'America/Los_Angeles': 'Los Angeles (PST/PDT)',
    'America/Chicago': 'Chicago (CST/CDT)',
    'America/Denver': 'Denver (MST/MDT)',
    'America/Toronto': 'Toronto (EST/EDT)',
    'America/Vancouver': 'Vancouver (PST/PDT)',
    
    // Europe
    'Europe/London': 'London (GMT/BST)',
    'Europe/Paris': 'Paris (CET/CEST)',
    'Europe/Berlin': 'Berlin (CET/CEST)',
    'Europe/Rome': 'Rome (CET/CEST)',
    'Europe/Madrid': 'Madrid (CET/CEST)',
    'Europe/Amsterdam': 'Amsterdam (CET/CEST)',
  };

  return timezoneMap[timezone] || timezone;
}

export function getCurrentTimeInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch (error) {
    console.error('Error formatting time for timezone:', timezone, error);
    return '';
  }
}

// Helper function to get all supported timezones for salon setup
export function getSupportedTimezones(): Array<{ value: string; label: string; region: string }> {
  return [
    // Australia & New Zealand
    { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)', region: 'Australia & New Zealand' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)', region: 'Australia & New Zealand' },
    { value: 'Australia/Brisbane', label: 'Brisbane (AEST)', region: 'Australia & New Zealand' },
    { value: 'Australia/Perth', label: 'Perth (AWST)', region: 'Australia & New Zealand' },
    { value: 'Australia/Adelaide', label: 'Adelaide (ACDT/ACST)', region: 'Australia & New Zealand' },
    { value: 'Australia/Darwin', label: 'Darwin (ACST)', region: 'Australia & New Zealand' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)', region: 'Australia & New Zealand' },
    
    // Southeast Asia
    { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City (ICT)', region: 'Southeast Asia' },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)', region: 'Southeast Asia' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)', region: 'Southeast Asia' },
    { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (MYT)', region: 'Southeast Asia' },
    { value: 'Asia/Jakarta', label: 'Jakarta (WIB)', region: 'Southeast Asia' },
    { value: 'Asia/Manila', label: 'Manila (PHT)', region: 'Southeast Asia' },
    
    // East Asia
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)', region: 'East Asia' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)', region: 'East Asia' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)', region: 'East Asia' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', region: 'East Asia' },
    { value: 'Asia/Taipei', label: 'Taipei (CST)', region: 'East Asia' },
    
    // South Asia
    { value: 'Asia/Kolkata', label: 'India (IST)', region: 'South Asia' },
    
    // North America
    { value: 'America/New_York', label: 'New York (EST/EDT)', region: 'North America' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', region: 'North America' },
    { value: 'America/Chicago', label: 'Chicago (CST/CDT)', region: 'North America' },
    { value: 'America/Denver', label: 'Denver (MST/MDT)', region: 'North America' },
    { value: 'America/Toronto', label: 'Toronto (EST/EDT)', region: 'North America' },
    { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)', region: 'North America' },
    
    // Europe
    { value: 'Europe/London', label: 'London (GMT/BST)', region: 'Europe' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)', region: 'Europe' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', region: 'Europe' },
    { value: 'Europe/Rome', label: 'Rome (CET/CEST)', region: 'Europe' },
    { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)', region: 'Europe' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)', region: 'Europe' },
  ];
}

// Utility to validate if a timezone string is supported
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
