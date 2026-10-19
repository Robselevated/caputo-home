// TEMPORARY: reports the function runtime. Do not commit.
export async function handler() {
  return { statusCode: 200, body: JSON.stringify({ node: process.version, ws: typeof globalThis.WebSocket }) }
}
