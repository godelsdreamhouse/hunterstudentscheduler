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
import edu.hunter.watchtower.common.Requirement;
import lombok.NoArgsConstructor;

@NoArgsConstructor
public class AuditParser {

    private final TextRefiner refiner = new TextRefiner();
    private final String NEEDED = "Still needed";
    private final String ADDITIONALREQ = "This major has Additional \\b\\w+\\b requirements"; //\\b[A-Z]{1}\\w*\\b
    
    // courseStart pattern explanation
    //      [A-Z]{3,7}  --> department code, 3-6 capital letters 
    //      \\d{4,6}    --> course code, 4-5 numbers
    private final String courseStart = "[A-Z]{3,7} \\d{4,6}";

    // courseEnd pattern explanation
    //      \\b(?:A|B|C|D|F|P|W|NC|INC)  -->     Any grade 
    //      [\\+\\-]?    -->     + or - once or not at all, e.g. for A+ or A-
    //      \\d(\\.\\d)? -->     one number for first digit of credit, optional decimal component
    //      \\b(?:FALL|SUMMER|WINTER|SPRING)\\b  -->     one of four term names
    private final String courseEnd = "((A|B|C|D|F|P|W|NC|INC){1}[\\+\\-]?) (\\d(\\.\\d)?) " 
            + "\\b(?:FALL|SUMMER|WINTER|SPRING)\\b";
    
    private final String ipEnd = "IP \\((\\d(\\.\\d)?)";

    private final String courseEndings = "("+courseEnd+"|"+ipEnd+")";

    private final String additionalReq = "Additional \\b\\w+\\b Requ\\-";

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

        // get degree credits
        result.put("Degree Credits",getCredits(text));

        // Get Core Classes
        result.put("CUNY Core",getCoreClasses(blocks));

        // FUTURE: Get Writing Requirement

        // Get Major Information
        result.putAll(getMajor(blocks.get("major"), degreeInfo.get("Major") ));

        // Get Minor Information

        extractReqs(blocks.get("major"));

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
            String[] str = decorateDegreeName(segments[i].replaceAll(patterns[i], "")
                .replaceAll("\\bU\\b ", "").trim()).split(",");
            result.put(keys[i],new ArrayList<>(Arrays.asList(str)));
        }

        return result;
    }

    private Map<String, Object> getCoreClasses(Map<String, String> blocks) {
        Map<String, Object> result = new HashMap<>();
        ArrayList<Requirement> completed = new ArrayList<>();
        ArrayList<Requirement> needed = new ArrayList<>();
        ArrayList<Requirement> inProgress = new ArrayList<>();

        // From CUNY Common Core
        Map<String,ArrayList<Requirement>> commonCourses = findCourses("\n"+blocks.get("CUNYcommon"));
        completed.addAll(commonCourses.get("taken"));
        inProgress.addAll(commonCourses.get("inProgress"));
        needed.addAll(findNeededReqs(blocks.get("CUNYcommon"), "CUNY Common Core"));

        // From Pluralism & Diversity
        Map<String,ArrayList<Requirement>> pluralCourses = findCourses(blocks.get("plural"));
        String prefix = "Pluralism & Diversity ";
        pluralCourses.get("taken").forEach( x -> completed.add(new Requirement(prefix+x.name, x.tag, x.courses,x.credits)));
        pluralCourses.get("inProgress").forEach( x -> completed.add(new Requirement(prefix+x.name, x.tag, x.courses,x.credits)));
        findNeededReqs(blocks.get("plural"),"CUNY Common Core").forEach( x -> needed.add(new Requirement(prefix+x.name, x.tag, x.courses,x.credits)));

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
            String[] parts = sections.get(i).split( "\n"+additionalReq ); //"\\nAdditional Major Requ\\-"
            String[] partNames = {majors.get(i),"Additional Requ-"+majors.get(i)};
            Map<String,Object> major = new HashMap<>();
            major.put("Major Credits",getCredits(sections.get(i)));

            for (int j = 0; j < parts.length; j++) {

                // temp storage
                Map<String,Object> courses = new HashMap<>();
                ArrayList<Requirement> taken = new ArrayList<>();
                ArrayList<Requirement> inProgress = new ArrayList<>();
                ArrayList<String> needed = new ArrayList<>();

                // refine text block
                String part;
                
                if (j == 0) {
                    Matcher m = Pattern.compile("\\n.*"+ADDITIONALREQ+".*\\n").matcher(parts[j]);
                    if (m.find()) part = parts[j].substring(m.end());
                    else part = parts[j];
                } else {
                    part = parts[j];
                }
                String[] elective = part.split("(Elective|ELECTIVE)",2);
                
                // Get taken, in progress courses
                Map<String,ArrayList<Requirement>> nonElectiveCourses = findCourses(elective[0]);
                taken.addAll(nonElectiveCourses.get("taken"));
                inProgress.addAll(nonElectiveCourses.get("inProgress"));
                
                if (elective.length > 1) {
                    Map<String,ArrayList<Requirement>> ElectiveCourses = findCoursesNoReqPrefix(elective[1]);
                    inProgress.addAll(ElectiveCourses.get("inProgress"));
                    taken.addAll(ElectiveCourses.get("taken"));
                    // ElectiveCourses.get("taken").forEach( x -> taken.add(new Requirement(x.name,x.tag,x.courses)));
                    // ElectiveCourses.get("inProgress").forEach( x -> inProgress.put("Elective: "+x.name, x));
                    
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
                major.put(partNames[j],courses);
            }

            result.put(majors.get(i), major);

        }

        return result;
    }

    private Map<String,Object> getCredits(String text) {
        Map<String,Object> result = new HashMap<>();
        // Credits required: 120 Credits applied:  122.7
        String pattern = "(Credits required:\\s+\\d+)\\s+(Credits applied:\\s+\\d+(\\.\\d)?)";
        Matcher m = Pattern.compile(pattern).matcher(text);
        if (m.find()) {
            Float req = Float.valueOf(m.group(1).replaceAll("\\D","").trim());
            Float app = Float.valueOf(m.group().split("\\d+\\s",2)[1].replaceAll("\\D","").trim());
            result.put("Credits required", req);
            result.put("Credits applied", app);
            if (app < req) result.put("Status","Still Needed");
            else result.put("Status","Completed");
        }
        return result;
    }

    private Map<String,ArrayList<Requirement>> findCourses(String text) {
        Map<String,ArrayList<Requirement>> result = new HashMap<>();
        ArrayList<Requirement> taken = new ArrayList<>();
        ArrayList<Requirement> inProgress = new ArrayList<>();
        Matcher m = Pattern.compile("\\n.*(\\s"+courseStart+"(.*)"+courseEndings+")").matcher(text);

        while(m.find()) { 
            Requirement req = new Requirement();
            req.name = m.group().trim().split(courseStart)[0].trim();

            Course c = new Course();
            c.name = m.group(2).trim(); // group 0 = pattern, 1 = no req, 2 = course name, 3 = course ending, 4 = grade, 6 = credit
            String[] split = m.group(1).trim().split(" ");
            c.courseID = Integer.parseInt(split[1].trim());
            c.departmentCode = split[0].trim();
            if (m.group().contains("IP (")) {
                c.grade = "IP";
                c.credit = Float.parseFloat(m.group(3).replaceAll(".*\\(","").trim());
                req.courses = new ArrayList<>(Arrays.asList(c));
                inProgress.add(req);
            } else {
                c.grade = m.group(4).trim();
                c.credit = Float.parseFloat(m.group(6).trim());
                req.courses = new ArrayList<>(Arrays.asList(c));
                taken.add(req);
            }
        }
        
        result.put("taken", taken);
        result.put("inProgress",inProgress);

        return result;
    }

    private Map<String,ArrayList<Requirement>> findCoursesNoReqPrefix(String text) {
        Map<String,ArrayList<Requirement>> result = new HashMap<>();
        ArrayList<Requirement> taken = new ArrayList<>();
        ArrayList<Requirement> inProgress = new ArrayList<>();
        
        Matcher m = Pattern.compile(courseStart+"(.*)"+courseEndings).matcher(text);

        while (m.find()) {
            Requirement req = new Requirement();
            req.name = "Elective";
            Course c = new Course();
            c.name = m.group(1).trim();
            String[] split = m.group().split(" ");
            c.departmentCode = split[0];
            c.courseID = Integer.parseInt(split[1]);
            if (m.group().contains("IP (")) {
                c.grade = "IP";
                c.credit = Float.parseFloat(m.group(2).replaceAll(".*\\(","").trim());
                req.courses = new ArrayList<>(Arrays.asList(c));
                inProgress.add(req);
            } else {
                c.grade = m.group(4).trim();
                c.credit = Float.parseFloat(m.group(5).trim());
                req.courses = new ArrayList<>(Arrays.asList(c));
                taken.add(req);
            }
        }

        result.put("taken",taken);
        result.put("inProgress",inProgress);

        return result;
    }

    private ArrayList<Requirement> findNeededReqs(String text, String tag) {
        ArrayList<Requirement> needed = new ArrayList<>();

        Matcher matcher = Pattern.compile("\\n.+"+NEEDED).matcher(text);
        while(matcher.find()) {
            Requirement req = new Requirement();
            String[] split = matcher.group().split(NEEDED,2);
            req.name = split[0];
            req.tag = tag;



            //needed.add(matcher2.group().split(NEEDED)[0].trim());
        }

        return needed;
    }

    private String decorateDegreeName(String text) {
        return text.replaceAll("\\bStds\\b","Studies");
    }

    private Map<String,ArrayList<Requirement>> extractReqs(String text) {
        Map<String,ArrayList<Requirement>> result = new HashMap<>();
        ArrayList<Requirement> taken = new ArrayList<>();
        ArrayList<Requirement> inProgress = new ArrayList<>();
        ArrayList<Requirement> stillNeeded = new ArrayList<>();

        Pattern pattern = Pattern.compile("\\n.*((\\s" + courseStart + "(.*)" + courseEndings + ")|Still needed)");
        ArrayList<String> blocks = refiner.getBlocks(text, pattern);

        for (String b : blocks) {
            Requirement req = new Requirement();
            ArrayList<Course> courses = new ArrayList<>();
            if (b.contains(NEEDED)) {
                req.name = b.split(NEEDED,2)[0];
                Matcher credit = Pattern.compile("\\d+(\\.\\d)?").matcher(text); // RANGE OF CREDITS?
                if (credit.find()) {
                    req.credits = Float.parseFloat(credit.group());
                }
                // req.tag = <-- FIGURE OUT
                String[] reqList = b.substring(credit.end()).replaceAll("\\bin\\b","").trim().split("or");
                String code = "";
                for (String r : reqList) {
                    Matcher m = Pattern.compile("([A-Z]{3,7}) (\\d{1,6})").matcher(r);
                    if (m.find()) {
                        courses.add(new Course(Integer.parseInt(m.group(2)),m.group(1),"","",0.0f));
                        code = m.group(1);
                    } else {

                    }
                }
            }
        }

        return result;
    }

} // end AuditParser definition