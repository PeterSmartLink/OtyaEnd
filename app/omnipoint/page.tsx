import { redirect } from "next/navigation";

/**
 * OmniPoint entry point.
 *
 * The mobile workspace is an isolated static preview until its authenticated
 * API, production D1 schema, audit controls, and provider adapters pass review.
 * It deliberately does not connect to Otya's account or business databases.
 */
export default function OmniPointEntryPage() {
  redirect("/omnipoint/index.html");
}
