import { updateData } from "../../lib/data-store.js";
import { sendJson, sendMethodNotAllowed } from "../../lib/api-response.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return sendMethodNotAllowed(req, res, ["DELETE"]);

  try {
    const id = String(req.query.id);
    const data = await updateData(async (current) => {
      const index = (current.aiPicks || []).findIndex((pick) => String(pick.id) === id);
      if (index === -1) {
        const error = new Error(`Pick ${id} not found`);
        error.statusCode = 404;
        throw error;
      }

      current.aiPicks.splice(index, 1);
      return current;
    });

    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}
