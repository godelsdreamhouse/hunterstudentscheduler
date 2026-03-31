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
import lombok.NoArgsConstructor;

@NoArgsConstructor
public class AuditParser {

    private final TextRefiner refiner = new TextRefiner();
    private final String NEEDED = "Still needed";
    private final String ADDITIONALREQ = "This major has Additional Major requirements";
    
    // courseStart pattern explanation
    //      [A-Z]{3,7}  --> department code, 3-6 capital letters 
    //      \\d{4,6}    --> course code, 4-5 numbers
    private final String courseStart = "[A-Z]{3,7} \\d{4,6}";

    // courseEnd pattern explanation
    //      \\b(?:A|B|C|D|F|P|W|NC|INC)  -->     Any grade 
    //      [\\+\\-]?    -->     + or - once or not at all, e.g. for A+ or A-
    //      \\d(\\.\\d)? -->     one number for first digit of credit, optional decimal component
    //      \\b(?:FALL|SUMMER|WINTER|SPRING)\\b  -->     one of four term names
    private final String courseEnd = "\\b(?:A|B|C|D|F|P|W|NC|INC)\\b{1}[\\+\\-]? \\d(\\.\\d)? " 
            + "\\b(?:FALL|SUMMER|WINTER|SPRING)\\b";
    
    private final String ipEnd = "IP \\(";

    private final String courseEndings = "(?:"+courseEnd+"|"+ipEnd+")";

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
        
        // Get Major, Minor, Concentration
        Map<String,ArrayList<String>> degreeInfo = getDegreeInfo(refiner.getBlock(text,"Major","Matriculation",false));
        degreeInfo.forEach( (x,y) -> {result.put(x,y);});
        boolean minor = degreeInfo.get("Minor").size() == 1 && degreeInfo.get("Minor").get(0).equals("None");
        Map<String, String> blocks = getBlocks(text, !minor);
        //result.putAll(blocks);

        // Get Core Classes
        result.putAll(getCoreClasses(blocks));

        // FUTURE: Get Writing Requirement

        // Get Major Information
        result.putAll(getMajor(blocks.get("major"), degreeInfo.get("Major") ));

        return result;
    }

    private boolean verifyAudit(String text) {
        String[] lines = text.split("\n");
        String lastLine = lines[lines.length -1];
        Pattern pattern = Pattern.compile("Ellucian Degree Works");
        Matcher matcher = pattern.matcher(lastLine);
        return matcher.find();
    }

    private Map<String,String> getBlocks(String text, boolean minor) {
        Map<String,String> result = new HashMap<>();
        
        ArrayList<String> keys = new ArrayList<>(Arrays.asList(
            "CUNYcommon","hunterFocusLang","hunterFocusConc","writing","plural","major","electiveApplied","electiveNot"
        ));
        ArrayList<String> starts = new ArrayList<>(Arrays.asList(
            "REQUIRED CORE", "Foreign Lang", "Focus-Concentrated Study",
            "Writing Requirement","Pluralism & Diversity","Major in", "Elective Courses Allowed", "Elective Courses Not Allowed"
        ));
        ArrayList<String> stops = new ArrayList<>(Arrays.asList(
            "NOTE:", "Focus-Concentrated Study", "Writing Requirement", 
            "Pluralism & Diversity","Major","Elective Courses Allowed","Elective Courses Not Allowed","end"
        ));

        if (minor) {
            keys.add(6,"minor");
            starts.add(6, "Minor in");
            stops.add(6,"Elective Courses");
            stops.set(5,"Minor");
        }

        ArrayList<String> blocks = refiner.getBlocks(text, starts, stops);

        IntStream.range(0,blocks.size()).forEach( i -> result.put(keys.get(i), blocks.get(i)));

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

        // From CUNY Common Core
        Map<String,Map<String,Course>> commonCourses = findCourses(blocks.get("CUNYcommon"));
        completed.putAll(commonCourses.get("taken"));
        inProgress.putAll(commonCourses.get("inProgress"));
        needed.addAll(findNeededReqs(blocks.get("CUNYcommon")));

        // From Pluralism & Diversity
        Map<String,Map<String,Course>> pluralCourses = findCourses(blocks.get("plural"));
        String prefix = "Pluralism & Diversity ";
        pluralCourses.get("taken").forEach((key, value) -> completed.put(prefix+key, value));
        pluralCourses.get("inProgress").forEach( (key,value) -> inProgress.put(prefix+key, value));
        findNeededReqs(blocks.get("plural")).forEach( x -> needed.add(prefix+x));

        result.put("Completed",completed);
        result.put("In Progress",inProgress);
        result.put("Still Needed",needed);

        return result;
    }

    private Map<String, Object> getMajor(String text, ArrayList<String> majors) {
        Map<String, Object> result = new HashMap<>();

        // Seperate by each major
        ArrayList<String> sections = new ArrayList<>();
        refiner.splitSection(text, sections, majors, "Major in ");

        for (int i = 0; i < majors.size(); i++) {
            // split additional requirements from general requirements
            String[] parts = sections.get(i).split("\\nAdditional Major Requ\\-" + majors.get(i));
            String[] partNames = {majors.get(i),"Additional Major Requ-"+majors.get(i)};

            for (int j = 0; j < parts.length; j++) {

                // refine text block
                String part;
                if (j == 0) {
                    if (parts[j].contains(ADDITIONALREQ)) {
                        Matcher m = Pattern.compile("\\n.*"+ADDITIONALREQ+".*\\n").matcher(parts[j]);
                        if (m.find()) part = parts[j].substring(m.end());
                        else part = parts[j];
                    } else {
                        part = parts[j].split("Credits required",2)[1];
                    }
                } else {
                    part = parts[j];
                }
                String[] elective = part.split("(Elective|ELECTIVE)",2);

                // temp storage
                Map<String,Object> courses = new HashMap<>();
                Map<String,Course> taken = new HashMap<>();
                Map<String,Course> inProgress = new HashMap<>();
                ArrayList<String> needed = new ArrayList<>();

                // Get taken, in progress courses
                Map<String,Map<String,Course>> nonElectiveCourses = findCourses(elective[0]);
                taken.putAll(nonElectiveCourses.get("taken"));
                inProgress.putAll(nonElectiveCourses.get("inProgress"));
                
                if (elective.length > 1) {
                    Map<String,ArrayList<Course>> ElectiveCourses = findCoursesNoReqPrefix(elective[1]);
                    inProgress.putAll(nonElectiveCourses.get("inProgress"));
                    ElectiveCourses.get("taken").forEach( x -> taken.put("Elective: "+x.name, x));
                    ElectiveCourses.get("inProgress").forEach( x -> inProgress.put("Elective: "+x.name, x));
                }

                // get still needed
                if (sections.get(i).contains("STILL NEEDED")) {
                    text = text.replaceAll(majors.get(i)+" \\b(?:COMPLETE|STILL NEEDED)\\b", ""); // remove first line
                    Matcher matcher = Pattern.compile("\\n.*"+NEEDED).matcher(elective[0]);
                    while (matcher.find()) {
                        String neededCourse = matcher.group().split(NEEDED)[0].trim();
                        if (!neededCourse.isEmpty()) needed.add(neededCourse);
                    }
                    if (elective.length > 1 && Pattern.compile("(ELECTIVE|Elective).*"+NEEDED).matcher(elective[1]).find()) {
                        Matcher e = Pattern.compile("\\d+ Credits").matcher(elective[1]);
                        if (e.find()) needed.add(e.group().trim()+" of Electives");
                        else needed.add("Electives");
                    }
                }

                courses.put("taken",taken);
                courses.put("inProgress", inProgress);
                courses.put("Still Needed", needed);
                result.put(partNames[j],courses);
            }

        }

        return result;
    }

    private Map<String,Map<String,Course>> findCourses(String text) {
        Map<String,Map<String,Course>> result = new HashMap<>();
        Map<String,Course> taken = new HashMap<>();
        Map<String,Course> inProgress = new HashMap<>();

        Matcher matcher1 = Pattern.compile("\\n.*"+courseStart+".*"+courseEndings).matcher(text);
        while(matcher1.find()) { 
            String course = matcher1.group().trim();
            String req = course.split(courseStart)[0].trim();
            Matcher m =  Pattern.compile(courseStart+".*"+courseEndings).matcher(course);
            if (m.find()) {
                if (m.group().contains("IP (")) inProgress.put(req,createCourse(m.group().split(ipEnd)[0].trim()));
                else taken.put(req,createCourse(m.group().split(courseEnd)[0].trim()));
            }
        }
        
        result.put("taken", taken);
        result.put("inProgress",inProgress);

        return result;
    }

    private Map<String,ArrayList<Course>> findCoursesNoReqPrefix(String text) {
        Map<String,ArrayList<Course>> result = new HashMap<>();
        ArrayList<Course> taken = new ArrayList<>();
        ArrayList<Course> inProgress = new ArrayList<>();
        
        Matcher matcher =  Pattern.compile(courseStart+".*"+courseEndings).matcher(text);
        while (matcher.find()) {
            String course = matcher.group().trim();
            if (course.contains("IP (")) inProgress.add(createCourse(course.split(ipEnd)[0]));
            else taken.add(createCourse(course.split(courseEnd)[0]));
        }

        System.out.println("\ntaken\n"+taken.toString());
        System.out.println("\nprogress\n"+inProgress.toString());

        result.put("taken",taken);
        result.put("inProgress",inProgress);

        return result;
    }

    private ArrayList<String> findNeededReqs(String text) {
        ArrayList<String> needed = new ArrayList<>();

        Matcher matcher2 = Pattern.compile("\\n.*"+NEEDED).matcher(text);
        while(matcher2.find()) needed.add(matcher2.group().split(NEEDED)[0].trim());

        return needed;
    }

    private Course createCourse(String line) {
        Course course = new Course();

        final Pattern nameSep = Pattern.compile(courseStart);
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