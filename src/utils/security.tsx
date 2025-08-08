export class SecurityManager {
  static readonly INPUT_LIMITS = {
    TEXT_SHORT: 255,
    TEXT_LONG: 2000,
    EMAIL: 320,
    PHONE: 20,
    URL: 2048,
  };

  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, this.INPUT_LIMITS.TEXT_SHORT);
  }

  static sanitizeUrl(url: string): string {
    if (typeof url !== 'string') return '';
    
    try {
      const parsed = new URL(url);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      return parsed.toString().substring(0, this.INPUT_LIMITS.URL);
    } catch {
      return '';
    }
  }
}