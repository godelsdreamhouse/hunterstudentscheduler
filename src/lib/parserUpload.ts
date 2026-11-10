const GENERIC_UPLOAD_ERROR =
	"The server could not process your audit. Please check your file and try again.";

export const UPLOAD_LIMIT_ERROR =
	"Upload exceeds the 5MB PDF or 6MB total request limit";

export function parserUploadError(status: number, responseText: string): string {
	if (status !== 413) return GENERIC_UPLOAD_ERROR;

	try {
		const response: unknown = JSON.parse(responseText);
		if (
			typeof response === "object" &&
			response !== null &&
			"ERROR" in response &&
			response.ERROR === UPLOAD_LIMIT_ERROR
		) {
			return UPLOAD_LIMIT_ERROR;
		}
	} catch {
		// Fall through to the safe client-owned message.
	}

	return "Your upload is too large. Use a PDF no larger than 5MB and try again.";
}
