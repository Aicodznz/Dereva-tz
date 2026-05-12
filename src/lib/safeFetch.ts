export async function safeFetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error(`Expected JSON but got ${contentType || 'unknown'}. URL: ${url}. Response: ${text.substring(0, 100)}`);
    throw new Error(`Server returned non-JSON response (${response.status})`);
  }

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}
