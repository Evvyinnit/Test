export default async function handler(req) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Validate URL format
    new URL(targetUrl);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0; +https://example.com/bot)' 
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
        return new Response(JSON.stringify({ url: targetUrl, error: 'Fetch failed' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const contentType = response.headers.get('content-type') || '';
    const finalUrl = response.url;

    // If it's already an image, return the final URL (which might be the redirected one)
    if (contentType.startsWith('image/')) {
      return new Response(JSON.stringify({ url: finalUrl }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If it's HTML, try to find meta tags
    if (contentType.includes('text/html')) {
      const html = await response.text();
      
      // Look for og:image
      const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      if (ogImageMatch && ogImageMatch[1]) {
        return new Response(JSON.stringify({ url: ogImageMatch[1] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Look for twitter:image
      const twitterImageMatch = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
      if (twitterImageMatch && twitterImageMatch[1]) {
        return new Response(JSON.stringify({ url: twitterImageMatch[1] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Fallback: Return the original URL if we couldn't resolve a better one
    return new Response(JSON.stringify({ url: targetUrl }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error resolving URL:', error);
    return new Response(JSON.stringify({ url: targetUrl, error: error.message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const config = {
  path: '/.netlify/functions/resolve-image',
};
