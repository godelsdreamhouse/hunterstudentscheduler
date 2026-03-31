package edu.hunter.watchtower.PDFParser;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

public class TextRefinerTests {
    
    private TextRefiner refiner = new TextRefiner();

    private final String text = """
                                Degree in Bachelor of Arts STILL NEEDED
                                Credits required: 120 Credits applied:  122.7 Year:  2023-2024 Undergrad
                                NOTE: If you have an exemption, waiver or substitution on your official transcript that is not applying to your DegreeWorks worksheet, please email
                                regweb@hunter.cuny.edu to confirm receipt and processing."""
    ;
    private final String line = "If you have an exemption, waiver or substitution on your official transcript"
        + " that is not applying to your DegreeWorks worksheet, please email";

    private final String section = """
            Major in Computer Science STILL NEEDED
            line1
            line2
            line3

            Computer Science STILL NEEDED
            line1
            line2
            line3

            Additional Major Requ-Computer Science STILL NEEDED
            line1
            line2
            line3

            Major in Mathematics STILL NEEDED
            line1
            line2
            line3

            Mathematics STILL NEEDED
            line1
            line2
            line3

            Addition Major Requ-Mathematics STILL NEEDED
            line1
            line2
            line3
            """;
    private final String section2 = """
            Major in Philosophy STILL NEEDED
            line1
            line2
            line3

            Philosophy STILL NEEDED
            line1
            line2
            line3

            Additional Major Requ-Philosophy STILL NEEDED
            line1
            line2
            line3
            """;

    @Test
    void findLinesTest() {
        String result = refiner.findInLine(line, "your", "worksheet");
        System.out.println(result);
        ArrayList<String> left = refiner.getLinesLeft(text,":");
        left.forEach((x) -> {System.out.println(x);});
        ArrayList<String> right = refiner.getLinesRight(text,":");
        right.forEach((x) -> {System.out.println(x);});
    }

    @Test
    void splitSectionTest() {
        ArrayList<String> result = new ArrayList<>();
        refiner.splitSection(section, result, new ArrayList<>(Arrays.asList("Computer Science", "Mathematics")), "Major in ");
        IntStream.range(0,result.size()).forEach( i -> System.out.println( i + "\n" + result.get(i) + "\n\n"));
        ArrayList<String> result2 = new ArrayList<>();
        refiner.splitSection(section+"\n"+section2, result2, new ArrayList<>(Arrays.asList("Computer Science", "Mathematics","Philosophy")), "Major in ");
        IntStream.range(0,result2.size()).forEach( i -> System.out.println( i + "\n" + result2.get(i) + "\n\n"));
    }

}
