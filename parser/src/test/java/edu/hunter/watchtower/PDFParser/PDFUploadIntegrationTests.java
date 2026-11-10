package edu.hunter.watchtower.PDFParser;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import edu.hunter.watchtower.common.WebConfig;

@SpringBootTest(
        classes = PDFUploadIntegrationTests.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.servlet.multipart.max-file-size=5MB",
            "spring.servlet.multipart.max-request-size=6MB",
            "server.tomcat.max-swallow-size=10MB",
            "cors.allowed-origins=https://app.example",
            "spring.autoconfigure.exclude="
                    + "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,"
                    + "org.springframework.boot.session.jdbc.autoconfigure.JdbcSessionAutoConfiguration,"
                    + "org.springframework.boot.batch.autoconfigure.BatchAutoConfiguration"
        })
class PDFUploadIntegrationTests {

    private static final int MEBIBYTE = 1024 * 1024;
    private static final int MAX_FILE_BYTES = 5 * MEBIBYTE;
    private static final int MAX_REQUEST_BYTES = 6 * MEBIBYTE;
    private static final String ALLOWED_ORIGIN = "https://app.example";
    private static final String SECRET_FILENAME = "student-emplid-12345678.pdf";
    private static final String BOUNDARY = "watchtower-boundary";

    @LocalServerPort
    private int port;

    private final HttpClient client = HttpClient.newHttpClient();

    @Test
    void oversizedFileReturnsPrivateCorsEnabledJsonWithoutStudentDetails() throws Exception {
        byte[] body = multipartBody(fileBytes(MAX_FILE_BYTES + 1), 0);

        HttpResponse<String> response = send(body, ALLOWED_ORIGIN);

        assertEquals(413, response.statusCode());
        assertEquals("no-store", response.headers().firstValue(HttpHeaders.CACHE_CONTROL).orElseThrow());
        assertEquals(
                ALLOWED_ORIGIN,
                response.headers().firstValue(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN).orElseThrow());
        assertEquals(
                "{\"ERROR\":\"Upload exceeds the 5MB PDF or 6MB total request limit\"}",
                response.body());
        assertFalse(response.body().contains(SECRET_FILENAME));
        assertFalse(response.body().contains("12345678"));
        assertFalse(response.body().contains("%PDF"));
    }

    @Test
    void exactFileLimitIsAccepted() throws Exception {
        HttpResponse<String> response = send(multipartBody(fileBytes(MAX_FILE_BYTES), 0), ALLOWED_ORIGIN);

        assertEquals(200, response.statusCode());
        assertEquals("{\"size\":" + MAX_FILE_BYTES + "}", response.body());
    }

    @Test
    void requestLimitRejectsCombinedPartsEvenWhenFileIsWithinLimit() throws Exception {
        byte[] bodyAtLimit = multipartBodyAtTotalSize(MAX_REQUEST_BYTES);
        byte[] bodyOverLimit = multipartBodyAtTotalSize(MAX_REQUEST_BYTES + 1);

        assertEquals(200, send(bodyAtLimit, ALLOWED_ORIGIN).statusCode());
        HttpResponse<String> response = send(bodyOverLimit, ALLOWED_ORIGIN);
        assertEquals(413, response.statusCode());
        assertEquals("no-store", response.headers().firstValue(HttpHeaders.CACHE_CONTROL).orElseThrow());
        assertEquals(
                ALLOWED_ORIGIN,
                response.headers().firstValue(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN).orElseThrow());
        assertEquals("application/json", response.headers().firstValue(HttpHeaders.CONTENT_TYPE).orElseThrow());
        assertEquals(
                "{\"ERROR\":\"Upload exceeds the 5MB PDF or 6MB total request limit\"}",
                response.body());
        assertFalse(response.body().contains(SECRET_FILENAME));
        assertFalse(response.body().contains("12345678"));
        assertFalse(response.body().contains("%PDF"));
    }

    @Test
    void disallowedOriginIsRejectedBeforeTheApplication() throws Exception {
        HttpResponse<String> response = send(
                multipartBody(fileBytes(1024), 0),
                "https://attacker.example");

        assertEquals(403, response.statusCode());
        assertTrue(response.headers().firstValue(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN).isEmpty());
        assertFalse(response.body().contains(SECRET_FILENAME));
        assertFalse(response.body().contains("12345678"));
    }

    @Test
    void oversizedSameOriginRequestStillReceivesNoStoreWithoutCorsHeader() throws Exception {
        HttpResponse<String> response = send(multipartBody(fileBytes(MAX_FILE_BYTES + 1), 0), null);

        assertEquals(413, response.statusCode());
        assertEquals("no-store", response.headers().firstValue(HttpHeaders.CACHE_CONTROL).orElseThrow());
        assertTrue(response.headers().firstValue(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN).isEmpty());
    }

    private HttpResponse<String> send(byte[] body, String origin) throws IOException, InterruptedException {
        HttpRequest.Builder request = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/AuditParse"))
                .header(HttpHeaders.CONTENT_TYPE, "multipart/form-data; boundary=" + BOUNDARY)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body));
        if (origin != null) {
            request.header(HttpHeaders.ORIGIN, origin);
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private byte[] multipartBodyAtTotalSize(int totalSize) throws IOException {
        byte[] file = fileBytes(4 * MEBIBYTE);
        int fixedSize = multipartBody(file, 0).length;
        int fillerSize = totalSize - fixedSize;
        if (fillerSize < 0) {
            throw new IllegalArgumentException("target request size is too small");
        }
        byte[] body = multipartBody(file, fillerSize);
        assertEquals(totalSize, body.length);
        return body;
    }

    private byte[] multipartBody(byte[] file, int fillerSize) throws IOException {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        writeAscii(body, "--" + BOUNDARY + "\r\n");
        writeAscii(
                body,
                "Content-Disposition: form-data; name=\"file\"; filename=\""
                        + SECRET_FILENAME
                        + "\"\r\n");
        writeAscii(body, "Content-Type: application/pdf\r\n\r\n");
        body.write(file);
        writeAscii(body, "\r\n--" + BOUNDARY + "\r\n");
        writeAscii(body, "Content-Disposition: form-data; name=\"padding\"\r\n\r\n");
        body.write(new byte[fillerSize]);
        writeAscii(body, "\r\n--" + BOUNDARY + "--\r\n");
        return body.toByteArray();
    }

    private byte[] fileBytes(int size) {
        byte[] file = new byte[size];
        byte[] signature = "%PDF-".getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(signature, 0, file, 0, signature.length);
        return file;
    }

    private void writeAscii(ByteArrayOutputStream output, String value) throws IOException {
        output.write(value.getBytes(StandardCharsets.US_ASCII));
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @Import({PDFUploadExceptionHandler.class, WebConfig.class, UploadEndpoint.class})
    static class TestApplication {
    }

    @RestController
    static class UploadEndpoint {
        @PostMapping("/AuditParse")
        Map<String, Long> accept(@RequestParam("file") MultipartFile file) {
            return Map.of("size", file.getSize());
        }
    }
}
