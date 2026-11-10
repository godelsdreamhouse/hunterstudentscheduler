package edu.hunter.watchtower.PDFParser;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

class PDFControllerTests {

    @Test
    void acceptsPdfSignatureWithoutRetainingTemporaryFile() {
        AuditParser parser = mock(AuditParser.class);
        AtomicReference<Path> parsedPath = new AtomicReference<>();
        when(parser.parse(any(File.class), eq(true))).thenAnswer(invocation -> {
            File temporaryAudit = invocation.getArgument(0);
            assertTrue(temporaryAudit.exists());
            parsedPath.set(temporaryAudit.toPath());
            return Map.of("Major", java.util.List.of("Synthetic Major"));
        });

        PDFController controller = new PDFController(parser);
        MockMultipartFile upload = new MockMultipartFile(
                "file",
                "synthetic.pdf",
                "application/pdf",
                "%PDF-synthetic".getBytes(java.nio.charset.StandardCharsets.US_ASCII));

        ResponseEntity<Map<String, Object>> response = controller.parseAudit(upload);

        assertEquals("no-store", response.getHeaders().getCacheControl());
        assertNotNull(parsedPath.get());
        assertFalse(Files.exists(parsedPath.get()));
        assertEquals(java.util.List.of("Synthetic Major"), response.getBody().get("Major"));
    }

    @Test
    void rejectsRenamedNonPdfWithoutEchoingFilename() {
        AuditParser parser = mock(AuditParser.class);
        PDFController controller = new PDFController(parser);
        MockMultipartFile upload = new MockMultipartFile(
                "file",
                "student-name.pdf",
                "application/pdf",
                "not a pdf".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        ResponseEntity<Map<String, Object>> response = controller.parseAudit(upload);

        assertEquals(Map.of("ERROR", "Not a PDF"), response.getBody());
        assertEquals("no-store", response.getHeaders().getCacheControl());
        verifyNoInteractions(parser);
    }

    @Test
    void rejectsPlaintextTestUploadInRuntimeEndpoint() {
        AuditParser parser = mock(AuditParser.class);
        PDFController controller = new PDFController(parser);
        MockMultipartFile upload = new MockMultipartFile(
                "file",
                "ADMIN4082.txt",
                "text/plain",
                "synthetic audit".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        ResponseEntity<Map<String, Object>> response = controller.parseAudit(upload);

        assertEquals(Map.of("ERROR", "Not a PDF"), response.getBody());
        verifyNoInteractions(parser);
    }
}
