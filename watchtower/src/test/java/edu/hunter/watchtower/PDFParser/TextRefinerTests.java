package edu.hunter.watchtower.PDFParser;

import org.junit.jupiter.api.Test;
import java.util.ArrayList;

public class TextRefinerTests {
    
    private TextRefiner refiner = new TextRefiner();

    private final String text = "Degree in Bachelor of Arts STILL NEEDED\n" + //
        "Credits required: 120 Credits applied:  122.7 Year:  2023-2024 Undergrad\n" + //
        "NOTE: If you have an exemption, waiver or substitution on your official transcript that is not applying to your DegreeWorks worksheet, please email\n" + //
        "regweb@hunter.cuny.edu to confirm receipt and processing.";
    private final String line = "If you have an exemption, waiver or substitution on your official transcript"
        + " that is not applying to your DegreeWorks worksheet, please email";

    @Test
    void findLinesTest() {
        String result = refiner.findInLine(line, "your", "worksheet");
        System.out.println(result);
        ArrayList<String> left = refiner.getLinesLeft(text,":");
        left.forEach((x) -> {System.out.println(x);});
        ArrayList<String> right = refiner.getLinesRight(text,":");
        right.forEach((x) -> {System.out.println(x);});
    }

}
