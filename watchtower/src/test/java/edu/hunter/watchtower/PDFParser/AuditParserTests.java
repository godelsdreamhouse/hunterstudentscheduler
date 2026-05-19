package edu.hunter.watchtower.PDFParser;

import java.io.File;
import java.io.IOException;
import java.util.Map;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class AuditParserTests {

    private final String filepath = ""; // absolute path to Audit PDF
    @Autowired private final AuditParser auditParser = new AuditParser();

    @Test
    void testParse() throws IOException {
        File file = new File(filepath);
        if (!file.exists())
            throw new IOException("IOException: File could not be read.");

        Map<String, Object> result = auditParser.parse(file,true);

        result.forEach((key, value) -> {
            String s = key + "\n" + value.toString() + "\n";
            System.out.println(s);
        });

    }

    @Test
    void testParseTxt() throws IOException {
        String f = "";
        File file = new File(f);
        if (!file.exists())
            throw new IOException("IOException: File could not be read.");

        Map<String, Object> result = auditParser.parse(file,false);

        result.forEach((key, value) -> {
            String s = key + "\n" + value.toString() + "\n";
            System.out.println(s);
        });
    }

    // for testing different Audit types, create txt file to edit
    @Test
    public void toTxt() throws IOException {
        String f = "";
        File file = new File(f);

        if (!file.exists())
            throw new IOException("IOException: File could not be read.");

        String text;
        PDFTextStripper pdfTextStripper = new PDFTextStripper();
        
        try (PDDocument audit = Loader.loadPDF(file)) {
            text =  pdfTextStripper.getText(audit);
        } catch (IOException e) {
            System.out.println("Error: " + e.getMessage());
            return;
        }

        String outfile = "/Users/ALG/Desktop/Hunter/csci 499/sample_DegreeWorks.txt";
        try (java.io.FileWriter writer = new java.io.FileWriter(outfile)) {
            writer.write(text);
            writer.close();
        } catch (Exception e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

}
