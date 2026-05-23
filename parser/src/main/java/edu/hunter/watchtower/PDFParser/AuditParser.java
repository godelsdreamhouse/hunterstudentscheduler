/**
 * @file AuditParser.Java
 * @author Allison Gorman
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import edu.hunter.watchtower.common.Course;
import edu.hunter.watchtower.common.Requirement;
import edu.hunter.watchtower.database.JdbcCoursesRepository;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@Service
public class AuditParser {

    // Objects
    @Autowired
    JdbcCoursesRepository jdbcCoursesRepository;
    private final TextRefiner refiner = new TextRefiner();

    // Patterns
    private final String NEEDED = "Still needed";

    // courseStart pattern explanation
    // [A-Z]{2,7} --> department code, 3-6 capital letters
    // \\d{4,6} --> course code, 4-5 numbers
    private final String courseStart = "[A-Z]{2,7} \\d{2,6}(LA)?";

    // courseEnd pattern explanation
    // \\b(?:A|B|C|D|F|P|W|NC|INC) --> Any grade
    // [\\+\\-]? --> + or - once or not at all, e.g. for A+ or A-
    // \\d(\\.\\d)? --> one number for first digit of credit, optional decimal
    // component
    // \\b(?:FALL|SUMMER|WINTER|SPRING)\\b --> one of four term names
    private final String courseEnd = "((A|B|C|D|F|P|W|NC|CR|INC){1}[\\+\\-]?)\\s+(\\d(\\.\\d)?) "
            + "\\b(?:FALL|SUMMER|WINTER|SPRING)\\b \\b(?:\\d{4}U)\\b";

    private final String ipEnd = "IP\\s+\\((\\d(\\.\\d)?)";

    private final String courseEndings = "(" + courseEnd + "|" + ipEnd + ")";

    private final String additionalReq = "Additional \\b\\w+\\b Requ(\\-|:)";

    private final String flexibleCommonCoreBlock = "FLEXIBLE COMMON CORE For Individual and Society";

    /**
     * @brief Parses an Audit PDF or txt file and extracts relevant information from
     *        it
     * @param file  The file to parse
     * @param isPDF Whether the file is a PDF
     * @return A map containing the extracted information
     */
    public Map<String, Object> parse(File file, boolean isPDF) {
        if (!isPDF)
            return parseTxt(file);

        String text;
        PDFTextStripper pdfTextStripper = new PDFTextStripper();

        try (PDDocument audit = Loader.loadPDF(file)) {
            text = pdfTextStripper.getText(audit);
        } catch (IOException e) {
            Map<String, Object> result = new HashMap<>();
            result.put("ERROR", e.getMessage());
            return result;
        }

        return extractInfo(text);
    }

    /**
     * @brief Parses a text file and extracts relevant information from it
     * @param file The file to parse
     * @return A map containing the extracted information
     *         Used for testing purposes to test permuations of sample audits, e.g.
     *         make a requirement needed when it isn't in the original Audit
     */
    private Map<String, Object> parseTxt(File file) {
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

    /**
     * @brief Extracts information from the parsed text
     * @param text The text to extract information from
     * @return A map containing the extracted information
     */
    private Map<String, Object> extractInfo(String text) {
        Map<String, Object> result = new HashMap<>();

        if (!verifyAudit(text)) {
            result.put("ERROR", "Not a DegreeWorks PDF");
            return result;
        }

        // Get Major, Minor, Concentration
        Map<String, ArrayList<String>> degreeInfo = getDegreeInfo(refiner.getBlock(text, "Major(s)?", "Matriculation"));
        degreeInfo.forEach((x, y) -> {
            result.put(x, y);
        });
        boolean minor = degreeInfo.get("Minor").size() == 1 && (degreeInfo.get("Minor").get(0).equals("None")
                || degreeInfo.get("Minor").get(0).equals("Focus Study selection"));

        // Get Student GPA
        result.put("GPA", getGPA(text));

        Map<String, String> blocks = getBlocks(text, !minor);

        // get degree credits
        result.put("Degree Credits", getCredits(text));

        ArrayList<Requirement> taken = new ArrayList<>();
        ArrayList<Requirement> needed = new ArrayList<>();

        // Get Core Classes
        Map<String, ArrayList<Requirement>> coreClasses = getCoreClasses(blocks);
        taken.addAll(coreClasses.get("Completed"));
        needed.addAll(coreClasses.get("Still Needed"));

        // Get Writing Requirement
        Map<String, ArrayList<Requirement>> writingReq = getWritingRequirement(blocks.get("writing"));
        taken.addAll(writingReq.get("Completed"));
        needed.addAll(writingReq.get("Still Needed"));

        // Get Hunter Focus
        Map<String, ArrayList<Requirement>> hunterFocus = getHunterFocus(blocks.get("hunterFocus"));
        taken.addAll(hunterFocus.get("Completed"));
        needed.addAll(hunterFocus.get("Still Needed"));

        // Get Major Information
        Map<String, Object> majorInfo = getMajor(blocks.get("major"), degreeInfo.get("Major"));
        taken.addAll((ArrayList<Requirement>) majorInfo.get("Completed"));
        needed.addAll((ArrayList<Requirement>) majorInfo.get("Still Needed"));
        result.put("MajorInfo", majorInfo.get("Major status"));

        // Get Electives
        taken.addAll(getElectives(blocks.get("rest")));

        result.put("Completed", taken);
        result.put("Still Needed", needed);

        return result;
    }

    /**
     * @brief Verifies that the parsed text is from a DegreeWorks audit
     * @param text The text to verify
     * @return True if the text is from a DegreeWorks audit; false otherwise
     *         Verification is done by checking the last line of the text for the
     *         string "Ellucian Degree Works"
     */
    private boolean verifyAudit(String text) {
        String[] lines = text.split("\n");
        String lastLine = lines[lines.length - 1];
        Pattern pattern = Pattern.compile("Ellucian Degree Works");
        Matcher matcher = pattern.matcher(lastLine);
        return matcher.find();
    }

    /**
     * @brief Extracts the main blocks of text from the parsed text
     * @param text  The text to extract blocks from
     * @param minor Whether the student has a minor
     * @return A map containing the extracted blocks
     *         The blocks are extracted in order to prevent unnecessary searching
     *         through the entire text.
     */
    private Map<String, String> getBlocks(String text, boolean minor) {
        Map<String, String> result = new HashMap<>();

        ArrayList<String> keys = new ArrayList<>(Arrays.asList(
                "CUNYcommon", "hunterFocus", "writing", "plural", "major", "rest"));
        ArrayList<String> starts = new ArrayList<>(Arrays.asList(
                "REQUIRED CORE", "Foreign Lang",
                "Writing Requirement", "Pluralism & Diversity", "Major in", ""));
        ArrayList<String> stops = new ArrayList<>(Arrays.asList(
                "NOTE: THIS INFO ", "Writing Requirement",
                "Pluralism & Diversity", "Major",
                "(Elective Courses (Not )?Allowed)|(Insufficient Grades)|(In-progress Credits)", "end"));

        if (minor) {
            keys.add(5, "minor");
            starts.add(5, "Minor in");
            stops.add(4, "Minor");
        }

        ArrayList<String> blocks = refiner.getBlocks(text, starts, stops);
        IntStream.range(0, blocks.size()).forEach(i -> result.put(keys.get(i), blocks.get(i)));

        return result;
    }

    /**
     * @brief Gets the student's degree information, i.e. major, minor, and
     *        concentration
     * @param line The text to extract degree information from
     * @return A map containing the extracted degree information
     *         To accomodate multiple majors, minors, and concentrations, the values
     *         in the map are ArrayLists of strings.
     */
    private Map<String, ArrayList<String>> getDegreeInfo(String line) {
        Map<String, ArrayList<String>> result = new HashMap<>();
        final String divider = "   ";
        line = line.replaceAll("\n", " ").trim();

        String[] segments = line.split(divider + "Level")[0].split(divider);
        String[] patterns = { "Major{1}s?", "Concentration{1}s?", "Minor{1}s?" };
        String[] keys = { "Major", "Concentration", "Minor" };

        for (int i = 0; i < segments.length; ++i) {
            String[] str = decorateDegreeName(segments[i].replaceAll(patterns[i], "")
                    .replaceAll("\\bU\\b ", "").trim()).split(",");
            str = Arrays.stream(str).map(String::trim).toArray(String[]::new);
            result.put(keys[i], new ArrayList<>(Arrays.asList(str)));
        }

        return result;
    }

    /**
     * @brief Extracts the completed and still needed requirements for the CUNY
     *        Common Core and Pluralism & Diversity
     * @param blocks A map containing the blocks of text to extract requirements
     *               from
     * @return A map containing ArrayLists of the completed and still needed
     *         requirements
     */
    private Map<String, ArrayList<Requirement>> getCoreClasses(Map<String, String> blocks) {
        Map<String, ArrayList<Requirement>> result = new HashMap<>();
        ArrayList<Requirement> completed = new ArrayList<>();
        ArrayList<Requirement> needed = new ArrayList<>();

        // From CUNY Common Core
        completed.addAll(findCourses("\n" + blocks.get("CUNYcommon"), "CUNYcommon", ""));

        String commonCoreText = blocks.get("CUNYcommon");
        // The following is to remove unnecessary text which interferes with parsing.
        // The start and end of this block are the same for all Audits
        // Using substrings to avoid scenarios where the page header (Hunter College
        // Last Name, First Name (Middle Name)? - EMPLID) is part of the block
        int flexibleIndex = commonCoreText.indexOf(flexibleCommonCoreBlock);
        int nextIndex = commonCoreText.indexOf("World Cultures and Global Issues");
        commonCoreText = commonCoreText.substring(0, flexibleIndex) + commonCoreText.substring(nextIndex);
        needed.addAll(findNeededReqs(commonCoreText, "CUNY Common Core"));

        // From Pluralism & Diversity
        ArrayList<Requirement> pluralCourses = findCourses("\n" + blocks.get("plural"), "Pluralism & Diversity", "");
        String prefix = "Pluralism & Diversity ";
        pluralCourses.forEach(
                x -> completed.add(new Requirement(prefix + x.name, x.tag, x.courses, x.exceptions, x.credits)));
        findNeededReqs(blocks.get("plural"), "Pluralism & Diversity")
                .forEach(x -> needed.add(new Requirement(prefix + x.name, x.tag, x.courses, x.exceptions, x.credits)));

        result.put("Completed", completed);
        result.put("Still Needed", needed);

        return result;
    }

    /**
     * @brief Extracts the completed and still needed requirements for the student's
     *        major(s)
     * @param text   The text to extract requirements from
     * @param majors An ArrayList of the student's majors
     * @return A Map containing an ArrayList of completed major requirements, an
     *         ArrayList of still needed major requirements, and
     *         a Map containing the credits required and applied for each major
     */
    private Map<String, Object> getMajor(String text, ArrayList<String> majors) {
        Map<String, Object> result = new HashMap<>();

        // Seperate by each major
        ArrayList<String> sections = new ArrayList<>(Arrays.asList(text.split("Major in ")));
        ArrayList<Requirement> taken = new ArrayList<>();
        ArrayList<Requirement> needed = new ArrayList<>();
        Map<String, Map<String, Object>> majorInfo = new HashMap<>();

        for (int i = 0; i < majors.size(); i++) {
            // refine text block
            String block = sections.get(i).replaceAll("General " + majors.get(i) + ".+\\n", "")
                    .replaceAll(majors.get(i) + " \\b(COMPLETE|STILL NEEDED)\\b", "")
                    .replaceAll("This major has (A|a)dditional.+\\n", "").trim();

            // split additional requirements from general requirements
            String[] parts = block.split("\n" + additionalReq); // "\\nAdditional Major Requ\\-"

            // Get credit information
            majorInfo.put("MajorCredits_" + majors.get(i), getCredits(sections.get(i)));

            for (String p : parts) {
                // refine text block
                String[] elective = p.split("(Elective|ELECTIVE)", 2);

                // Get taken, in progress courses
                taken.addAll(findCourses(elective[0], "major_" + majors.get(i), ""));
                if (elective.length > 1)
                    taken.addAll(
                            findCourses(elective[1], "major_elective_" + majors.get(i), majors.get(i) + " Elective"));

                // get still needed
                if (sections.get(i).contains("STILL NEEDED")) {
                    needed.addAll(findNeededReqs(elective[0], "major_" + majors.get(i)));

                    // Only finding how many elective credits needed, not all classes which could be
                    // a major elective
                    if (elective.length > 1 && elective[1].contains(NEEDED)) {
                        Matcher e = Pattern.compile("\\d+ Credits").matcher(elective[1]);
                        if (e.find()) {
                            Requirement req = new Requirement();
                            req.name = "Major " + majors.get(i) + " Elective";
                            req.tag = "major_elective_" + majors.get(i);
                            req.credits = Float.parseFloat(e.group().replaceAll(" Credits", ""));
                            needed.add(req);
                        }
                    }
                }
            }
        }
        result.put("Completed", taken);
        result.put("Still Needed", needed);
        result.put("Major status", majorInfo);

        return result;
    }

    /**
     * @brief Extracts the completed and still needed requirements for the student's
     *        writing requirement
     * @param text The text to extract requirements from
     * @return A Map containing an ArrayList of completed courses which satisfy the
     *         writing requirements and an ArrayList containing Writing Requirement
     *         with the number of credits still needed
     */
    private Map<String, ArrayList<Requirement>> getWritingRequirement(String text) {
        Map<String, ArrayList<Requirement>> result = new HashMap<>();
        ArrayList<Requirement> completed = new ArrayList<>();
        ArrayList<Requirement> needed = new ArrayList<>();

        Matcher c = Pattern.compile("\\d+ CREDITS REQUIRED").matcher(text);
        Float credits = 0.0f;
        if (c.find())
            credits = Float.valueOf(c.group().replaceAll("\\D", ""));
        completed.addAll(findCourses("\n" + text.split("\\d+ Classes, WI sections")[1].trim(),
                "WR - Writing Requirement", "Writing Requirement"));
        completed.forEach(x -> x.credits = 3.0f);

        Matcher cNum = Pattern.compile("Writing Requirement: \\d+ Classes").matcher(text);
        if (cNum.find()) {
            int classNum = Integer.parseInt(cNum.group().replaceAll("\\D", ""));
            // Finding possible writing requirements is done later on in pipeline in the
            // Scheduler
            if (completed.size() < classNum) {
                Requirement req = new Requirement();
                req.name = "Writing Requirement";
                req.tag = "WR - Writing Requirement";
                req.credits = credits - 3 * classNum;
                needed.add(req);
            }
        }

        result.put("Completed", completed);
        result.put("Still Needed", needed);

        return result;
    }

    /**
     * @brief Extracts information about the student's Hunter Focus Requirement,
     *        i.e. completed and still needed requirements
     * @param text The text to extract information from
     * @return A Map containing an ArrayList of completed requirements and an
     *         ArrayList of still needed requirements for the Hunter Focus
     *         Requirement
     *         Implementation depends on if the student has a Foreign Language
     *         Exemption
     */
    private Map<String, ArrayList<Requirement>> getHunterFocus(String text) {
        Map<String, ArrayList<Requirement>> result = new HashMap<>();
        ArrayList<Requirement> completed = new ArrayList<>();
        ArrayList<Requirement> needed = new ArrayList<>();

        if (text.contains("Foreign Language Exemption")) {
            text = text.split("Hunter Focus-Concentrated Study")[1];
            Requirement lang = new Requirement();
            lang.name = "Hunter Focus-Foreign Lang";
            lang.tag = "Hunter Focus-Foreign Lang";
            lang.credits = 12.0f;
            lang.courses = new ArrayList<>(
                    Arrays.asList(new Course("20200", "FLNG", "Foreign Language Exemption", "CR", 0.0f)));
            completed.add(lang);

            Matcher rName = Pattern.compile("(Focus Study: .+) (?:[A-Z]{2,7} \\d{5})|(?:Still needed)").matcher(text);
            String reqName = "";
            if (rName.find()) {
                // group 0 = entire match, group 1 = Focus Study name
                reqName = rName.group(1).trim();
            }
            String[] split = text.split("Still needed: \\d+(\\.\\d+)? Credits");
            completed.addAll(findCourses("\n" + split[0], "Hunter Focus-Concentrated Study", reqName));
            if (split.length > 1) {
                Requirement req = new Requirement();
                req.name = reqName;
                req.tag = "Hunter Focus-Concentrated Study";
                req.credits = Float
                        .parseFloat(split[1].replaceAll("Still needed:", "").replaceAll("Credits", "").trim());
                needed.add(req);
            }
        } else {
            String[] split = text.split("HUNTER FOCUS 12.+\\n");
            if (split.length > 1)
                text = split[1];
            completed.addAll(findCourses(text, "Hunter Focus-Lang.", ""));
            if (text.contains("Still needed")) {
                String neededReqs = text.split("Level Language course(s)? Still needed:\\n")[1].trim();
                needed.addAll(findNeededReqs(neededReqs, "Hunter Focus-Lang."));
            }

        }

        result.put("Completed", completed);
        result.put("Still Needed", needed);

        return result;
    }

    /**
     * @brief Extracts the completed elective courses from the parsed text
     * @param text The text to extract information from
     * @return An ArrayList of completed elective courses, stored as Requirements
     *         with the name "Elective Courses Allowed"
     */
    private ArrayList<Requirement> getElectives(String text) {
        ArrayList<Requirement> completed = new ArrayList<>();

        if (text.contains("Elective Courses Allowed")) {
            String end = "(Elective Courses Not Allowed)|(Insufficient Grades)|(In-progress Credits)|(Split Credits Credits)|(Exceptions)";
            Matcher e = Pattern.compile(end).matcher(text);
            if (e.find())
                text = text.substring(0, e.start()).trim();
            completed.addAll(findCourses("\n" + text, "Elective Courses Allowed", "Elective Courses Allowed"));
        }

        return completed;
    }

    /**
     * @brief Extracts the credits required and applied from the parsed text
     * @param text The text to extract information from
     * @return A Map containing the credits required and applied
     */
    private Map<String, Object> getCredits(String text) {
        Map<String, Object> result = new HashMap<>();
        // Format: Credits required: \\d+ Credits applied: \\d+
        String pattern = "(Credits required:\\s+\\d+(\\.\\d)?)\\s+(Credits applied:\\s+\\d+(\\.\\d)?)";
        Matcher m = Pattern.compile(pattern).matcher(text);
        if (m.find()) {
            Float req = Float.valueOf(m.group(1).split(": ")[1].trim());
            Float app = Float.valueOf(m.group().split("Credits applied", 2)[1].split(": ")[1].trim());
            result.put("Credits required", req);
            result.put("Credits applied", app);
            if (app < req)
                result.put("Status", "Still Needed");
            else
                result.put("Status", "Completed");
        }
        return result;
    }

    /**
     * @brief Extracts completed courses from the given text and then constructs
     *        Course objects for each completed course, which are then stored in a
     *        Requirement object
     * @param text    The text to extract information from
     * @param tag     The tag to assign to the extracted courses
     * @param reqName The name of the requirement; if empty, then the requirement
     *                name is extracted from the text
     * @return An ArrayList of completed courses, stored as Requirements
     */
    private ArrayList<Requirement> findCourses(String text, String tag, String reqName) {
        ArrayList<Requirement> taken = new ArrayList<>();
        Matcher m = (reqName.equals("")
                ? Pattern.compile("\\n.+(\\s" + courseStart + "(.+)" + courseEndings + ")").matcher(text)
                : Pattern.compile("\\n(" + courseStart + "(.+)" + courseEndings + ")").matcher(text));
        while (m.find()) {
            Requirement req = new Requirement();
            req.name = (reqName.equals("")) ? m.group().trim().split(courseStart)[0].trim() : reqName;
            req.tag = tag;

            Course c = new Course();
            c.name = m.group(3).trim(); // group 0 = pattern, 1 = no req, 3 = course name, 5 = grade, 7 = credit
            String[] split = m.group(1).trim().split(" ");
            c.courseID = split[1].trim();
            c.departmentCode = split[0].trim();
            if (m.group().contains("IP (")) {
                c.grade = "IP"; // grade and credit are in different groups because of how IP regex is
                                // structured
                c.credit = Float.parseFloat(m.group(9).replaceAll(".*\\(", "").trim());
            } else {
                c.grade = m.group(5).trim();
                c.credit = Float.parseFloat(m.group(7).trim());
            }
            req.courses = new ArrayList<>(Arrays.asList(c));
            taken.add(req);
        }
        return taken;
    }

    /**
     * @brief Extracts still needed requirements from the given text and then
     *        constructs Requirement objects
     * @param text The text to extract information from
     * @param tag  The tag to assign to the extracted requirements
     * @return An ArrayList of still needed requirements
     *         In the Audit, requirements which are still needed will be followed by
     *         a list of courses which satisfy it.
     *         The Requirement.courses ArrayList is populated with Course objects
     *         extracted from that list of courses.
     */
    private ArrayList<Requirement> findNeededReqs(String text, String tag) {
        ArrayList<Requirement> needed = new ArrayList<>();
        ArrayList<String> blocks = refiner.divideText("\n" + text,
                Pattern.compile("\\n.+((\\s" + courseStart + "(.+)" + courseEndings + ")|Still needed)"));

        for (String b : blocks) {
            if (!b.contains(NEEDED) || b.equals(""))
                continue; // only get Still Needed requirements
            Requirement req = new Requirement();
            b = b.replaceAll("\n", " ").trim();
            float credits = 0.0f;

            Matcher c = Pattern.compile("([0-9]+)\\s+Credits(\\s+and\\s+([0-9]+)\\s+Course\\s+in)?").matcher(b);
            Matcher courseOnly = Pattern.compile("([0-9]+)\\s+Course\\s+in").matcher(b);
            Matcher e = Pattern.compile("\\bExcept\\b").matcher(b);
            String stillNeededList;
            String exceptionList;
            int requirementPrefix;
            if (c.find()) {
                credits = Float.parseFloat(c.group(1));
                stillNeededList = b.substring(c.end()).trim();
                requirementPrefix = c.end();
            } else if (courseOnly.find()) {
                stillNeededList = b.substring(courseOnly.end()).trim();
                requirementPrefix = courseOnly.end();
            } else {
                continue;
            }
            if (e.find()) {
                stillNeededList = b.substring(requirementPrefix, e.start()).trim();
                exceptionList = b.substring(e.end()).trim();
                req.exceptions = getStillNeededList(exceptionList, "\\bor\\b");
            }

            req.credits = credits;
            req.name = b.split(NEEDED, 2)[0].trim();
            req.tag = tag;
            req.courses = getStillNeededList(stillNeededList, "\\bor\\b");

            needed.add(req);
        }

        return needed;
    }

    /**
     * @brief Decorates the degree name by replacing abbreviations with full names
     * @param text The text containing the degree name
     * @return The decorated degree name
     *         As degree programs are added, this method will need to be updated
     *         with any new abbreviations.
     *         Need to decorate degree name because the degree name listed in the
     *         header (which getDegreeInfo() extracts from) is abbreviated.
     *         This is unlike the degree name used in the header of the major block,
     *         so processing must be done.
     */
    private String decorateDegreeName(String text) {
        text = text.replaceAll("\\bStds\\b", "Studies");
        text = text.replaceAll("\\bMath\\b", "Mathematics");
        return text;
    }

    /**
     * @brief Extracts a list of courses from the given text based on the specified
     *        split pattern
     * @param text  The text containing the course information
     * @param split The pattern to split the text by
     * @return An ArrayList of Course objects
     *         If a course has a courseID containing "@"it is expanded into multiple
     *         courses using the expandCourse() method.
     */
    private ArrayList<Course> getStillNeededList(String text, String split) {
        ArrayList<Course> result = new ArrayList<>();
        String dept = "";
        for (String c : text.split(split)) {
            Course course = new Course();

            Matcher m = Pattern.compile("[A-Z]{3,6}").matcher(c);
            if (m.find() && !Pattern.compile("SPRING|FALL|SUMMER|WINTER|NOTE").matcher(m.group()).find()) {
                dept = m.group();
            }
            course.departmentCode = dept;

            Matcher num = Pattern.compile("\\d{1,5}(\\@)?").matcher(c);
            if (num.find())
                course.courseID = num.group();

            if (course.courseID.contains("@"))
                result.addAll(expandCourse(course));
            else
                result.add(course);
        }

        return result;
    }

    /**
     * @brief Expands a course with a courseID containing "@" into multiple courses
     *        using the JdbcCoursesRepository
     * @param course The course object to expand
     * @return An ArrayList of Course objects which correspond to the abbreviated
     *         courseID
     */
    private ArrayList<Course> expandCourse(Course course) {
        ArrayList<Course> result = new ArrayList<>();

        String courseCode = course.departmentCode + " " + course.courseID.replaceAll("\\D", "").trim();

        if (courseCode.equals(""))
            return result;
        result.addAll(jdbcCoursesRepository.findByCourseCode(courseCode));

        return result;
    }

    /**
     * @brief Extracts the student's GPA from the given text
     * @param text The text to extract information from
     * @return A String containing the student's GPA
     *         Used in UI, not scheduler.
     */
    private String getGPA(String text) {
        String gpa = "";
        Matcher m = Pattern.compile("Cumulative GPA\n\\d\\.\\d{1,2}").matcher(text);
        if (m.find())
            gpa = m.group().replaceAll("Cumulative GPA\n", "").trim();
        return gpa;
    }

} // end AuditParser definition