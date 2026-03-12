package edu.hunter.watchtower.PDFParser;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;

import org.junit.jupiter.api.Test;

public class AuditParserTests {
    
    private final String filepath = "ENTER PATH";
    private final AuditParser auditParser = new AuditParser();

    @Test
    void testParse() throws IOException {

        File file = new File(filepath);
        File outfile = new File("ENTER OUTFILE"); 
        String text;

        if(!file.exists()) throw new IOException("IOException: File could not be read.");

        try {
            outfile.createNewFile();
        } catch (IOException e) {
            System.out.println("Failed to create output file.");
            System.out.println(e.getMessage());
        }

        try (FileWriter writer = new FileWriter(outfile)) {
            text = auditParser.parse(file);
            writer.write(text);
            writer.close();
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }

    }

}
