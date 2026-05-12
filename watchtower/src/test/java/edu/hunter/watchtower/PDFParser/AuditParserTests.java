package edu.hunter.watchtower.PDFParser;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

public class AuditParserTests {

    private final String filepath = ""; // absolute path to Audit PDF
    private final AuditParser auditParser = new AuditParser();

    @Test
    void testParse() throws IOException {
        File file = new File(filepath);
        if (!file.exists())
            throw new IOException("IOException: File could not be read.");

        Map<String, Object> result = auditParser.parse(file);

        result.forEach((key, value) -> {
            String s = key + "\n" + value.toString() + "\n";
            System.out.println(s);
        });

    }

    @Test
    void toTxt() throws IOException {
        File file = new File(filepath);

        String outfile = ""; // INSERT OUTFILE NAME + PATH: path + /outfile_name
        String text;
        PDFTextStripper pdfTextStripper = new PDFTextStripper();

        if (!file.exists())
            throw new IOException("IOException: File could not be read.");

        try (PDDocument audit = Loader.loadPDF(file)) {
            text =  pdfTextStripper.getText(audit);
        } catch (IOException e) {
            throw new IOException("IOException: PDF could not be decoded.");
        }

        try (FileWriter writer = new FileWriter(outfile)) {
            writer.write(text);
            writer.close();
        } catch (IOException e) {
            throw new IOException("IOException: Could not write to output file " + outfile);
        }

    }

    @Test
    void testCourseStart() {
        String courseStart = "([A-Z]{3,7}) (\\d{1,6})";
        String text = "Intro to Computer Science CSCI 12700 Introduction: Computer Science A+ 3 FALL 2023U";
        Matcher m = Pattern.compile(courseStart).matcher(text);
        if (m.find()) {
            for (int i = 0; i <= m.groupCount(); ++i) {
                System.out.println((i)+ " " + m.group(i));
            }
        }
    }

}
