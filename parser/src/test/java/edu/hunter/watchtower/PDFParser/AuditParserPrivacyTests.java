package edu.hunter.watchtower.PDFParser;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AuditParserPrivacyTests {

    @Test
    void malformedPdfDoesNotReturnParserInternals(@TempDir Path directory) throws IOException {
        Path malformedPdf = directory.resolve("synthetic.pdf");
        Files.writeString(malformedPdf, "%PDF-not-valid");

        Map<String, Object> result = new AuditParser().parse(malformedPdf.toFile(), true);

        assertEquals(Map.of("ERROR", "Could not read PDF"), result);
    }
}
