package edu.hunter.watchtower.PDFParser;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
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

    @Test
    void compressedNonAuditPdfReturnsOnlyTheGenericValidationError(@TempDir Path directory)
            throws IOException {
        Path compressedPdf = directory.resolve("synthetic-compressed.pdf");
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage();
            document.addPage(page);
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                content.beginText();
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                content.newLineAtOffset(72, 720);
                content.showText("Synthetic non-audit document");
                content.endText();
            }
            document.save(compressedPdf.toFile());
        }

        String serializedPdf = Files.readString(
                compressedPdf,
                java.nio.charset.StandardCharsets.ISO_8859_1);
        assertTrue(serializedPdf.contains("/FlateDecode"));

        Map<String, Object> result = new AuditParser().parse(compressedPdf.toFile(), true);

        assertEquals(Map.of("ERROR", "Not a DegreeWorks PDF"), result);
    }
}
