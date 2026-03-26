/**
 * @file AuditParser.Java
 * @name Allison Gorman
 * @brief Parses Audit PDF and then extracts required information from it
 */
package edu.hunter.watchtower.PDFParser;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Scanner;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

import edu.hunter.watchtower.common.Course;
import edu.hunter.watchtower.common.Requirements;
import lombok.NoArgsConstructor;

@NoArgsConstructor
public class AuditParser {

    private final TextRefiner refiner = new TextRefiner();
    private final String NEEDED = "Still needed";
    private final ArrayList<Requirements> requirements = new ArrayList<>(Arrays.asList(Requirements.values()));

    public Map<String,Object> parse(File file) {
        String text;
        PDFTextStripper pdfTextStripper = new PDFTextStripper();
        
        try (PDDocument audit = Loader.loadPDF(file)) {
            text =  pdfTextStripper.getText(audit);
        } catch (IOException e) {
            Map<String, Object> result = new HashMap<>();
            result.put("ERROR", e.getMessage());
            return result;
        }

        return extractInfo(text);
    }

    public Map<String,Object> parse(File file, boolean notPDF) {
        StringBuilder builder = new StringBuilder();

        try (Scanner scanner = new Scanner(file)) {
            while (scanner.hasNextLine()) {
                builder.append(scanner.nextLine()).append("\n");
            }
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("ERROR", e.getMessage());
            return result;
        }

        return extractInfo(builder.toString());
    }

    private Map<String,Object> extractInfo(String text) {
        Map<String, Object> result = new HashMap<>();

        if (!verifyAudit(text)) {
            result.put("ERROR", "Not a DegreeWorks PDF");
            return result;
        }

        Map<String, String> blocks = getBlocks(text);
        result.putAll(blocks);
        
        // Get Major, Minor, Concentration
        Map<String,ArrayList<String>> degreeInfo = getDegreeInfo(blocks.get("header"));
        degreeInfo.forEach( (x,y) -> {result.put(x,y);});

        // Get Core Classes
        result.putAll(getCoreClasses(blocks));

        // FUTURE: Get Writing Requirement

        // Get Major Information

        return result;
    }

    private boolean verifyAudit(String text) {
        String[] lines = text.split("\n");
        String lastLine = lines[lines.length -1];
        Pattern pattern = Pattern.compile("Ellucian Degree Works");
        Matcher matcher = pattern.matcher(lastLine);
        return matcher.find();
    }

    private Map<String,String> getBlocks(String text) {
        Map<String,String> result = new HashMap<>();
        
        ArrayList<String> keys = new ArrayList<>(Arrays.asList(
            "header","CUNYcommon","hunterFocusLang","hunterFocusConc","writing","plural","major","minor"
        ));

        ArrayList<String> blocks = refiner.getBlocks(
            text, 
            new ArrayList<>(Arrays.asList(
                "Major", "REQUIRED CORE", "Foreign Lang", "Focus-Concentrated Study",
                "Writing Requirement","Pluralism & Diversity","Major in", "Minor in")),
            new ArrayList<>(Arrays.asList(
                "Matriculation", "NOTE:", "Focus-Concentrated Study", "Writing Requirement",
                "Pluralism & Diversity","Major","Minor","Elective Courses"))
        );

        IntStream.range(0,keys.size()).forEach( i -> result.put(keys.get(i), blocks.get(i)));

        return result;
    }

    private Map<String,ArrayList<String>> getDegreeInfo(String line) {
        Map<String,ArrayList<String>> result = new HashMap<>();
        final String divider = "   ";

        String[] segments= refiner.findInLine(line,"","Level").split(divider);
        String[] patterns = {"Major{1}s?","Concentration{1}s?","Minor{1}s?"};
        String[] keys = {"Major", "Concentration", "Minor"};

        for (int i = 0; i < segments.length; ++i) {
            String[] str = segments[i].replaceAll(patterns[i], "")
                .replaceAll("[UM]{1} ", "").trim().split(",");
            result.put(keys[i],new ArrayList<>(Arrays.asList(str)));
        }

        return result;
    }

    private Map<String, Object> getCoreClasses(Map<String, String> blocks) {
        Map<String, Object> result = new HashMap<>();
        Map<String,Course> completed = new HashMap<>();
        ArrayList<String> needed = new ArrayList<>();
        Map<String,Course> inProgress = new HashMap<>();
        Map<String, String> reqs = new HashMap<>(); // to store unrefined lines
        requirements.forEach( x -> reqs.put(x.toString(),""));
        
        // From CUNY Common Core
        ArrayList<String> reqList = new ArrayList<>(Arrays.asList( Requirements.ENGCOMP.toString(), Requirements.ENGCOMP2.toString(), 
                Requirements.QUANT.toString(), Requirements.SCI.toString(), Requirements.WORLD.toString(), Requirements.USDIV.toString(), 
                Requirements.CEXP.toString(), "Individual and Society", "Scientific World" ));
        ArrayList<String> commonCore = refiner.getBlocks(
            blocks.get("CUNYcommon"), 
            reqList,
            new ArrayList<>(Arrays.asList( Requirements.ENGCOMP2.toString(), Requirements.QUANT.toString(), 
                Requirements.SCI.toString(), "FLEXIBLE COMMON CORE", Requirements.USDIV.toString(), Requirements.CEXP.toString(),
                "Individual and Society", "Scientific World", "end"))
        );
        IntStream.range(0,reqList.size()).forEach( i -> { if (i != 7) reqs.put(reqList.get(i), commonCore.get(i)); } );
        reqs.put(Requirements.ISOSC.toString(), refiner.findInLine(commonCore.get(7), "Social Science", "Humanities, Cultures and Ideas"));
        reqs.put(Requirements.IHUM.toString(), refiner.findInLine(commonCore.get(7), "Humanities, Cultures and Ideas", ""));
        
        // From Pluralism and Diversity Requirement
        ArrayList<String> plural = refiner.getBlocks(
            blocks.get("plural"),
            new ArrayList<>(Arrays.asList("Group A:", "Group B:", "Group C:", "Group D:")),
            new ArrayList<>(Arrays.asList("Group B:", "Group C:", "Group D:", "end"))
        );
        reqs.put(Requirements.PLURALA.toString(), plural.get(0));
        reqs.put(Requirements.PLURALB.toString(), plural.get(1));
        reqs.put(Requirements.PLURALC.toString(), plural.get(2).split("Non-BIOL courses")[1]);
        reqs.put(Requirements.PLURALD.toString(), plural.get(3).split("Non-BIOL courses")[1]);

        // Extract course information and sort into completed, in progress, and still needed
        // Stop pattern: Any grade, + or - once or not, one digit credit, .X once or not where X is a digit,
        //  one of four term names
        // ip pattern (in progress): IP (
        Pattern stop = Pattern.compile("[ABCDFPW(NC)(INC)]{1}[\\+\\-]? \\d(\\.\\d)? " 
            + "[(FALL)(WINTER)(SPRING)(SUMMER)]");
        Pattern ip = Pattern.compile("IP \\(");

        reqs.forEach( (key, value) -> {
            if (value.isEmpty() || value.contains(NEEDED)) needed.add(key);
            else if (ip.matcher(value).find()) inProgress.put(key,createCourse(value.split(ip.toString())[0]));
            else {
                Matcher matcher = stop.matcher(value);
                if (matcher.find()) completed.put(key,createCourse(value.substring(0,matcher.start())));
                else needed.add(key);
            }
        } );

        result.put("Completed",completed);
        result.put("In Progress",inProgress);
        result.put("Still Needed",needed);

        return result;
    }

     

    private Course createCourse(String line) {
        Course course = new Course();

        final Pattern nameSep = Pattern.compile("[A-Z]{3,7} \\d{4,6}");
        Matcher matcher = nameSep.matcher(line);

        if (matcher.find()) {
            course.name = line.split(nameSep.toString())[1].trim();
            String[] codes = matcher.group().split(" ");
            course.courseID = Integer.parseInt(codes[1].trim());
            course.departmentCode = codes[0].trim();
        }

        return course;
    }

} // end AuditParser definition