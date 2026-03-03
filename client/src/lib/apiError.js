export function getErrorMessage(errorPayload, fallback = 'Request failed') {
  if (errorPayload && typeof errorPayload === 'object') {
    if (typeof errorPayload.error === 'string' && errorPayload.error.trim()) {
      return errorPayload.error;
    }

    if (typeof errorPayload.message === 'string' && errorPayload.message.trim()) {
      return errorPayload.message;
    }
  }

  return fallback;
}

export async function parseJsonSafely(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
