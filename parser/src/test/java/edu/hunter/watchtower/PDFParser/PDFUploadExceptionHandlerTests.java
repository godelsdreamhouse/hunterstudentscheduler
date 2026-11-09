package edu.hunter.watchtower.PDFParser;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class PDFUploadExceptionHandlerTests {

    @Test
    void oversizedUploadReturnsPrivateGenericError() {
        var response = new PDFUploadExceptionHandler().handleOversizedUpload();

        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, response.getStatusCode());
        assertEquals("no-store", response.getHeaders().getCacheControl());
        assertEquals(Map.of("ERROR", "PDF must be 5MB or smaller"), response.getBody());
    }
}
