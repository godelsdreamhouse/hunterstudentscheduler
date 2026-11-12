import { describe, expect, it } from "vitest";
import fixtures from "../../../test-fixtures/contracts/supported-major-audits.json";
import { buildConfirmedAuditData } from "../auditReview";
import { buildScheduleRequest } from "../smartScheduleContract";

describe("supported-major parser-to-scheduler contract fixtures", () => {
	it.each(fixtures.cases)("normalizes and allowlists the $id audit", (fixture) => {
		const audit = buildConfirmedAuditData(fixture.raw_parser_response, {});
		expect(audit.parserPayload).toEqual(fixture.expected_parser_payload);

		const result = buildScheduleRequest({
			parserPayload: audit.parserPayload,
			...fixtures.schedule_input,
		});

		expect(result.kind).toBe("success");
		if (result.kind === "error") throw new Error(result.message);
		expect(result.request).toEqual({
			parser_payload: fixture.expected_parser_payload,
			ui_payload: fixtures.expected_ui_payload,
			term_season: "SPRING",
			term_year: 2027,
		});
	});
});
