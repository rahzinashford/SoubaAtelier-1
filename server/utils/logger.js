const isProduction = process.env.NODE_ENV === "production";

export function logError(message, error, metadata = {}) {
  if (isProduction) {
    console.error(message, {
      name: error?.name,
      message: error?.message,
      ...metadata,
    });
    return;
  }

  console.error(message, error);
}
