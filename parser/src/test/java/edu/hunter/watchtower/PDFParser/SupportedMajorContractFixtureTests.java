package edu.hunter.watchtower.PDFParser;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import edu.hunter.watchtower.common.Requirement;

class SupportedMajorContractFixtureTests {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void sharedFixturesMatchParserResponseSerialization()
            throws IOException, URISyntaxException {
        JsonNode contract = mapper.readTree(Files.readString(fixturePath()));
        List<String> expectedMajors = List.of(
                "Computer Science",
                "Mathematics",
                "Political Science");

        for (int index = 0; index < expectedMajors.size(); index++) {
            JsonNode response = contract.get("cases").get(index).get("raw_parser_response");
            assertEquals(expectedMajors.get(index), response.get("Major").get(0).asString());

            assertRequirementRoundTrip(response.get("Completed").get(0));
            assertRequirementRoundTrip(response.get("Still Needed").get(0));
        }
    }

    private void assertRequirementRoundTrip(JsonNode expected) throws IOException {
        Requirement requirement = mapper.treeToValue(expected, Requirement.class);
        JsonNode serialized = mapper.valueToTree(requirement);
        Set<String> serializedFields = new HashSet<>();
        serializedFields.addAll(serialized.propertyNames());

        assertEquals(
                Set.of("name", "tag", "courses", "exceptions", "credits"),
                serializedFields);
        assertEquals(expected.get("name").asString(), serialized.get("name").asString());
        assertEquals(expected.get("tag").asString(), serialized.get("tag").asString());
        assertEquals(expected.get("credits").doubleValue(), serialized.get("credits").doubleValue(), 0.0001);
        assertEquals(expected.get("exceptions").size(), serialized.get("exceptions").size());
        assertEquals(expected.get("courses").size(), serialized.get("courses").size());

        JsonNode expectedCourse = expected.get("courses").get(0);
        JsonNode serializedCourse = serialized.get("courses").get(0);
        Set<String> serializedCourseFields = new HashSet<>();
        serializedCourseFields.addAll(serializedCourse.propertyNames());
        assertEquals(
                Set.of("courseID", "departmentCode", "name", "grade", "credit"),
                serializedCourseFields);
        assertEquals(expectedCourse.get("courseID"), serializedCourse.get("courseID"));
        assertEquals(expectedCourse.get("departmentCode"), serializedCourse.get("departmentCode"));
        assertEquals(expectedCourse.get("name"), serializedCourse.get("name"));
        assertEquals(expectedCourse.get("grade"), serializedCourse.get("grade"));
        assertEquals(expectedCourse.get("credit").doubleValue(), serializedCourse.get("credit").doubleValue(), 0.0001);
    }

    private Path fixturePath() throws URISyntaxException {
        Path testClasses = Path.of(
                SupportedMajorContractFixtureTests.class
                        .getProtectionDomain()
                        .getCodeSource()
                        .getLocation()
                        .toURI());
        Path repositoryRoot = testClasses.getParent().getParent().getParent();
        return repositoryRoot
                .resolve("test-fixtures")
                .resolve("contracts")
                .resolve("supported-major-audits.json");
    }
}
