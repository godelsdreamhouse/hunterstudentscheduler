package edu.hunter.watchtower.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class WebConfigTests {

    @Test
    void corsHeadersAreAppliedBeforeAnOversizedUploadResponse() throws Exception {
        var filter = new WebConfig("https://app.example").corsFilter();
        var request = auditRequest("https://app.example");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (ignoredRequest, servletResponse) ->
                ((MockHttpServletResponse) servletResponse).setStatus(413));

        assertEquals(413, response.getStatus());
        assertEquals(
                "https://app.example",
                response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void disallowedOriginDoesNotReceiveCorsHeader() throws Exception {
        var filter = new WebConfig("https://app.example").corsFilter();
        var request = auditRequest("https://attacker.example");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> { });

        assertNull(response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void allowedPreflightRetainsTheExistingPostContract() throws Exception {
        var filter = new WebConfig("https://app.example").corsFilter();
        var request = new MockHttpServletRequest("OPTIONS", "/AuditParse");
        request.addHeader(HttpHeaders.ORIGIN, "https://app.example");
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST");
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> {
            throw new AssertionError("A valid preflight must not reach the application");
        });

        assertEquals(200, response.getStatus());
        assertEquals(
                "https://app.example",
                response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        assertTrue(response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS).contains("POST"));
    }

    private MockHttpServletRequest auditRequest(String origin) {
        var request = new MockHttpServletRequest("POST", "/AuditParse");
        request.addHeader(HttpHeaders.ORIGIN, origin);
        request.setContentType("multipart/form-data; boundary=test");
        return request;
    }
}
