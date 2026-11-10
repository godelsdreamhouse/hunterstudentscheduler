const GENERIC_UPLOAD_ERROR =
	"The server could not process your audit. Please check your file and try again.";

export const MAX_AUDIT_FILE_SIZE_MB = 4;
export const MAX_AUDIT_FILE_SIZE_BYTES = MAX_AUDIT_FILE_SIZE_MB * 1024 * 1024;

export const UPLOAD_LIMIT_ERROR =
	`Upload exceeds the ${MAX_AUDIT_FILE_SIZE_MB}MB PDF limit`;

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

	return `Your upload is too large. Use a PDF no larger than ${MAX_AUDIT_FILE_SIZE_MB}MB and try again.`;
}
