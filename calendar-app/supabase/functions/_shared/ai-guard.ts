// Fail-closed authorisation for AI on calendars that may include minors.
// The SQL function `minor_ai_allowed` returns true when the calendar may use AI.
// Anything else - false, null, undefined, or a failed call - is a refusal: a security
// check must never open access because it could not run.
export function minorAiAllows(data: unknown, error: unknown): boolean {
  return !error && data === true
}
