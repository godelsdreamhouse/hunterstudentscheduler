/**
 * @file AuditParserTests.java
 * @author Allison Gorman
 */
package edu.hunter.watchtower.PDFParser;

import java.io.File;
import java.io.IOException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class AuditParserTests {

    private final String filepathPDF = "/Users/ALG/Desktop/Hunter/csci 499/Watchtower/parser/src/main/resources/private/AG_Audit.pdf"; // absolute path to Audit PDF
    private final String filepathTxt = ""; // absolute path to Audit .txt file
    @Autowired private final AuditParser auditParser = new AuditParser();
    
    @Test
    void testParse() throws IOException {
        File file = new File(filepathPDF);
        if (!file.exists())
            throw new IOException("IOException: File could not be read.");

        Map<String, Object> result = auditParser.parse(file,true);

        // For local testing only

        // result.forEach((key, value) -> {
        //     String s = key + "\n" + value.toString() + "\n";
        //     System.out.println(s);
        // });

        assertTrue(!result.isEmpty());

    }

    @Test
    void testParseTxt() throws IOException {
        File file = new File(filepathTxt);
        if (!file.exists())
            throw new IOException("IOException: File could not be read.");

        Map<String, Object> result = auditParser.parse(file,false);

        // For local testing only

        // result.forEach((key, value) -> {
        //     String s = key + "\n" + value.toString() + "\n";
        //     System.out.println(s);
        // });

        assertTrue(!result.isEmpty());
    }

    // for testing different Audit types, create txt file to edit. Uncomment to use locally
    /*
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

        String outfile = "";
        try (java.io.FileWriter writer = new java.io.FileWriter(outfile)) {
            writer.write(text);
            writer.close();
        } catch (Exception e) {
            System.out.println("Error: " + e.getMessage());
        }
    }
    */

}
