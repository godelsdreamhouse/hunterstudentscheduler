import { describe, expect, it } from "vitest";
import { parserUploadError, UPLOAD_LIMIT_ERROR } from "../parserUpload";

describe("parserUploadError", () => {
	it("shows the parser's known upload-limit response", () => {
		expect(
			parserUploadError(413, JSON.stringify({ ERROR: UPLOAD_LIMIT_ERROR })),
		).toBe(UPLOAD_LIMIT_ERROR);
	});

	it("uses a useful fallback when a proxy returns a non-JSON 413", () => {
		expect(parserUploadError(413, "Request Entity Too Large")).toBe(
			"Your upload is too large. Use a PDF no larger than 5MB and try again.",
		);
	});

	it("does not display unexpected server text", () => {
		expect(
			parserUploadError(413, JSON.stringify({ ERROR: "student-123.pdf" })),
		).not.toContain("student-123.pdf");
		expect(parserUploadError(500, '{"ERROR":"database details"}')).not.toContain(
			"database details",
		);
	});
});
