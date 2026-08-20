import type { VercelRequest, VercelResponse } from "@vercel/node";

import { isAddress, issueNonce } from "../_lib/auth";
import { applyCommonHeaders, badRequest, methodNotAllowed, readBody, serverError } from "../_lib/http";

/** POST /api/partner/nonce — hand out a one-shot nonce for the partner to sign. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCommonHeaders(res);
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const { address } = readBody(req);
  if (!isAddress(address)) return badRequest(res, "A wallet address is required.");

  try {
    return res.status(200).json(await issueNonce(address));
  } catch (error) {
    return serverError(res, "nonce", error);
  }
}
