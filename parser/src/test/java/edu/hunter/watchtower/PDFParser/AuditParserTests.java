/**
 * @file AuditParserTests.java
 * @author Allison Gorman
 */
package edu.hunter.watchtower.PDFParser;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Map;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import edu.hunter.watchtower.common.Requirement;

public class AuditParserTests {

    private final String filepathPDF = ""; // absolute path to Audit PDF
    private final String filepathTxt = "src/main/resources/exampleAudit.txt"; // absolute path to Audit .txt file
    private final AuditParser auditParser = new AuditParser();

    @Test
    @Disabled("Requires a developer-provided local DegreeWorks PDF")
    void testParse() throws IOException {
        File file = new File(filepathPDF);
        if (!file.exists())
            throw new IOException("IOException: File could not be read.");

        Map<String, Object> result = auditParser.parse(file, true);

        // For local testing only
        // result.forEach((key, value) -> {
        // String s = key + "\n" + value.toString() + "\n";
        // System.out.println(s);
        // });

        assertTrue(!result.isEmpty());

    }

    @Test
    void testParseTxt() throws IOException {
        File file = new File(filepathTxt);
        if (!file.exists())
            throw new IOException("IOException: File could not be read.");

        Map<String, Object> result = auditParser.parse(file, false);

        // For local testing only
        // result.forEach((key, value) -> {
        // String s = key + "\n" + value.toString() + "\n";
        // System.out.println(s);
        // });

        assertTrue(!result.isEmpty());

        // Test credits
        Map<String, Object> credits = (Map<String, Object>) result.get("Degree Credits");
        assertTrue(((String) credits.get("Status")).equals("Completed") &&
                (Float) credits.get("Credits applied") == 122.7f &&
                (Float) credits.get("Credits required") == 120.0f);

        // Test major info
        Map<String, Map<String, Object>> majorInfo = (Map<String, Map<String, Object>>) result.get("MajorInfo");
        Map<String, Object> major = majorInfo.get("MajorCredits_Computer Science");
        assertTrue(((String) major.get("Status")).equals("Completed") &&
                (Float) major.get("Credits applied") == 54.3f &&
                (Float) major.get("Credits required") == 51.0f);

        // Test completed
        ArrayList<Requirement> completed = (ArrayList<Requirement>) result.get("Completed");
        assertTrue(
                completed.get(0).name.equals("English Composition") &&
                        completed.get(0).tag.equals("CUNYcommon") &&
                        completed.get(0).courses.get(0).courseID.equals("12000") &&
                        completed.get(0).courses.get(0).departmentCode.equals("ENGL") &&
                        completed.get(0).courses.get(0).name.equals("Expository Writing") &&
                        completed.get(0).courses.get(0).grade.equals("A-") &&
                        completed.get(0).courses.get(0).credit == 3.3f);

        // Test still needed
        ArrayList<Requirement> stillNeeded = (ArrayList<Requirement>) result.get("Still Needed");
        Requirement firstRemaining = stillNeeded.get(0);
        assertAll(
                () -> assertEquals("Life & Physical Sciences", firstRemaining.name),
                () -> assertEquals("CUNYcommon", firstRemaining.tag),
                () -> assertEquals(3.0f, firstRemaining.credits),
                () -> assertEquals("ANTHP", firstRemaining.courses.get(0).departmentCode),
                () -> assertEquals("10100", firstRemaining.courses.get(0).courseID),
                () -> assertEquals("ANTHP", firstRemaining.courses.get(1).departmentCode),
                () -> assertEquals("10200", firstRemaining.courses.get(1).courseID));

        // Test gpa, major, concentration, minor
        String concentration = ((ArrayList<String>) result.get("Concentration")).get(0);
        String minor = ((ArrayList<String>) result.get("Minor")).get(0);
        String majorName = ((ArrayList<String>) result.get("Major")).get(0);
        assertTrue(
                ((String) result.get("GPA")).equals("9.99") &&
                        concentration.equals("Computer Science") &&
                        minor.equals("Women & Gender Studies") &&
                        majorName.equals("Computer Science"));
    }

    // for testing different Audit types, create txt file to edit.
    @Test
    @Disabled("Developer utility requires explicit local input and output paths")
    public void toTxt() throws IOException {
        String f = "";
        File file = new File(f);

        if (!file.exists())
            throw new IOException("IOException: File could not be read.");

        String text;
        PDFTextStripper pdfTextStripper = new PDFTextStripper();

        try (PDDocument audit = Loader.loadPDF(file)) {
            text = pdfTextStripper.getText(audit);
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

}
